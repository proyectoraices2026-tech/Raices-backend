import { defineConfig } from "drizzle-kit";
import { env } from "./src/env.js";

export default defineConfig({
  schema: "./src/db/indexSchema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});