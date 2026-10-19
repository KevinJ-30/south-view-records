import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { loadBurials } from "./data/burials.js";
import { burialRoutes } from "./routes/burials.js";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.route("/api", burialRoutes(await loadBurials()));

serve(
  {
    fetch: app.fetch,
    port: 8080,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
