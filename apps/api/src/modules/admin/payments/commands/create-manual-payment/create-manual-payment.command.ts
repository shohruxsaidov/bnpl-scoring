export interface CreateManualPaymentInput {
  dealId: string;
  adminUserId: number;
  amount: number;
  paymentType: string;
  /**
   * Value date, `YYYY-MM-DD` — the day the money moved per the statement. Bounded
   * to [deal.createdAt, today] by the handler, which needs the deal row to know
   * the floor and so is the only place that can enforce it.
   */
  paymentDate: string;
  note?: string;
}

/**
 * The value date is outside the window in which this deal could have been paid.
 * A future date claims money that has not arrived; a date before the deal existed
 * is a typo (usually the wrong year). Both would stamp `paidAt` with a lie.
 */
export class InvalidPaymentDateError extends Error {
  readonly code = 'INVALID_PAYMENT_DATE';
  readonly statusCode = 400;
  constructor(
    readonly paymentDate: string,
    readonly earliest: string,
    readonly latest: string,
  ) {
    super(`payment date ${paymentDate} is outside [${earliest}, ${latest}]`);
    this.name = 'InvalidPaymentDateError';
  }
}
