export interface CreateReceiptCommand {
  products: {
    price: string; // 1000.00 1k,
    name: string;
    vat: string;
    vatPercent: number;
    amount: number;
    classCode: string;
    packageCode: string;
    label?: string; // для маркировок
  }[];
}
