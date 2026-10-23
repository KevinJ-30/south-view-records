import { Hono } from "hono";
import { loadBurials } from "./data/burials.js";
import { loadBurialsFromSupabase } from "./data/supabase.js";
import { burialRoutes } from "./routes/burials.js";

/** Builds the API app. Records come from Supabase when SUPABASE_URL and SUPABASE_KEY are set, else from data/*.csv. */
export async function createApp() {
  const app = new Hono();

  app.get("/", (c) => {
    return c.text("Hello Hono!");
  });

  const { SUPABASE_URL, SUPABASE_KEY } = process.env;
  const repository =
    SUPABASE_URL && SUPABASE_KEY ? await loadBurialsFromSupabase(SUPABASE_URL, SUPABASE_KEY) : await loadBurials();
  console.log(`Burial data source: ${SUPABASE_URL && SUPABASE_KEY ? "Supabase" : "CSV files"}`);

  app.route("/api", burialRoutes(repository));

  return app;
}
