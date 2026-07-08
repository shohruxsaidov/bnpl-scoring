import fp from 'fastify-plugin';
import { Client } from 'minio';
import type { FastifyInstance } from 'fastify';
import { env } from '../env';

declare module 'fastify' {
  interface FastifyInstance {
    minio: Client;
    minioPresignedPut(objectName: string, expirySeconds?: number): Promise<string>;
  }
}

export default fp(async function minioPlugin(app: FastifyInstance) {
  const minioPresign = new Client({
    endPoint: env.MINIO_PUBLIC_ENDPOINT ?? env.MINIO_ENDPOINT,
    port: env.MINIO_PUBLIC_PORT ?? undefined,
    useSSL: env.MINIO_PUBLIC_USE_SSL ?? false,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
  });

  const client = new Client({
    endPoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    useSSL: false,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
  });

  const bucket = env.MINIO_BUCKET;

  const exists = await client.bucketExists(bucket);
  if (!exists) await client.makeBucket(bucket);

  app.decorate('minio', client);
  app.decorate('minioPresignedPut', (objectName: string, expirySeconds = 300) =>
    minioPresign.presignedPutObject(bucket, objectName, expirySeconds),
  );
});
