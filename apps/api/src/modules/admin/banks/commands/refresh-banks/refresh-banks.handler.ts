import { type BankEntry, fetchFromCbu, populateCache } from "../../queries/list-banks/list-banks.handler"

export async function refreshBankList(): Promise<BankEntry[]> {
  const entries = await fetchFromCbu()
  await populateCache(entries)
  return entries
}
