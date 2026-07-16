/**
 * Installment math shared by deal creation and the Tariff Calculator quote.
 * A quote shown to a client must match the schedule a real Deal with the
 * same amount and tariff would generate, so both paths go through here.
 * All amounts are in som (2-decimal precision; instalment rows are whole som).
 */

export function calcTotalPayable(amount: number, markupPercent: number): number {
  return Math.round(Number(amount) * (1 + markupPercent / 100) * 100) / 100
}

/**
 * Equal monthly installments in whole so'm; the first month absorbs the
 * rounding remainder, so the rows always add up to the total payable.
 */
export function splitInstallments(totalPayable: number, termMonths: number): number[] {
  const monthly = Math.floor(Number(totalPayable) / termMonths)
  const first = Math.round((Number(totalPayable) - monthly * (termMonths - 1)) * 100) / 100
  return Array.from({ length: termMonths }, (_, i) => (i === 0 ? first : monthly))
}
