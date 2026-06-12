import type { DealPaymentSchedule } from '@/types'

/**
 * Client-side preview of the instalment schedule shown at the To'lov kuni and
 * Верификация steps. Amounts are in tiyin: instalments are whole so'm
 * (multiples of 100) with the rounding remainder in the first payment, so the
 * rows always add up to the displayed total. The server computes its own
 * schedule at deal creation — this is display-only.
 */
export function buildSchedulePreview(
  totalPayable: number,
  months: number,
  selectedDay: number,
): DealPaymentSchedule[] {
  if (months < 1 || selectedDay < 1) return []

  const perMonth = Math.floor(totalPayable / months / 100) * 100
  const firstMonth = totalPayable - perMonth * (months - 1)
  const rows: DealPaymentSchedule[] = []
  const today = new Date()

  let firstPayment: Date
  const diff = selectedDay - today.getDate()
  if (diff < 1 || diff < 15) {
    firstPayment = new Date(today.getFullYear(), today.getMonth() + 1, selectedDay)
  } else {
    firstPayment = new Date(today.getFullYear(), today.getMonth(), selectedDay)
  }

  for (let i = 0; i < months; i++) {
    const d =
      i === 0
        ? firstPayment
        : new Date(firstPayment.getFullYear(), firstPayment.getMonth() + i, selectedDay)
    const amount = i === 0 ? firstMonth : perMonth
    rows.push({ index: i + 1, dueDate: d.toISOString(), amount, paid: false, paidAt: null })
  }
  return rows
}
