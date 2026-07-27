export interface MakingPaymentCommand {
  userId: string;
  /**
   * Plumgate's «идентификатор прикрепления» — user_cards.plum_id, the same id
   * DELETE UserCard/deleteUserCard takes. NOT the My Uzcard card id
   * (user_cards.plum_card_id), which is a string and belongs to card scoring.
   */
  cardId: number;
  /**
   * In SOM, not tiyin.
   *
   * Called out because every other money integration here (Payme, KATM) speaks
   * tiyin, so this reads like a bug that wants fixing. It is not — Plumgate takes
   * som and the value is passed through unconverted.
   */
  amount: number;
  /** Our own per-attempt reference; the key that ties a Plum charge back to a session. */
  extraId: string;
  transactionData?: string; // JSON string data
}
