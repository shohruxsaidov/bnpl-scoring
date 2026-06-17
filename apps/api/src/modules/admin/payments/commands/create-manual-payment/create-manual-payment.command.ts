export interface CreateManualPaymentInput {
  dealId: string;
  adminUserId: number;
  amount: number;
  paymentType: string;
  note?: string;
}
