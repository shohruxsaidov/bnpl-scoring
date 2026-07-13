import { db, type Db } from '@db';
import { users } from '@db/users';
import { eq, sql } from 'drizzle-orm';

// Accepts an optional executor so callers can create the user inside an existing
// transaction (e.g. client registration inserts the terms acceptance atomically).
// Defaults to the shared db connection.
export async function setUserPhotoHandler(
  { userId, photoId }: { userId: number; photoId: string },
  executor: Pick<Db, 'update'> = db,
) {
  await executor
    .update(users)
    .set({
      photoId,
    })
    .where(sql`${users.id} = ${userId}`);
  return { success: true };
}
