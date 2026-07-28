import { ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch } from '@/utils/apiFetch'

/**
 * The payments register: one row per money-in event against a deal, whatever the
 * rail. Not a schedule — a row exists only once money actually landed, so there
 * is no per-row status. Money that has *not* landed lives in the Payme and Plum
 * session screens.
 *
 * Filtering, sorting and paging all happen server-side: deal_payments only ever
 * grows, so the client never holds the whole set.
 */
export type PaymentSource = 'manual' | 'payme' | 'plum'

export interface Payment {
  id: string
  dealId: string
  dealNumber: string
  merchantId: string
  merchantName: string
  clientName: string
  clientPhone: string
  /** som */
  amount: number
  source: PaymentSource
  paymentType: string
  note: string | null
  /** Null for machine-booked rows — nobody signed off on a Payme or Plum payment. */
  adminName: string | null
  /** Value date, `YYYY-MM-DD` — the day the money moved. */
  paymentDate: string
  /** Booking instant. Diverges from paymentDate exactly when a human backdated. */
  createdAt: string
}

export interface PaymentTotals {
  count: number
  /** som across the whole filtered set, not just the visible page */
  volume: number
  bySource: Record<PaymentSource, number>
}

export interface PaymentFilters {
  merchantId?: string
  source?: PaymentSource
  /** `YYYY-MM-DD` */
  dateFrom?: string
  /** `YYYY-MM-DD` */
  dateTo?: string
  q?: string
  page: number
  limit: number
  sortBy: 'paymentDate' | 'amount'
  sortDir: 'asc' | 'desc'
}

const DEFAULT_FILTERS: PaymentFilters = {
  page: 0,
  limit: 25,
  sortBy: 'paymentDate',
  sortDir: 'desc',
}

const EMPTY_TOTALS: PaymentTotals = {
  count: 0,
  volume: 0,
  bySource: { manual: 0, payme: 0, plum: 0 },
}

export const usePaymentsStore = defineStore('payments', () => {
  const payments = ref<Payment[]>([])
  const total = ref(0)
  const totals = ref<PaymentTotals>({ ...EMPTY_TOTALS })
  const filters = ref<PaymentFilters>({ ...DEFAULT_FILTERS })
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Typing in the search box fires overlapping requests; without this a slow
  // early one can land last and repaint the table with stale rows.
  let requestSeq = 0

  function buildQuery(f: PaymentFilters): string {
    const params = new URLSearchParams()
    if (f.merchantId) params.set('merchantId', f.merchantId)
    if (f.source) params.set('source', f.source)
    if (f.dateFrom) params.set('dateFrom', f.dateFrom)
    if (f.dateTo) params.set('dateTo', f.dateTo)
    if (f.q?.trim()) params.set('q', f.q.trim())
    params.set('page', String(f.page))
    params.set('limit', String(f.limit))
    params.set('sortBy', f.sortBy)
    params.set('sortDir', f.sortDir)
    return params.toString()
  }

  /**
   * Applies `patch` to the active filters and reloads. Any change other than the
   * page itself sends the reader back to page 0 — page 3 of the old filter set
   * is a different, usually empty, slice of the new one.
   */
  async function fetchPayments(patch: Partial<PaymentFilters> = {}): Promise<void> {
    const narrowed = Object.keys(patch).some((k) => k !== 'page')
    filters.value = { ...filters.value, ...patch, ...(narrowed ? { page: patch.page ?? 0 } : {}) }

    const seq = ++requestSeq
    loading.value = true
    error.value = null

    try {
      const data = await apiFetch<{
        payments: Payment[]
        total: number
        totals: PaymentTotals
      }>(`/admin/payments?${buildQuery(filters.value)}`)
      if (seq !== requestSeq) return
      payments.value = data.payments
      total.value = data.total
      totals.value = data.totals
    } catch (err: any) {
      if (seq !== requestSeq) return
      error.value = err?.message ?? 'error'
      payments.value = []
      total.value = 0
      totals.value = { ...EMPTY_TOTALS }
    } finally {
      if (seq === requestSeq) loading.value = false
    }
  }

  function resetFilters(): void {
    filters.value = { ...DEFAULT_FILTERS }
  }

  return { payments, total, totals, filters, loading, error, fetchPayments, resetFilters }
})
