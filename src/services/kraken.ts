const RECOGNITION_TIMEOUT_MS = 10 * 60 * 1000;

export class KrakenError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 502 | 503 | 504,
  ) {
    super(message);
    this.name = "KrakenError";
  }
}

export class KrakenService {
  constructor(private readonly baseUrl: string) {}

  async recognize(image: Uint8Array): Promise<string> {
    let response: Response;
    try {
      const base = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`;
      response = await fetch(new URL("recognize", base), {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: Buffer.from(image),
        signal: AbortSignal.timeout(RECOGNITION_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new KrakenError("Kraken recognition timed out", 504);
      }
      throw new KrakenError(`Kraken is not reachable at ${this.baseUrl}`, 503);
    }

    const text = (await response.text()).trim();
    if (!response.ok) {
      throw new KrakenError(text || `Kraken recognition failed (${response.status})`, statusFrom(response.status));
    }
    if (!text) {
      throw new KrakenError("Kraken finished without transcription text", 502);
    }
    return text;
  }
}

function statusFrom(status: number): 400 | 502 | 504 {
  if (status === 400 || status === 504) return status;
  return 502;
}
