export interface CreateProductCommand {
  merchantId: number;
  categoryId: number;
  name: string;
  price: string;
  mxikCode?: string;
  packageCode?: number;
  packageName?: string;
}
