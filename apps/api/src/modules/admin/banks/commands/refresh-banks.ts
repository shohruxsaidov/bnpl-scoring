import type { Db } from "../../../../db"
import { type BankEntry, fetchFromCbu, populateCache } from "../queries/list-banks"

export async function refreshBankList(db: Db): Promise<BankEntry[]> {
  const entries = await fetchFromCbu()
  await populateCache(db, entries)
  return entries
}
