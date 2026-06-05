import { and, asc, desc, eq } from 'drizzle-orm'
import type { Client as MinioClient } from 'minio'
import type { Db } from '../../../db'
import { deals, dealItems, dealPaymentSchedules, scoringHistories, buyouts, dealDocuments } from '../../deals/db/schema'
import { clients, tariffs, merchantUsers, merchants, branches, products } from '../../id/db/schema'
import { generateContract, type ContractData } from './pdf'
import { env } from '../../../env'
import { recordFile, deleteFile } from '../../../lib/file-storage'
import { files } from '../../../lib/file-storage/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateDealInput {
  merchantId: bigint
  branchId: bigint
  agentId: bigint
  clientId: bigint
  tariffId: bigint
  basket: Array<{
    productId: bigint
    productName: string
    price: string // decimal string e.g. "1500000.00"
    mxikCode: string | null
    packageCode: number | null
    packageName: string | null
    quantity: number
  }>
  paymentDay: number
  /** Tiyin */
  amount: bigint
  /** Tiyin */
  totalPayable: bigint
  termMonths: number
  markupPercent: number
  scoreSum: number | null
  scoringDecision: string | null
  // Full scoring snapshot — persisted to scoring_histories
  coefficient?: number | null
  /** Tiyin */
  platformCreditLimit?: bigint | null
  criteriaScores?: Record<string, number> | null
  /** Existing scoring_histories.id to link to this deal (recorded at scoring time) */
  scoringId?: bigint | null
  lang: 'ru' | 'uz'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeBigInt(v: bigint | null | undefined): string | null {
  return v == null ? null : v.toString()
}

function toDealDto(
  d: typeof deals.$inferSelect,
  c: typeof clients.$inferSelect | null,
  t: typeof tariffs.$inferSelect | null,
  agentName: string,
) {
  return {
    id: d.id,
    status: d.status,
    createdAt: d.createdAt.toISOString(),
    paymentDay: d.paymentDay,
    amount: d.amount != null ? Number(d.amount) : 0,
    totalPayable: d.totalPayable != null ? Number(d.totalPayable) : 0,
    termMonths: d.termMonths ?? t?.termMonths ?? 0,
    lang: (d.lang ?? 'ru') as 'ru' | 'uz',
    agentId: serializeBigInt(d.agentId),
    agentName,
    // client
    clientId: serializeBigInt(d.clientId),
    clientName: c ? `${c.firstName} ${c.lastName}` : null,
    clientPinfl: c?.pinfl ?? null,
    clientPhone: c?.phone ?? null,
    clientPassportSerial: c?.passportSerial ?? null,
    clientPassportNumber: c?.passportNumber ?? null,
    // tariff
    tariffId: serializeBigInt(d.tariffId),
    tariffName: t?.name ?? null,
    // scoring
    scoreSum: d.scoreSum != null ? Number(d.scoreSum) : null,
    scoringDecision: d.scoringDecision ?? null,
  }
}

// ---------------------------------------------------------------------------
// Resolve products + create deal in one call (used by the route handler)
// ---------------------------------------------------------------------------

export interface ResolveAndCreateDealInput {
  merchantId: bigint
  branchId: bigint
  agentId: bigint
  clientId: bigint
  tariffId: bigint
  basket: Array<{ productId: string; quantity: number }>
  paymentDay: number
  scoreSum: number | null
  scoringDecision: string | null
  coefficient?: number | null
  /** Tiyin */
  platformCreditLimit?: bigint | null
  criteriaScores?: Record<string, number> | null
  scoringId?: bigint | null
  lang: 'ru' | 'uz'
}

export async function resolveAndCreateDeal(db: Db, input: ResolveAndCreateDealInput) {
  const [tariff] = await db.select().from(tariffs).where(eq(tariffs.id, input.tariffId)).limit(1)
  if (!tariff) throw Object.assign(new Error('tariff_not_found'), { code: 'tariff_not_found' })

  const productIds = input.basket.map((i) => BigInt(i.productId))
  const productRows = await Promise.all(
    productIds.map((id) => db.select().from(products).where(eq(products.id, id)).limit(1)),
  )

  let amount = BigInt(0)
  const resolvedBasket = input.basket.map((item, idx) => {
    const p = productRows[idx]?.[0]
    if (!p) throw Object.assign(new Error(`product_not_found:${item.productId}`), { code: 'product_not_found' })
    const itemTotal = BigInt(Math.round(parseFloat(p.price) * 100)) * BigInt(item.quantity)
    amount += itemTotal
    return {
      productId: p.id,
      productName: p.name,
      price: p.price,
      mxikCode: p.mxikCode ?? null,
      packageCode: p.packageCode ?? null,
      packageName: p.packageName ?? null,
      quantity: item.quantity,
    }
  })

  const markupPercent = parseFloat(tariff.markupPercent)
  const totalPayable = BigInt(Math.round(Number(amount) * (1 + markupPercent / 100)))

  return createDeal(db, {
    merchantId: input.merchantId,
    branchId: input.branchId,
    agentId: input.agentId,
    clientId: input.clientId,
    tariffId: input.tariffId,
    basket: resolvedBasket,
    paymentDay: input.paymentDay,
    amount,
    totalPayable,
    termMonths: tariff.termMonths,
    markupPercent,
    scoreSum: input.scoreSum,
    scoringDecision: input.scoringDecision,
    coefficient: input.coefficient ?? null,
    platformCreditLimit: input.platformCreditLimit ?? null,
    criteriaScores: input.criteriaScores ?? null,
    scoringId: input.scoringId ?? null,
    lang: input.lang,
  })
}

