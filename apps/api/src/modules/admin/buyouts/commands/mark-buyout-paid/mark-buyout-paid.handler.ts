import { and, eq } from 'drizzle-orm';
import { db } from '@db';
import { buyouts, deals, dealItems } from '../../../../deals/schema';
import { merchants, branches, merchantUsers, users, adminUsers } from '@db/schema';
import { recordFile, getDownloadUrl } from '../../../../../lib/file-storage';
import type { BuyoutDto } from '../../queries/list-buyouts/list-buyouts.handler';

function formatDealNumber(n: number | null | undefined): string {
  return n != null ? String(n) : '—';
}

export interface MarkBuyoutPaidInput {
  id: number;
  adminId: number;
  document: { objectKey: string; mimeType: string; originalName?: string };
}

export type MarkBuyoutPaidResult =
  | { status: 'ok'; buyout: BuyoutDto }
  | { status: 'not_found' }
  | { status: 'already_paid' };

// Thrown to abort the transaction (and undo the files insert) when the buyout
// turns out not to be payable. Caught below and mapped to a result — it never
// escapes this module.
class NotPayableError extends Error {
  constructor(readonly reason: 'not_found' | 'already_paid') {
    super(reason);
  }
}

export async function markBuyoutPaid(input: MarkBuyoutPaidInput): Promise<MarkBuyoutPaidResult> {
  // Record the document and flip the status together. The `pending` guard makes
  // the transition one-shot: a paid buyout's document can never be replaced —
  // and its predecessor orphaned in storage — by a second click.
  try {
    await db.transaction(async (tx) => {
      const file = await recordFile(tx, {
        objectKey: input.document.objectKey,
        mimeType: input.document.mimeType,
        originalName: input.document.originalName,
        uploadedByType: 'admin',
        uploadedById: input.adminId,
      });

      const [updated] = await tx
        .update(buyouts)
        .set({
          status: 'paid',
          documentFileId: file.id,
          paidAt: new Date(),
          paidBy: input.adminId,
        })
        .where(and(eq(buyouts.id, input.id), eq(buyouts.status, 'pending')))
        .returning();

      if (updated) return;

      // The guard missed: either no such buyout, or it is already paid (possibly
      // by a concurrent request that won the race).
      const [existing] = await tx
        .select({ id: buyouts.id })
        .from(buyouts)
        .where(eq(buyouts.id, input.id))
        .limit(1);
      throw new NotPayableError(existing ? 'already_paid' : 'not_found');
    });
  } catch (err) {
    if (err instanceof NotPayableError) return { status: err.reason };
    throw err;
  }

  const rows = await db
    .select({
      buyout: buyouts,
      deal: { dealNumber: deals.dealNumber },
      merchant: { id: merchants.id, name: merchants.name },
      branch: { name: branches.name },
      agent: { fullName: merchantUsers.fullName },
      client: { firstName: users.firstName, lastName: users.lastName, phone: users.phone },
      paidByName: adminUsers.fullName,
    })
    .from(buyouts)
    .leftJoin(deals, eq(buyouts.dealId, deals.id))
    .leftJoin(merchants, eq(buyouts.merchantId, merchants.id))
    .leftJoin(branches, eq(buyouts.branchId, branches.id))
    .leftJoin(merchantUsers, eq(deals.agentId, merchantUsers.id))
    .leftJoin(users, eq(deals.userId, users.id))
    .leftJoin(adminUsers, eq(buyouts.paidBy, adminUsers.id))
    .where(eq(buyouts.id, input.id))
    .limit(1);

  const r = rows[0];
  if (!r) return { status: 'not_found' };

  const itemRows = await db.select().from(dealItems).where(eq(dealItems.dealId, r.buyout.dealId));

  return {
    status: 'ok',
    buyout: {
      id: String(r.buyout.id),
      dealId: r.buyout.dealId,
      dealNumber: formatDealNumber(r.deal?.dealNumber ?? null),
      merchantId: String(r.buyout.merchantId),
      merchantName: r.merchant?.name ?? '—',
      branchName: r.branch?.name ?? '—',
      agentName: r.agent?.fullName ?? '—',
      clientName: r.client ? `${r.client.lastName} ${r.client.firstName}` : '—',
      clientPhone: r.client?.phone ?? '—',
      amount: Number(r.buyout.amount),
      status: r.buyout.status,
      createdAt: r.buyout.createdAt.toISOString(),
      documentUrl: r.buyout.documentFileId
        ? await getDownloadUrl(db, r.buyout.documentFileId)
        : null,
      paidAt: r.buyout.paidAt?.toISOString() ?? null,
      paidByName: r.paidByName ?? null,
      items: itemRows.map((i) => {
        const price = parseFloat(i.price);
        return { productName: i.productName, price, qty: i.quantity, amount: price * i.quantity };
      }),
    },
  };
}
