import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const JOB_TIMEOUT_MS = 10 * 60 * 1000;
const STARTUP_TIMEOUT_MS = 3 * 60 * 1000;

type WorkflowProcess = {
  id: string;
  process: string;
  arguments?: string[];
};

type WorkflowConfiguration = {
  project: string;
  type: string;
  processing: string;
  workflow: string[];
  pages?: string[] | null;
  processes: WorkflowProcess[];
};

type WorkflowOverview = {
  id: string;
  state: "scheduled" | "running" | "completed" | "canceled" | "interrupted";
  step?: number;
  stepNumber?: number;
};

export class Ocr4allError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 502 | 503 | 504,
  ) {
    super(message);
    this.name = "Ocr4allError";
  }
}

export class Ocr4allService {
  constructor(
    private readonly baseUrl: string,
    private readonly dataDir: string,
    private readonly model = process.env.OCR4ALL_MODEL,
  ) {}

  async recognize(image: Uint8Array): Promise<string> {
    const template = await this.template();
    const models = await this.json<string[]>("/batch/models");
    if (models.length === 0) {
      throw new Ocr4allError("OCR4all has no recognition models installed", 502);
    }
    const checkpoints = checkpointsFor(models, this.model);

    const project = `page-${randomUUID()}`;
    const projectDir = path.join(this.dataDir, project);
    await mkdir(path.join(projectDir, "input"), { recursive: true });
    const png = await sharp(Buffer.from(image)).png().toBuffer();
    await writeFile(path.join(projectDir, "input", "0001.png"), png);

    const workflow = applyModel(template, project, checkpoints);
    await this.json("/batch/manager/run");
    const scheduled = await this.json<WorkflowOverview>("/batch/process/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workflow),
    });
    const finished = await this.waitFor(scheduled.id);
    if (finished.state !== "completed") {
      const detail = await this.json<unknown>(`/batch/process/details/${scheduled.id}`).catch(() => null);
      const reason = detailMessages(detail).join("; ");
      throw new Ocr4allError(reason || `OCR4all workflow ${finished.state}`, 502);
    }

    const text = await readTranscription(projectDir);
    if (!text) {
      throw new Ocr4allError("OCR4all finished without transcription text", 502);
    }
    await rm(projectDir, { recursive: true, force: true });
    return text;
  }

  private async template(): Promise<WorkflowConfiguration> {
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    let lastError = "OCR4all is not reachable";
    while (Date.now() < deadline) {
      try {
        return await this.json<WorkflowConfiguration>("/batch/template", undefined, true);
      } catch (error) {
        lastError = error instanceof Error ? error.message : lastError;
        if (error instanceof Ocr4allError && error.status !== 503) throw error;
        await delay(2_000);
      }
    }
    throw new Ocr4allError(lastError, 503);
  }

  private async waitFor(id: string): Promise<WorkflowOverview> {
    const deadline = Date.now() + JOB_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const overview = await this.json<WorkflowOverview>(`/batch/process/${id}`);
      if (overview.state !== "scheduled" && overview.state !== "running") return overview;
      await delay(2_000);
    }
    throw new Ocr4allError("OCR4all workflow timed out", 504);
  }

  private async json<T>(requestPath: string, init?: RequestInit, starting = false): Promise<T> {
    const base = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`;
    let response: Response;
    try {
      response = await fetch(new URL(requestPath.replace(/^\//, ""), base), {
        ...init,
        headers: { Accept: "application/json", ...init?.headers },
      });
    } catch {
      throw new Ocr4allError(`OCR4all is not reachable at ${this.baseUrl}`, 503);
    }

    const body = await response.text();
    if (!response.ok) {
      if (starting) throw new Ocr4allError("OCR4all is still starting", 503);
      throw new Ocr4allError(body.trim() || `OCR4all request failed (${response.status})`, 502);
    }
    if (!body) return undefined as T;
    try {
      return JSON.parse(body) as T;
    } catch {
      throw new Ocr4allError(starting ? "OCR4all is still starting" : "OCR4all returned a non-JSON response", starting ? 503 : 502);
    }
  }
}

function checkpointsFor(models: string[], preferred: string | undefined): string[] {
  if (preferred) {
    const matches = models.filter((name) => name === preferred || name.startsWith(`${preferred}/`));
    if (matches.length === 0) {
      throw new Ocr4allError(`OCR4all model "${preferred}" is not installed`, 400);
    }
    return matches;
  }

  for (const family of ["default/uw3-modern-english", "default/antiqua_historical"]) {
    const matches = models.filter((name) => name.startsWith(`${family}/`));
    if (matches.length > 0) return matches;
  }
  return [models[0]];
}

function applyModel(
  template: WorkflowConfiguration,
  project: string,
  checkpoints: string[],
): WorkflowConfiguration {
  const processes = template.processes.map((process) => {
    const args = [...(process.arguments ?? [])];
    for (const flag of ["--parallel", "--processes"]) {
      const index = args.indexOf(flag);
      if (index >= 0 && index + 1 < args.length) args[index + 1] = "1";
    }
    if (process.process === "lineSegmentation") {
      return {
        ...process,
        arguments: [
          "--usegauss",
          "--remove-images",
          "--parallel",
          "1",
          "--minscale",
          "12",
          "--maxlines",
          "300",
          "--scale",
          "0",
          "--hscale",
          "1",
          "--vscale",
          "1",
          "--filter-strength",
          "1",
          "--maxskew",
          "2.0",
          "--skewsteps",
          "8",
          "--threshold",
          "0.2",
        ],
      };
    }
    if (process.process === "recognition") {
      const kept: string[] = [];
      for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--checkpoint") {
          let end = index + 1;
          while (end < args.length && !args[end]?.startsWith("--")) end += 1;
          index = end - 1;
          continue;
        }
        if (arg === "--verbose" || arg === "--pagexml_word_level" || arg === "--processes" || arg === "--batch_size" || arg === "--voter") {
          if (arg !== "--verbose" && arg !== "--pagexml_word_level" && index + 1 < args.length && !args[index + 1]?.startsWith("--")) {
            index += 1;
          }
          continue;
        }
        kept.push(arg);
      }
      kept.push("--checkpoint", ...checkpoints);
      return { ...process, arguments: kept };
    }
    if (process.process === "resultGeneration") {
      const index = args.indexOf("--strategy");
      if (index >= 0 && index + 1 < args.length) args[index + 1] = "prediction";
    }
    return { ...process, arguments: args };
  });

  return {
    ...template,
    project,
    pages: ["0001"],
    processes,
  };
}

async function readTranscription(projectDir: string): Promise<string> {
  const resultsDir = path.join(projectDir, "results");
  let names: string[];
  try {
    names = await readdir(resultsDir);
  } catch {
    return "";
  }
  const textDirs = names.filter((name) => name.endsWith("_txt")).sort();
  const latest = textDirs.at(-1);
  if (!latest) return "";
  const complete = path.join(resultsDir, latest, "complete.txt");
  const text = await readFile(complete, "utf8").catch(() => "");
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("###"))
    .join("\n")
    .trim();
}

function detailMessages(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const messages: string[] = [];
  if (typeof record.message === "string" && record.message.trim()) messages.push(record.message.trim());
  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      for (const item of child) messages.push(...detailMessages(item));
    } else if (child && typeof child === "object") {
      messages.push(...detailMessages(child));
    }
  }
  return messages;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
