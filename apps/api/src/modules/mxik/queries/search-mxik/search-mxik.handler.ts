import { ilike, or } from 'drizzle-orm'
import { db } from '@db'
import { mxikCache } from '@db/schema'
import type { MxikEntry } from '../lookup-mxik/lookup-mxik.handler'

export async function searchMxik(q: string): Promise<MxikEntry[]> {
  const rows = await db
    .select()
    .from(mxikCache)
    .where(or(ilike(mxikCache.mxikName, `%${q}%`), ilike(mxikCache.mxikCode, `${q}%`)))
    .limit(20)

  return rows.map((r) => ({
    mxikCode: r.mxikCode,
    mxikName: r.mxikName,
    label: r.label ?? 0,
    brandName: r.brandName,
    groupName: r.groupName,
    className: r.className,
    packages: r.packages as unknown[] | null,
  }))
}
