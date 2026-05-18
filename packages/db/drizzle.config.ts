import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://shohruxsaidov:postgres@localhost:5432/scoring_app",
  },
  verbose: true,
  strict: true,
});
