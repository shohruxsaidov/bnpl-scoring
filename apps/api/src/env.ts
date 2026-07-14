import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  SESSION_EXPIRES_DAYS: z.coerce.number().default(30),
  MYID_API_BASE_URL: z.string().url(),
  MYID_MOBILE_API_BASE_URL: z.string().url(),
  MYID_WEB_REDIRECT_URL: z.string().url().optional(),
  MERCHANT_PORTAL_URL: z.string().url(),
  // This API's own internet-reachable origin. Used to build absolute URLs handed
  // to clients that are not same-origin (the mobile app renders merchant logos
  // from these). Must be set in every deployed environment — the localhost
  // default only serves local dev.
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  MYID_WEB_SIGN_REDIRECT_URI: z.string().url().optional(),
  MYID_WEB_CLIENT_ID: z.string().optional(),
  MYID_WEB_CLIENT_SECRET: z.string().optional(),
  MYID_MOBILE_CLIENT_ID: z.string(),
  MYID_MOBILE_CLIENT_SECRET: z.string(),
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.coerce.boolean().default(false),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_REGION: z.string().default('garage'),
  MINIO_BUCKET: z.string().default('scoring-documents'),
  // Browser-reachable endpoint for presigned URLs; falls back to MINIO_ENDPOINT
  MINIO_PUBLIC_ENDPOINT: z.string().optional(),
  MINIO_PUBLIC_PORT: z.coerce.number().optional(),
  MINIO_PUBLIC_USE_SSL: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  MXIK_API_URL: z.string().url().default('https://utilities.thebetacompany.uz'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  // PlumGate card integration
  PLUM_BASE_URL: z.string().url().default('https://pay.myuzcard.uz/api'),
  PLUM_LOGIN: z.string().optional(),
  PLUM_PASSWORD: z.string().optional(),
  PLUM_TIMEOUT: z.coerce.number().default(15_000),
  PLUM_TEMPLATE_ID: z.coerce.number().default(123),
  // Card-behaviour scoring (plum_card pipeline). The Uzcard rail is async —
  // createScoringCard returns a scoringId and scoringGetPoint 404s until the
  // vendor has computed the template. Humo answers inline and never polls.
  PLUM_POLL_INTERVAL_MS: z.coerce.number().default(10_000),
  PLUM_POLL_MAX_ATTEMPTS: z.coerce.number().default(12),
  // KATM credit bureau — Retail API (ADR-0025).
  // NB: the vendor PDF's TEST/PROD labels are swapped — testapi.* is the test env.
  KATM_BASE_URL: z.string().url(),
  KATM_LOGIN: z.string().optional(),
  KATM_PASSWORD: z.string().optional(),
  KATM_CODE: z.string().optional(), // pCode — org code assigned by KATM
  KATM_HEAD: z.string().optional(), // pHead — head org code (retail = 'RET')
  KATM_REPORT_ID: z.coerce.number().default(77), // pReportId — InfoScore 077
  // Feature flag: run report 315 (MIB — Бюро принудительного исполнения) as a
  // knockout before the chargeable 077. Default off so the extra chargeable call
  // is enabled deliberately after test-env verification. Explicit 'true'/'false'
  // (z.coerce.boolean would treat the string 'false' as true).
  KATM_POLL_INTERVAL_MS: z.coerce.number().default(1_000),
  KATM_POLL_MAX_ATTEMPTS: z.coerce.number().default(15),
  KATM_TIMEOUT: z.coerce.number().default(10_000),
  // Firebase Cloud Messaging — base64 of the service-account JSON. Optional:
  // when unset, push soft-degrades (inbox rows still written; worker no-ops with
  // a warn). See src/lib/firebase.ts.
  FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().optional(),
  LOKI_URL: z.string().url().optional(),
  OTEL_TRACES_ENDPOINT: z.string().url().optional(),
  OTEL_METRICS_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default('scoring-api'),
  AUTO_PAY_BASE_URL: z.string().url(),
  AUTO_PAY_TOKEN: z.string(),
  RABBIT_CONNECTION_URL: z.string().url(),
});

export const env = schema.parse(process.env);
