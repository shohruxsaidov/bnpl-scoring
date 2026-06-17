import { sql } from "drizzle-orm"
import type { Db } from "../../../../db"
import { bankMfoCache } from '@db/schema'

export interface BankEntry {
  mfo: string
  bankName: string
}

interface CbuBankEntry {
  Filialkodi: string
  Filialnomi: string
}

const CBU_BANKS_URL = "https://cbu.uz/upload/open_data/0010/4-009-0010_uz.json"

export async function fetchFromCbu(): Promise<BankEntry[]> {
  const res = await fetch(CBU_BANKS_URL, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`CBU fetch failed: ${res.status}`)
  const data: CbuBankEntry[] = await res.json()
  return data
    .filter((e) => /^\d{5}$/.test(e.Filialkodi))
    .map((e) => ({ mfo: e.Filialkodi, bankName: e.Filialnomi }))
}

export async function populateCache(db: Db, entries: BankEntry[]): Promise<void> {
  if (entries.length === 0) return
  await db
    .insert(bankMfoCache)
    .values(entries.map((e) => ({ mfo: e.mfo, bankName: e.bankName })))
    .onConflictDoUpdate({
      target: bankMfoCache.mfo,
      set: { bankName: sql`excluded.bank_name`, fetchedAt: sql`now()` },
    })
}

export async function getBankList(db: Db): Promise<BankEntry[]> {
  const rows = await db.select().from(bankMfoCache).orderBy(bankMfoCache.mfo)
  if (rows.length > 0) return rows.map((r) => ({ mfo: r.mfo, bankName: r.bankName }))
  const entries = await fetchFromCbu()
  await populateCache(db, entries)
  return entries
}
