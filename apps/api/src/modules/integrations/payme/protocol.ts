import type { PaymeMessage } from './errors';

// ---------------------------------------------------------------------------
// Wire shapes for the Payme Merchant API (JSON-RPC 2.0 over a single endpoint).
//
// Money on this wire is TIYIN. Money in the ledger is SOM. The conversion
// happens here at the boundary and nowhere else — see toSom().
// ---------------------------------------------------------------------------

export const PAYME_METHODS = [
  'CheckPerformTransaction',
  'CreateTransaction',
  'PerformTransaction',
  'CancelTransaction',
  'CheckTransaction',
  'GetStatement',
] as const;

export type PaymeMethod = (typeof PAYME_METHODS)[number];

export interface PaymeRequest {
  method: string;
  params: Record<string, unknown>;
  id?: number | string | null;
}

export interface PaymeErrorBody {
  code: number;
  message: PaymeMessage;
  data?: string;
}

export type PaymeResponse =
  | { jsonrpc: '2.0'; id: number | string | null; result: unknown }
  | { jsonrpc: '2.0'; id: number | string | null; error: PaymeErrorBody };

/** The account object we declare in the Payme cabinet: exactly one field. */
export interface PaymeAccount {
  deal_number?: string | number;
}

/**
 * Tiyin → som.
 *
 * Rejects any amount that is not a whole number of som. Payme's minimum unit is
 * the tiyin but ours is the som (numeric 15,2 across every money column), and
 * silently rounding a stray tiyin would put a rounding error inside a debt
 * balance — a place where it eventually shows up as a contract that cannot be
 * closed because it is 0.01 short.
 */
export function toSom(amountTiyin: number): number | null {
  if (!Number.isInteger(amountTiyin) || amountTiyin <= 0) return null;
  if (amountTiyin % 100 !== 0) return null;
  return amountTiyin / 100;
}

/** Som → tiyin, for building checkout links. */
export function toTiyin(amountSom: number): number {
  return Math.round(amountSom * 100);
}
