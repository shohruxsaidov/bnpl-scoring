/**
 * Installment math shared by deal creation and the Tariff Calculator quote.
 * A quote shown to a client must match the schedule a real Deal with the
 * same amount and tariff would generate, so both paths go through here.
 * All amounts are integer tiyin.
 */

export function calcTotalPayable(amount: bigint, markupPercent: number): bigint {
  return BigInt(Math.round(Number(amount) * (1 + markupPercent / 100)))
}

/**
 * Equal monthly installments in whole so'm (multiples of 100 tiyin); the
 * first month absorbs the rounding remainder, so the displayed rows always
 * add up to the total payable.
 */
export function splitInstallments(totalPayable: bigint, termMonths: number): number[] {
  const monthly = Math.floor(Number(totalPayable) / termMonths / 100) * 100
  const first = Number(totalPayable) - monthly * (termMonths - 1)
  return Array.from({ length: termMonths }, (_, i) => (i === 0 ? first : monthly))
}
