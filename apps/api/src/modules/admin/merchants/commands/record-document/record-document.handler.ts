import { db } from '@db'
import { merchantDocuments } from '@db/schema'
import type { RecordDocumentCommand } from "./record-document.command"

export async function recordDocument(input: RecordDocumentCommand) {
  const [row] = await db.insert(merchantDocuments).values(input).returning()
  return row!
}