// ---------------------------------------------------------------------------
// Create deal (low-level — basket already resolved)
// ---------------------------------------------------------------------------

export async function createDeal(db: Db, input: CreateDealInput) {
  return db.transaction(async (tx) => {
    const [deal] = await tx
      .insert(deals)
      .values({
        merchantId: input.merchantId,
        branchId: input.branchId,
        agentId: input.agentId,
        clientId: input.clientId,
        tariffId: input.tariffId,
        paymentDay: input.paymentDay,
        amount: input.amount,
        totalPayable: input.totalPayable,
        termMonths: input.termMonths,
        scoreSum: input.scoreSum?.toString() ?? null,
        scoringDecision: input.scoringDecision ?? null,
        lang: input.lang,
        status: 'active',
      })
      .returning()

    if (!deal) throw new Error('deal_insert_failed')

    if (input.basket.length > 0) {
      await tx.insert(dealItems).values(
        input.basket.map((item) => ({
          dealId: deal.id,
          productId: item.productId,
          productName: item.productName,
          price: item.price,
          mxikCode: item.mxikCode,
          packageCode: item.packageCode,
          packageName: item.packageName,
          quantity: item.quantity,
        })),
      )
    }

    const monthlyRaw = Number(input.totalPayable) / input.termMonths
    const monthly = Math.round(monthlyRaw)
    const lastMonthly = Number(input.totalPayable) - monthly * (input.termMonths - 1)

    const now = new Date()
    const scheduleRows = Array.from({ length: input.termMonths }, (_, i) => {
      const due = new Date(now.getFullYear(), now.getMonth() + i + 1, input.paymentDay)
      const amount = i === input.termMonths - 1 ? lastMonthly : monthly
      return {
        dealId: deal.id,
        index: i + 1,
        dueDate: due.toISOString().slice(0, 10),
        amount: BigInt(amount),
        paid: false,
      }
    })

    await tx.insert(dealPaymentSchedules).values(scheduleRows)

    // Scoring is normally recorded earlier (the moment it completes) with a NULL
    // deal_id. If we have that row's id, link it to this deal. Otherwise fall back
    // to inserting a snapshot now, when enough scoring data is present.
    if (input.scoringDecision != null && input.platformCreditLimit != null && input.scoringId == null) {
      const [clientSnap] = await tx
        .select({
          firstName: clients.firstName,
          lastName: clients.lastName,
          middleName: clients.middleName,
          passportNumber: clients.passportNumber,
          passportSerial: clients.passportSerial,
          pinfl: clients.pinfl,
          phone: clients.phone,
        })
        .from(clients)
        .where(eq(clients.id, input.clientId))
        .limit(1)
      await tx.insert(scoringHistories).values({
        firstName: clientSnap?.firstName ?? null,
        lastName: clientSnap?.lastName ?? null,
        middleName: clientSnap?.middleName ?? null,
        passportNumber: clientSnap?.passportNumber ?? null,
        passportSeries: clientSnap?.passportSerial ?? null,
        pinfl: clientSnap?.pinfl ?? null,
        phoneNumber: clientSnap?.phone ?? null,
        criteriaScores: input.criteriaScores ?? null,
        scoreSum: input.scoreSum?.toString() ?? null,
        coefficient: input.coefficient != null ? input.coefficient.toString() : null,
        decision: input.scoringDecision,
        platformCreditLimit: input.platformCreditLimit,
      })
    }

    await tx.insert(buyouts).values({
      dealId: deal.id,
      merchantId: input.merchantId,
      branchId: input.branchId,
      amount: input.amount,
    })

    return deal
  })
}

// ---------------------------------------------------------------------------
// List deals
// ---------------------------------------------------------------------------

