export interface UpdateProductCommand {
  id: number
  categoryId?: number
  name?: string
  price?: string
  mxikCode?: string
  packageCode?: number
  packageName?: string
  isLabeled?: boolean
  active?: boolean
}
