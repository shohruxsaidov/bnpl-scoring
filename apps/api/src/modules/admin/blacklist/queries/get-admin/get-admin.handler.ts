import { eq } from 'drizzle-orm';
import { db } from '@db';
import { adminUsers } from '@db/schema';

export async function getAdminById(id: number) {
  const [row] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  return row;
}
