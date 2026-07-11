export interface UpdateMerchantCommand {
  id: number
  patch: Partial<{
    name: string
    legalName: string
    inn: string
    phone: string
    address: string
    contractNumber: string
    active: boolean
    mfo: string
    accountNumber: string
    bankName: string
    scoringModelId: number | null
  }>
}
