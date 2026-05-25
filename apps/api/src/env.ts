import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("15m"),
  SESSION_EXPIRES_DAYS: z.coerce.number().default(30),
  MYID_WEB_BASE_URL: z.string().url().optional(),
  MYID_WEB_IFRAME_URL: z.string().url().optional(),
  MYID_WEB_CLIENT_ID: z.string().optional(),
  MYID_WEB_CLIENT_SECRET: z.string().optional(),
  MINIO_ENDPOINT: z.string().default("localhost"),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.coerce.boolean().default(false),
  MINIO_ACCESS_KEY: z.string().default("minioadmin"),
  MINIO_SECRET_KEY: z.string().default("minioadmin"),
  MINIO_BUCKET: z.string().default("scoring-documents"),
});

export const env = schema.parse(process.env);
