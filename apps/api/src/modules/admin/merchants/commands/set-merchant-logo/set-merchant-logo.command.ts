export interface SetMerchantLogoCommand {
  merchantId: number
  objectKey: string
  mimeType: string
  originalName?: string
  uploadedByAdminId: number
}
