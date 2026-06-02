import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  SESSION_EXPIRES_DAYS: z.coerce.number().default(30),
  MYID_WEB_BASE_URL: z.string().url().optional(),
  MYID_WEB_IFRAME_URL: z.string().url().optional(),
  MERCHANT_PORTAL_URL: z.string().url(),
  CLIENT_PORTAL_URL: z.string().url(),
  MYID_WEB_SIGN_REDIRECT_URI: z.string().url().optional(),
  MYID_WEB_CLIENT_ID: z.string().optional(),
  MYID_WEB_CLIENT_SECRET: z.string().optional(),
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.coerce.boolean().default(false),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_REGION: z.string().default('garage'),
  MINIO_BUCKET: z.string().default('scoring-documents'),
  MXIK_API_URL: z.string().url().default('https://utilities.thebetacompany.uz'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  // PlumGate card integration
  PLUM_BASE_URL: z.string().url().default('https://pay.myuzcard.uz/api'),
  PLUM_LOGIN: z.string().optional(),
  PLUM_PASSWORD: z.string().optional(),
  PLUM_TIMEOUT: z.coerce.number().default(15_000),
  PLUM_TEMPLATE_ID: z.coerce.number().default(123),
  PLUM_MOCK: z.coerce.boolean().default(false),
  // KATM credit bureau
  KATM_BASE_URL: z.string().url().default('https://api.katm.uz'),
  KATM_LOGIN: z.string().optional(),
  KATM_PASSWORD: z.string().optional(),
  KATM_TIMEOUT: z.coerce.number().default(20_000),
  KATM_MOCK: z.coerce.boolean().default(false),
  // Web Push (VAPID) — merchant employee portals
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().default('mailto:admin@finsum.uz'),
  // Firebase Cloud Messaging — client mobile app
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  LOKI_URL: z.string().url().optional(),
  OTEL_TRACES_ENDPOINT: z.string().url().optional(),
  OTEL_METRICS_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default('scoring-api'),
});

export const env = schema.parse(process.env);
