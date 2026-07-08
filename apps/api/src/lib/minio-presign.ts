import { Client } from 'minio';
import { env } from '../env';

// Presigned URLs embed the client's endpoint and the V4 signature covers the
// Host header, so they must be generated against the endpoint the browser
// will hit — not the internal one (e.g. host.docker.internal inside Docker).
export const minioPresign = new Client({
  endPoint: env.MINIO_PUBLIC_ENDPOINT ?? env.MINIO_ENDPOINT,
  port: env.MINIO_PUBLIC_PORT,
  useSSL: env.MINIO_PUBLIC_USE_SSL ?? false,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});
