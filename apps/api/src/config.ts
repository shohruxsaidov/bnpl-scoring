/** Centralised, validated environment configuration. */

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? "0.0.0.0",
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required(
    "DATABASE_URL",
    "postgresql://scoring:changeme@localhost:5432/scoring",
  ),
  jwtSecret: required("JWT_SECRET", "dev-insecure-secret-change-me"),
} as const;

export type AppConfig = typeof config;
