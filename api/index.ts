import { handle } from "hono/vercel";
import { createApp } from "../src/app.js";

/** Vercel function for every /api/* request (see the rewrite in vercel.json). */
const app = await createApp();

export const GET = handle(app);
export const POST = handle(app);
