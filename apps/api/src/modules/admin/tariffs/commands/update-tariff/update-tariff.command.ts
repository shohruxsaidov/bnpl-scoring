export interface UpdateTariffInput {
  id: number
  data: Partial<{
    name: string
    termMonths: number
    markupPercent: string
    minAmount: number | null
    maxAmount: number | null
    active: boolean
  }>
}
