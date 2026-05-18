import { defineConfig } from "drizzle-kit";
export default defineConfig({
    schema: "./src/schema.ts",
    out: "./migrations",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL ??
            "postgresql://scoring:changeme@localhost:5432/scoring",
    },
    verbose: true,
    strict: true,
});
//# sourceMappingURL=drizzle.config.js.map