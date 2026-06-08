import type { Client as MinioClient } from "minio"
import { and, eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { deals as dealsTable, dealDocuments } from "../../../deals/db/schema"
import { env } from "../../../../env"
import { recordFile, deleteFile } from "../../../../lib/file-storage"
import { files } from "../../../../lib/file-storage/schema"
import { generateContract, type ContractData } from "../pdf"
import { getDealById } from "./get-deal"

export async function getContractPdfUrl(
  db: Db,
  minio: MinioClient,
  dealId: string,
  merchantId: bigint,
): Promise<string> {
  const deal = await getDealById(db, dealId, merchantId)
  if (!deal) throw Object.assign(new Error("deal_not_found"), { statusCode: 404 })

  const bucket = env.MINIO_BUCKET

  const [existingDoc] = await db
    .select({ fileId: dealDocuments.fileId })
    .from(dealDocuments)
    .where(and(eq(dealDocuments.dealId, dealId), eq(dealDocuments.documentType, "contract")))
    .limit(1)

  if (existingDoc) {
    const [fileRow] = await db.select().from(files).where(eq(files.id, existingDoc.fileId)).limit(1)
    if (fileRow) {
      try {
        await minio.statObject(fileRow.bucket, fileRow.objectKey)
        return minio.presignedGetObject(fileRow.bucket, fileRow.objectKey, 86400)
      } catch {
        await deleteFile(db, minio, existingDoc.fileId)
        await db
          .delete(dealDocuments)
          .where(and(eq(dealDocuments.dealId, dealId), eq(dealDocuments.documentType, "contract")))
      }
    }
  }

  const contractData: ContractData = {
    dealId: deal.id,
    createdAt: new Date(deal.createdAt),
    clientFullName: deal.clientName ?? "—",
    clientPinfl: deal.clientPinfl ?? "—",
    clientPassport:
      deal.clientPassportSerial && deal.clientPassportNumber
        ? `${deal.clientPassportSerial} ${deal.clientPassportNumber}`
        : "—",
    agentName: deal.agentName,
    branchName: deal.branchName ?? "—",
    merchantInn: deal.merchantInn ?? "—",
    amount: deal.amount,
    totalPayable: deal.totalPayable,
    termMonths: deal.termMonths,
    paymentDay: deal.paymentDay ?? 5,
    basket: deal.basket.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      price: Math.round(parseFloat(item.price) * 100),
    })),
    schedule: deal.schedule.map((s) => ({
      index: s.index,
      dueDate: s.dueDate,
      amount: s.amount,
    })),
  }

  const pdfBuffer = await generateContract(contractData, deal.lang)

  const objectKey = `contracts/${dealId}.pdf`
  await minio.putObject(bucket, objectKey, pdfBuffer, pdfBuffer.length, {
    "Content-Type": "application/pdf",
  })

  const fileRecord = await recordFile(db, {
    objectKey,
    mimeType: "application/pdf",
    originalName: `${dealId}.pdf`,
    uploadedByType: "system",
  })

  await db
    .insert(dealDocuments)
    .values({ dealId, fileId: fileRecord.id, documentType: "contract" })

  return minio.presignedGetObject(bucket, objectKey, 86400)
}
