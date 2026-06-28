export interface CreateProductInput {
  merchantId: number
  categoryId: number
  name: string
  price: string
  mxikCode?: string
  packageCode?: number
  packageName?: string
  isLabeled?: boolean
}
