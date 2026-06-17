import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Client as MinioClient } from 'minio';
import type { Db } from '../../db';
import { env } from '../../env';
import { minioPresign } from '../minio-presign';
import { files } from './schema';

const PRESIGNED_PUT_EXPIRY = 300;
const PRESIGNED_GET_EXPIRY = 86400;

export type { FileRecord } from './schema';

export async function createUploadUrl(params: {
  prefix: string;
  expirySeconds?: number;
}): Promise<{ uploadUrl: string; objectKey: string }> {
  const objectKey = `${params.prefix}/${randomUUID()}`;
  const uploadUrl = await minioPresign.presignedPutObject(
    env.MINIO_BUCKET,
    objectKey,
    params.expirySeconds ?? PRESIGNED_PUT_EXPIRY,
  );
  return { uploadUrl, objectKey };
}

export async function recordFile(
  db: Db,
  params: {
    objectKey: string;
    mimeType?: string;
    originalName?: string;
    uploadedByType: 'admin' | 'merchant_user' | 'system';
    uploadedById?: number;
  },
) {
  const [row] = await db
    .insert(files)
    .values({
      objectKey: params.objectKey,
      bucket: env.MINIO_BUCKET,
      mimeType: params.mimeType,
      originalName: params.originalName,
      uploadedByType: params.uploadedByType,
      uploadedById: params.uploadedById,
    })
    .returning();
  return row!;
}

export async function getDownloadUrl(
  db: Db,
  fileId: number,
  expirySeconds = PRESIGNED_GET_EXPIRY,
): Promise<string> {
  const [row] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  if (!row) throw new Error(`File ${fileId} not found`);
  return minioPresign.presignedGetObject(row.bucket, row.objectKey, expirySeconds);
}

export async function deleteFile(db: Db, minio: MinioClient, fileId: number): Promise<void> {
  const [row] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  if (!row) return;
  await minio.removeObject(row.bucket, row.objectKey);
  await db.delete(files).where(eq(files.id, fileId));
}
