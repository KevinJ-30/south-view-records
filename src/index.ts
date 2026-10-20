import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { loadBurials } from "./data/burials.js";
import { loadBurialsFromSupabase } from "./data/supabase.js";
import { burialRoutes } from "./routes/burials.js";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

const { SUPABASE_URL, SUPABASE_KEY } = process.env;
const repository =
  SUPABASE_URL && SUPABASE_KEY ? await loadBurialsFromSupabase(SUPABASE_URL, SUPABASE_KEY) : await loadBurials();
console.log(`Burial data source: ${SUPABASE_URL && SUPABASE_KEY ? "Supabase" : "CSV files"}`);

app.route("/api", burialRoutes(repository));

serve(
  {
    fetch: app.fetch,
    port: 8080,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
