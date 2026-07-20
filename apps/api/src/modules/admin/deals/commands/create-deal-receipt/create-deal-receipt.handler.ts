import { and, eq } from 'drizzle-orm';
import { db } from '@db';
import { deals, dealItems, dealReceipts } from '../../../../deals/schema';
import { createReceiptHandler } from '../../../../integrations/epos/commands/create-receipt/create-receipt.handler';
import type { CreateReceiptLine } from '../../../../integrations/epos/commands/create-receipt/create-receipt.command';

function coded(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

/** A receipt records a completed sale — never a Deal that was not signed. */
const RECEIPT_ALLOWED_STATUSES = new Set(['active', 'closed']);

/**
 * Issue the fiscal receipt for a Deal via EPOS and record it.
 *
 * Ordering matters and is not incidental: the 'pending' row is inserted BEFORE
 * the EPOS call so the unique index on deal_id — not a disabled button — is
 * what stops a second concurrent request. Issuing a receipt is irreversible
 * and EPOS accepts no idempotency key, so a duplicate would be a duplicate
 * filing with the tax authority that we cannot withdraw.
 *
 * On failure the row is deleted, leaving deal_receipts success-only; the
 * detail is in integration_logs. A row stranded in 'pending' means the process
 * died mid-call and EPOS may hold a receipt we never recorded — that is
 * deliberately left for a human to reconcile rather than auto-retried.
 */
export async function createDealReceipt(dealId: string) {
  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
  if (!deal) throw coded('deal_not_found');
  if (!RECEIPT_ALLOWED_STATUSES.has(deal.status)) throw coded('invalid_deal_status');

  const [existing] = await db
    .select()
    .from(dealReceipts)
    .where(eq(dealReceipts.dealId, dealId))
    .limit(1);
  if (existing) {
    throw coded(existing.status === 'pending' ? 'receipt_pending' : 'receipt_already_exists');
  }

  const items = await db
    .select()
    .from(dealItems)
    .where(eq(dealItems.dealId, dealId))
    .orderBy(dealItems.id);
  if (items.length === 0) throw coded('deal_has_no_items');

  for (const item of items) {
    // A fiscal receipt with a missing ИКПУ is a filing with wrong data in it.
    // Better to refuse and have someone fix the Product than to guess.
    if (!item.mxikCode) throw coded('missing_mxik_code');
    if (item.labels.length > 0 && item.labels.length !== item.quantity) {
      throw coded('label_count_mismatch');
    }
  }

  // The receipt is built from deal_items but the Deal carries its own
  // denormalized total. If the two ever drift, the receipt would state a price
  // the contract does not — refuse rather than pick one.
  const itemsTotal = items.reduce(
    (sum, i) => sum + Math.round(Number(i.price) * 100) * i.quantity,
    0,
  );
  const dealTotal = Math.round((deal.amount ?? 0) * 100);
  if (itemsTotal !== dealTotal) throw coded('amount_mismatch');

  // Labeled products carry one marking code per unit, and EPOS models one
  // label per line — so a labeled line of 3 becomes 3 lines of 1.
  const lines: CreateReceiptLine[] = items.flatMap((item) => {
    const base = {
      price: item.price,
      name: item.productName,
      vatPercent: item.vatPercent,
      ...(item.mxikCode ? { classCode: item.mxikCode } : {}),
      ...(item.packageCode != null ? { packageCode: String(item.packageCode) } : {}),
    };
    if (item.labels.length === 0) return [{ ...base, amount: item.quantity }];
    return item.labels.map((label) => ({ ...base, amount: 1, label }));
  });

  // The existence check above loses a race two operators can both pass, since
  // neither transaction's SELECT sees the other's uncommitted insert. The
  // unique index is what actually decides; translate its violation so the
  // loser gets "already exists" rather than a transport error.
  let pending: typeof dealReceipts.$inferSelect | undefined;
  try {
    [pending] = await db.insert(dealReceipts).values({ dealId, status: 'pending' }).returning();
  } catch (err) {
    if ((err as { code?: string }).code === '23505') throw coded('receipt_already_exists');
    throw err;
  }
  if (!pending) throw coded('receipt_insert_failed');

  let response: Awaited<ReturnType<typeof createReceiptHandler>>;
  try {
    response = await createReceiptHandler({ products: lines });
  } catch (err) {
    await db.delete(dealReceipts).where(eq(dealReceipts.id, pending.id));
    throw err;
  }

  const info = response?.info;
  if (!info?.fiscalSign) {
    // EPOS answered but not with a receipt. Whether one was filed is unknown,
    // so keep the pending row as the marker for manual reconciliation.
    throw coded('receipt_response_invalid');
  }

  const [saved] = await db
    .update(dealReceipts)
    .set({
      status: 'created',
      payload: {
        terminalId: info.terminalId,
        receiptSeq: info.receiptSeq,
        fiscalSign: info.fiscalSign,
        // EPOS returns dateTime / qrCodeURL — renamed here, not aliased.
        datetime: info.dateTime,
        qrCodeUrl: info.qrCodeURL,
      },
      rawResponse: response,
      updatedAt: new Date(),
    })
    .where(and(eq(dealReceipts.id, pending.id), eq(dealReceipts.status, 'pending')))
    .returning();

  return saved ?? null;
}