export async function listDeals(
  db: Db,
  merchantId: bigint,
  agentId?: bigint,
  sort?: { sortBy?: string; sortOrder?: string },
) {
  const filter = agentId
    ? and(eq(deals.merchantId, merchantId), eq(deals.agentId, agentId))
    : eq(deals.merchantId, merchantId)

  const dir = sort?.sortOrder === 'asc' ? asc : desc
  const orderCol =
    sort?.sortBy === 'status' ? deals.status :
    sort?.sortBy === 'amount' ? deals.totalPayable :
    deals.createdAt

  const rows = await db
    .select({
      deal: deals,
      client: clients,
      tariff: tariffs,
      agent: merchantUsers,
    })
    .from(deals)
    .leftJoin(clients, eq(deals.clientId, clients.id))
    .leftJoin(tariffs, eq(deals.tariffId, tariffs.id))
    .leftJoin(merchantUsers, eq(deals.agentId, merchantUsers.id))
    .where(filter)
    .orderBy(dir(orderCol))

  return rows
    .filter((r) => r.deal.status !== 'draft')
    .map((r) => toDealDto(r.deal, r.client, r.tariff, r.agent?.fullName ?? ''))
}

// ---------------------------------------------------------------------------
// Get deal by ID  (includes basket + schedule + branch/merchant for PDF)
// ---------------------------------------------------------------------------

export async function getDealById(db: Db, id: string, merchantId: bigint) {
  const rows = await db
    .select({
      deal: deals,
      client: clients,
      tariff: tariffs,
      agent: merchantUsers,
      branch: branches,
      merchant: merchants,
    })
    .from(deals)
    .leftJoin(clients, eq(deals.clientId, clients.id))
    .leftJoin(tariffs, eq(deals.tariffId, tariffs.id))
    .leftJoin(merchantUsers, eq(deals.agentId, merchantUsers.id))
    .leftJoin(branches, eq(deals.branchId, branches.id))
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .where(and(eq(deals.id, id), eq(deals.merchantId, merchantId)))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const base = toDealDto(row.deal, row.client, row.tariff, row.agent?.fullName ?? '')

  const [items, schedule] = await Promise.all([
    db.select().from(dealItems).where(eq(dealItems.dealId, id)).orderBy(dealItems.id),
    db
      .select()
      .from(dealPaymentSchedules)
      .where(eq(dealPaymentSchedules.dealId, id))
      .orderBy(dealPaymentSchedules.index),
  ])

  return {
    ...base,
    branchName: row.branch?.name ?? null,
    merchantInn: row.merchant?.inn ?? null,
    basket: items.map((item) => ({
      productId: serializeBigInt(item.productId),
      productName: item.productName,
      price: item.price,
      mxikCode: item.mxikCode,
      packageCode: item.packageCode,
      packageName: item.packageName,
      quantity: item.quantity,
    })),
    schedule: schedule.map((s) => ({
      index: s.index,
      dueDate: s.dueDate,
      amount: Number(s.amount),
      paid: s.paid,
      paidAt: s.paidAt?.toISOString() ?? null,
    })),
  }
}

// ---------------------------------------------------------------------------
// Get or generate Kontrakt PDF — returns a 24-hour presigned GET URL
// ---------------------------------------------------------------------------

export async function getContractPdfUrl(
  db: Db,
  minio: MinioClient,
  dealId: string,
  merchantId: bigint,
): Promise<string> {
  const deal = await getDealById(db, dealId, merchantId)
  if (!deal) throw Object.assign(new Error('deal_not_found'), { statusCode: 404 })

  const bucket = env.MINIO_BUCKET

  // Return cached presigned URL if the file still exists in MinIO
  const [existingDoc] = await db
    .select({ fileId: dealDocuments.fileId })
    .from(dealDocuments)
    .where(and(eq(dealDocuments.dealId, dealId), eq(dealDocuments.documentType, 'contract')))
    .limit(1)

  if (existingDoc) {
    const [fileRow] = await db.select().from(files).where(eq(files.id, existingDoc.fileId)).limit(1)
    if (fileRow) {
      try {
        await minio.statObject(fileRow.bucket, fileRow.objectKey)
        return minio.presignedGetObject(fileRow.bucket, fileRow.objectKey, 86400)
      } catch {
        // File gone from MinIO — delete stale record and regenerate
        await deleteFile(db, minio, existingDoc.fileId)
        await db
          .delete(dealDocuments)
          .where(and(eq(dealDocuments.dealId, dealId), eq(dealDocuments.documentType, 'contract')))
      }
    }
  }

  const contractData: ContractData = {
    dealId: deal.id,
    createdAt: new Date(deal.createdAt),
    clientFullName: deal.clientName ?? '—',
    clientPinfl: deal.clientPinfl ?? '—',
    clientPassport:
      deal.clientPassportSerial && deal.clientPassportNumber
        ? `${deal.clientPassportSerial} ${deal.clientPassportNumber}`
        : '—',
    agentName: deal.agentName,
    branchName: deal.branchName ?? '—',
    merchantInn: deal.merchantInn ?? '—',
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
    'Content-Type': 'application/pdf',
  })

  const fileRecord = await recordFile(db, {
    objectKey,
    mimeType: 'application/pdf',
    originalName: `${dealId}.pdf`,
    uploadedByType: 'system',
  })

  await db
    .insert(dealDocuments)
    .values({ dealId, fileId: fileRecord.id, documentType: 'contract' })

  return minio.presignedGetObject(bucket, objectKey, 86400)
}
