import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch } from '@/utils/apiFetch'

/**
 * Card payments Plumgate took but we could not allocate.
 *
 * The opposite of the payments register: every row here is money that did NOT
 * land on a deal, which means a client whose balance is wrong right now. It is a
 * worklist, not a report — small, unpaginated, sorted oldest-first, and each row
 * leaves it only when a human either books it or closes it by hand.
 */
export type StuckSessionStatus =
  | 'debited_unbooked'
  | 'needs_refund'
  | 'resolved'
  | 'pending'
  | 'confirming'

export type ResolutionReason = 'refunded_at_plumgate' | 'no_debit_occurred' | 'other'

export interface StuckSession {
  id: string
  userId: number
  /** Null only if the client row vanished — the join is a left join on purpose. */
  clientName: string | null
  clientPhone: string | null
  dealId: string
  dealNumber: string | null
  /** som */
  amount: number
  status: StuckSessionStatus
  /** Plumgate's own transaction id. The key support pastes into a ticket. */
  plumTransactionId: string | null
  failureCode: string | null
  resolutionReason: ResolutionReason | null
  resolutionNote: string | null
  resolvedAt: string | null
  createdAt: string
}

/** The two statuses that mean someone must act. Anything else is history. */
export const ACTIONABLE: StuckSessionStatus[] = ['debited_unbooked', 'needs_refund']

export const useStuckPaymentsStore = defineStore('stuckPayments', () => {
  const sessions = ref<StuckSession[]>([])
  /** Count of actionable rows, independent of the current filter. Feeds the badges. */
  const strandedCount = ref(0)
  const status = ref<StuckSessionStatus | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const actionable = computed(() => sessions.value.filter((s) => ACTIONABLE.includes(s.status)))

  async function fetch(next?: StuckSessionStatus | null): Promise<void> {
    if (next !== undefined) status.value = next
    loading.value = true
    error.value = null
    try {
      const qs = status.value ? `?status=${status.value}` : ''
      const data = await apiFetch<{ sessions: StuckSession[] }>(`/admin/payments/plum/sessions${qs}`)
      sessions.value = data.sessions
    } catch (err: any) {
      error.value = err?.message ?? 'error'
      sessions.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Cheap enough to call from anywhere that wants to show the badge — the nav,
   * the overview tile, a client's page — without pulling the whole list.
   */
  async function fetchCount(): Promise<void> {
    try {
      const data = await apiFetch<{ count: number }>('/admin/payments/plum/sessions/stranded-count')
      strandedCount.value = data.count
    } catch {
      // A badge is not worth an error state; leave the last known number.
    }
  }

  /**
   * Allocate money Plumgate already took. Throws the API's code so the caller
   * can tell the three outcomes apart:
   *   OVERPAYMENT                    — impossible to book, row is now needs_refund
   *   payment_session_not_stranded   — someone else got there first
   *   anything else                  — genuine failure, the row is untouched
   */
  async function book(id: string): Promise<void> {
    await apiFetch(`/admin/payments/plum/sessions/${id}/book`, { method: 'POST' })
    await Promise.all([fetch(), fetchCount()])
  }

  /** Close a row without booking it. Moves no money — see the API for why. */
  async function resolve(id: string, reason: ResolutionReason, note: string): Promise<void> {
    await apiFetch(`/admin/payments/plum/sessions/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ reason, note }),
    })
    await Promise.all([fetch(), fetchCount()])
  }

  return {
    sessions,
    strandedCount,
    status,
    loading,
    error,
    actionable,
    fetch,
    fetchCount,
    book,
    resolve,
  }
})
