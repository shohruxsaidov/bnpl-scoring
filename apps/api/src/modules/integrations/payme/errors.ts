// ---------------------------------------------------------------------------
// Payme Merchant API error vocabulary.
//
// Two rules govern everything here:
//
//  1. Errors travel in the JSON-RPC `error` object at HTTP 200. A non-200 is a
//     transport failure to Payme and it retries — indefinitely, on a payment it
//     may already consider made.
//  2. `message` is a {ru, uz, en} OBJECT, not a string. Payme renders it to the
//     payer verbatim, so these strings are user-facing copy, not developer text.
//
// Codes -31050..-31099 are the merchant's to define; everything else is fixed by
// the protocol. Each account error carries `data` = the offending field name so
// the checkout form can highlight the input.
// ---------------------------------------------------------------------------

export interface PaymeMessage {
  ru: string;
  uz: string;
  en: string;
}

export const PAYME_ERROR = {
  /** Malformed JSON / unparseable request. */
  INVALID_JSON: -32700,
  /** Anything we failed to classify. Payme treats it as a system fault. */
  INTERNAL: -32400,
  /** Unknown `method`. */
  METHOD_NOT_FOUND: -32601,
  /** Basic auth missing, malformed, or wrong key. */
  UNAUTHORIZED: -32504,
  /** Amount outside what this deal can accept. */
  INVALID_AMOUNT: -31001,
  /** Transaction id unknown to us. */
  TRANSACTION_NOT_FOUND: -31003,
  /** State does not allow the requested operation (incl. the 12h timeout). */
  CANNOT_PERFORM: -31008,
  /** Operation is not reversible — performed transactions are final here. */
  CANNOT_CANCEL: -31007,
  // ── merchant-defined account errors (-31050..-31099) ──────────────────────
  /** No deal carries this deal_number. */
  DEAL_NOT_FOUND: -31050,
  /** The deal exists but carries no debt yet (draft/scoring/approved/declined). */
  DEAL_NOT_ACTIVE: -31051,
  /** The deal is fully settled — there is nothing left to pay. */
  DEAL_SETTLED: -31052,
  /** Another payment for this deal is already awaiting confirmation. */
  DEAL_PENDING_PAYMENT: -31053,
} as const;

export type PaymeErrorCode = (typeof PAYME_ERROR)[keyof typeof PAYME_ERROR];

/**
 * Thrown anywhere inside a Payme method; caught by the dispatcher and rendered
 * into the JSON-RPC `error` object. Never let one escape the route — the global
 * Fastify error handler would answer with a non-200 and trigger retries.
 */
export class PaymeRpcError extends Error {
  constructor(
    readonly code: PaymeErrorCode,
    readonly rpcMessage: PaymeMessage,
    /** Field name for account errors; Payme highlights that input. */
    readonly data?: string,
  ) {
    super(`payme error ${code}: ${rpcMessage.ru}`);
    this.name = 'PaymeRpcError';
  }
}

const ACCOUNT_FIELD = 'deal_number';

export const paymeErrors = {
  unauthorized: () =>
    new PaymeRpcError(PAYME_ERROR.UNAUTHORIZED, {
      ru: 'Недостаточно привилегий для выполнения метода',
      uz: 'Metodni bajarish uchun huquqlar yetarli emas',
      en: 'Insufficient privileges to execute the method',
    }),

  methodNotFound: (method: string) =>
    new PaymeRpcError(
      PAYME_ERROR.METHOD_NOT_FOUND,
      {
        ru: 'Запрошенный метод не найден',
        uz: "So'ralgan metod topilmadi",
        en: 'Requested method not found',
      },
      method,
    ),

  internal: () =>
    new PaymeRpcError(PAYME_ERROR.INTERNAL, {
      ru: 'Внутренняя ошибка сервиса',
      uz: 'Xizmatning ichki xatosi',
      en: 'Internal service error',
    }),

  dealNotFound: () =>
    new PaymeRpcError(
      PAYME_ERROR.DEAL_NOT_FOUND,
      {
        ru: 'Договор с таким номером не найден',
        uz: 'Bunday raqamli shartnoma topilmadi',
        en: 'No contract with this number',
      },
      ACCOUNT_FIELD,
    ),

  dealNotActive: () =>
    new PaymeRpcError(
      PAYME_ERROR.DEAL_NOT_ACTIVE,
      {
        ru: 'Договор ещё не активен — оплата пока невозможна',
        uz: "Shartnoma hali faol emas — to'lov hozircha imkonsiz",
        en: 'Contract is not active yet — payment is not possible',
      },
      ACCOUNT_FIELD,
    ),

  dealSettled: () =>
    new PaymeRpcError(
      PAYME_ERROR.DEAL_SETTLED,
      {
        ru: 'Договор полностью погашен',
        uz: "Shartnoma to'liq to'langan",
        en: 'Contract is fully repaid',
      },
      ACCOUNT_FIELD,
    ),

  dealPendingPayment: () =>
    new PaymeRpcError(
      PAYME_ERROR.DEAL_PENDING_PAYMENT,
      {
        ru: 'По этому договору уже есть платёж в ожидании подтверждения',
        uz: "Ushbu shartnoma bo'yicha tasdiqlanishi kutilayotgan to'lov mavjud",
        en: 'A payment for this contract is already awaiting confirmation',
      },
      ACCOUNT_FIELD,
    ),

  /**
   * Amount rejected. The remaining debt is deliberately NOT put in the message:
   * it is another client's-balance disclosure to whoever typed the deal number,
   * and the deal number is printed on a contract that can be photographed.
   */
  invalidAmount: () =>
    new PaymeRpcError(PAYME_ERROR.INVALID_AMOUNT, {
      ru: 'Неверная сумма платежа',
      uz: "Noto'g'ri to'lov summasi",
      en: 'Invalid payment amount',
    }),

  transactionNotFound: () =>
    new PaymeRpcError(PAYME_ERROR.TRANSACTION_NOT_FOUND, {
      ru: 'Транзакция не найдена',
      uz: 'Tranzaksiya topilmadi',
      en: 'Transaction not found',
    }),

  cannotPerform: () =>
    new PaymeRpcError(PAYME_ERROR.CANNOT_PERFORM, {
      ru: 'Невозможно выполнить операцию',
      uz: 'Amalni bajarib bolmaydi',
      en: 'Unable to perform operation',
    }),

  cannotCancel: () =>
    new PaymeRpcError(PAYME_ERROR.CANNOT_CANCEL, {
      ru: 'Платёж зачислен в счёт погашения договора и не может быть отменён',
      uz: "To'lov shartnomani so'ndirishga o'tkazilgan va bekor qilinmaydi",
      en: 'The payment has been applied to the contract and cannot be cancelled',
    }),
};
