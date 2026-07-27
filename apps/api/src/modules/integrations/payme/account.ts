import { eq } from 'drizzle-orm';
import type { db } from '@db';
import { deals } from '@db/deals';
import {
  getRemainingDebt,
  MIN_PAYMENT_SOM,
  PAYABLE_DEAL_STATUSES,
} from '../../deals/payments/apply-payment';
import { paymeErrors } from './errors';
import type { PaymeAccount } from './protocol';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Smallest payment we accept.
 * @deprecated the floor is not Payme's — import `MIN_PAYMENT_SOM` from
 * deals/payments/apply-payment. Kept as an alias so existing call sites and the
 * client deals route keep reading the one value.
 */
export const PAYME_MIN_PAYMENT_SOM = MIN_PAYMENT_SOM;

/** A deal carries debt only in these states. */
const PAYABLE_STATUSES = PAYABLE_DEAL_STATUSES;

export interface ResolvedAccount {
  dealId: string;
  dealNumber: number;
  userId: number | null;
  /** Som still owed, read inside the caller's transaction. */
  remaining: number;
}

/**
 * Turn `params.account` into a payable deal, or throw the account error that
 * explains why not.
 *
 * This runs on every method, not just CheckPerformTransaction: a deal can be
 * settled by an admin between Check and Perform, and Perform must refuse rather
 * than book money against a closed contract.
 *
 * The caller is expected to hold a row lock on the deal already (lockDeal) when
 * it intends to write.
 */
export async function resolveAccount(tx: Tx, account: PaymeAccount): Promise<ResolvedAccount> {
  const raw = account?.deal_number;
  if (raw === undefined || raw === null || raw === '') throw paymeErrors.dealNotFound();

  // Payme sends account values as strings even when the field is numeric. Reject
  // anything that is not a clean integer rather than letting Number() coerce
  // " 1042 " or "1042abc" into a real deal.
  const parsed = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(parsed) || parsed <= 0) throw paymeErrors.dealNotFound();

  const rows = await tx
    .select({
      id: deals.id,
      dealNumber: deals.dealNumber,
      userId: deals.userId,
      status: deals.status,
    })
    .from(deals)
    .where(eq(deals.dealNumber, parsed))
    .limit(1);

  const deal = rows[0];
  if (!deal) throw paymeErrors.dealNotFound();

  if (deal.status === 'closed') throw paymeErrors.dealSettled();
  if (!PAYABLE_STATUSES.has(deal.status)) throw paymeErrors.dealNotActive();

  const remaining = await getRemainingDebt(tx, deal.id);
  // Defensive: an active deal with no unpaid instalments is a bug elsewhere, but
  // accepting money against it would be a worse one.
  if (remaining <= 0) throw paymeErrors.dealSettled();

  return {
    dealId: deal.id,
    dealNumber: deal.dealNumber,
    userId: deal.userId,
    remaining,
  };
}

/**
 * The amount bound: at least the minimum, at most the remaining debt.
 *
 * Enforced at Check AND at Perform. Between them the payer sits on a confirm
 * screen for as long as they like while an admin can record an MIB payment that
 * shrinks the debt underneath them. Accepting the stale amount would overpay a
 * contract with no credit balance to absorb it and no reversal to undo it.
 */
export function assertAmountAcceptable(amountSom: number | null, remaining: number): number {
  if (amountSom === null) throw paymeErrors.invalidAmount();
  if (amountSom < PAYME_MIN_PAYMENT_SOM) throw paymeErrors.invalidAmount();
  if (amountSom > remaining) throw paymeErrors.invalidAmount();
  return amountSom;
}
