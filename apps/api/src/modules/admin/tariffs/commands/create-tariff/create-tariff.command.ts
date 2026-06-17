export interface CreateTariffInput {
  name: string
  termMonths: number
  markupPercent: string
  minAmount?: number | null
  maxAmount?: number | null
}
