export interface MakingPaymentCommand {
  userId: string;
  cardId: number;
  amount: number;
  extraId: string;
  transactionData?: string; // JSON string data
}
