import { Hono } from "hono";
import { loadBurials } from "./data/burials.js";
import { loadBurialsFromSupabase } from "./data/supabase.js";
import { adminRoutes, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME } from "./routes/admin.js";
import { burialRoutes } from "./routes/burials.js";

/** Builds the API app. Records come from Supabase when SUPABASE_URL and SUPABASE_KEY are set, else from data/*.csv. */
export async function createApp() {
  const app = new Hono();

  app.get("/", (c) => {
    return c.text("Hello Hono!");
  });

  const { SUPABASE_URL, SUPABASE_KEY, ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  const useSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);
  const repository = useSupabase ? await loadBurialsFromSupabase(SUPABASE_URL!, SUPABASE_KEY!) : await loadBurials();
  console.log(`Burial data source: ${useSupabase ? "Supabase" : "CSV files"}`);

  app.route("/api", burialRoutes(repository));
  app.route(
    "/api/admin",
    adminRoutes(repository, {
      username: ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME,
      password: ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,
      persistent: useSupabase,
    }),
  );

  return app;
}
