import type { DealPaymentSource } from '../../../../deals/schema'

/**
 * Only the value date and the amount are sortable. The register is paginated
 * server-side, so anything the client could sort would sort one page and look
 * like it sorted the register.
 */
export type PaymentSortBy = 'paymentDate' | 'amount'

export interface ListPaymentsFilters {
  merchantId?: number
  source?: DealPaymentSource
  /** Value-date lower bound, inclusive, `YYYY-MM-DD`. */
  dateFrom?: string
  /** Value-date upper bound, inclusive, `YYYY-MM-DD`. */
  dateTo?: string
  /** Free text: client name, phone, or a deal-number prefix. */
  q?: string
  /** Zero-based page index. */
  page?: number
  limit?: number
  sortBy?: PaymentSortBy
  sortDir?: 'asc' | 'desc'
}
