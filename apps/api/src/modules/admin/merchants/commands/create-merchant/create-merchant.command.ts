export interface CreateMerchantCommand {
  name: string
  legalName: string
  inn: string
  phone: string
  address: string
  contractNumber?: string
  scoringModelId?: number
}
