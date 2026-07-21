import { env } from '@env';
import { toTiyin } from './protocol';

// ---------------------------------------------------------------------------
// Checkout links.
//
// Merchant API is inbound-only — Payme never tells us to start anything — so
// getting the payer to Payme is entirely ours. A checkout link is stateless
// string-building: no API call, nothing stored, nothing to reconcile. It
// deep-links into the Payme app when installed and falls back to the web
// checkout when not.
//
// Format: base64 of a `;`-separated parameter string.
//   m  — cashbox id
//   ac.<field> — the account fields we declared in the cabinet (just deal_number)
//   a  — amount in TIYIN
//   l  — interface language
//
// The amount is a SUGGESTION. The payer can edit it on Payme's screen, so
// nothing downstream may treat it as agreed: CheckPerformTransaction is the only
// thing standing between us and a wrong amount.
// ---------------------------------------------------------------------------

export interface CheckoutLinkInput {
  dealNumber: number;
  /** Prefilled amount in som. Omit to let the payer type their own. */
  amountSom?: number | null;
  lang?: 'ru' | 'uz' | 'en';
}

export function buildPaymeCheckoutUrl(input: CheckoutLinkInput): string | null {
  if (!env.PAYME_MERCHANT_ID) return null;

  const parts = [`m=${env.PAYME_MERCHANT_ID}`, `ac.deal_number=${input.dealNumber}`];
  if (input.amountSom && input.amountSom > 0) parts.push(`a=${toTiyin(input.amountSom)}`);
  parts.push(`l=${input.lang ?? 'ru'}`);

  const encoded = Buffer.from(parts.join(';'), 'utf8').toString('base64');
  const base = env.PAYME_CHECKOUT_URL.replace(/\/+$/, '');
  return `${base}/${encoded}`;
}
