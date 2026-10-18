import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { loadBurials } from "./data/burials.js";
import { burialRoutes } from "./routes/burials.js";
import { KrakenError, KrakenService } from "./services/kraken.js";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/tiff", "image/tif"]);
const IMAGE_EXTENSIONS = /\.(jpe?g|png|tiff?)$/i;

const kraken = new KrakenService(process.env.KRAKEN_URL ?? "http://localhost:5001");

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.route("/api", burialRoutes(await loadBurials()));

app.post("/api/image", async (c) => {
  const body = await c.req.parseBody();
  const image = body.image;
  if (!(image instanceof File)) {
    return c.json({ error: 'Expected an image file in the "image" form field.' }, 400);
  }

  if (image.size === 0) {
    return c.json({ error: "Image file is empty." }, 400);
  }

  if (image.size > MAX_IMAGE_BYTES) {
    return c.json({ error: "Image must be 20 MB or smaller." }, 400);
  }

  if (!isSupportedImage(image)) {
    return c.json({ error: "Image must be JPEG, PNG, or TIFF." }, 400);
  }

  try {
    const text = await kraken.recognize(new Uint8Array(await image.arrayBuffer()));
    return c.json({ text }, 200);
  } catch (error) {
    if (error instanceof KrakenError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }
});

function isSupportedImage(image: File): boolean {
  if (IMAGE_TYPES.has(image.type)) return true;
  if (image.type && image.type !== "application/octet-stream") return false;
  return IMAGE_EXTENSIONS.test(image.name);
}

serve(
  {
    fetch: app.fetch,
    port: 8080,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
