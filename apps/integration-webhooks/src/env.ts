import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  OTEL_SERVICE_NAME: z.string().default('scoring-webhook'),
  LOKI_URL: z.string().url().optional(),
  PORT: z.coerce.number().default(4003),
});

export const env = schema.parse(process.env);
