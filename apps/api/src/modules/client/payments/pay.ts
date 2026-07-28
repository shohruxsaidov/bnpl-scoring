import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { MIN_PAYMENT_SOM } from '../../deals/payments/apply-payment';
import { confirmPlumPayment, initiatePlumPayment } from './pay.service';

// ---------------------------------------------------------------------------
// Client card payments — POST /client/payments and POST /client/payments/confirm.
//
// Shares the /client/payments prefix with the read-only history in ./index.ts but
// kept in its own plugin: that file answers "what have I paid", this one moves
// money, and the two have nothing in common but a URL.
//
// The shape is the same OTP handshake as POST /client/cards + /confirm. What is
// different, and worth reading pay.service.ts before touching, is that the
// confirm step is irreversible — so the confirm BODY carries no deal and no
// amount. Both are read from the session row written in step one. A client can
// choose what to pay only once, and only before an OTP exists.
// ---------------------------------------------------------------------------

const SECURITY = [{ clientAuth: [] }];
const ERROR = { $ref: 'ErrorResponse#' };

export default async function clientPayRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const TAGS = ['Client · Payments'];
  const guards = [app.verifyClientJwt];

  const InitiateBody = Type.Object({
    dealId: Type.String({ format: 'uuid' }),
    // The `id` from GET /client/cards — Plumgate's attachment id, the same one
    // DELETE /client/cards/:id takes.
    cardId: Type.String({ minLength: 1 }),
    /** In som. The real ceiling is the deal's remaining debt; the handler enforces it. */
    amount: Type.Number({ minimum: MIN_PAYMENT_SOM }),
  });

  const InitiateResponse = Type.Object(
    {
      // Plum's session handle. Opaque to the app — pass it back verbatim.
      sessionId: Type.Integer(),
      otpSentPhone: Type.String(),
      /** In som — what will be charged if the OTP is confirmed. */
      amount: Type.Number(),
    },
    { examples: [{ sessionId: 8812, otpSentPhone: '998 ** *** 45 67', amount: 500000 }] },
  );

  const ConfirmBody = Type.Object({
    sessionId: Type.Integer(),
    otp: Type.String({ minLength: 4, maxLength: 8, examples: ['1234'] }),
  });

  const ConfirmResponse = Type.Object(
    {
      paymentId: Type.Union([Type.String(), Type.Null()]),
      /** In som. */
      amount: Type.Number(),
      /** Debt left on the credit after this payment. Null when booking is still pending. */
      remainingDebt: Type.Union([Type.Number(), Type.Null()]),
      dealClosed: Type.Boolean(),
      // False means the card WAS charged but the money is not yet allocated —
      // a support case, not a client error. The app should show the payment as
      // accepted and the balance as not-yet-updated.
      booked: Type.Boolean(),
    },
    {
      examples: [
        {
          paymentId: '4021',
          amount: 500000,
          remainingDebt: 1200000,
          dealClosed: false,
          booked: true,
        },
      ],
    },
  );

  /* ── POST /client/payments — initiate (sends the Plumgate OTP) ─────────── */

  fastify.post(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'Pay a credit from a saved card (initiate)',
        security: SECURITY,
        body: InitiateBody,
        response: { 200: InitiateResponse, 400: ERROR, 401: ERROR, 404: ERROR, 409: ERROR },
      },
      preHandler: guards,
    },
    async (request) => {
      const res = await initiatePlumPayment({
        userId: Number(request.user.sub),
        dealId: request.body.dealId,
        cardId: request.body.cardId,
        amount: request.body.amount,
      });

      return res;
    },
  );

  /* ── POST /client/payments/confirm — verify OTP, charge, book ──────────── */

  fastify.post(
    '/confirm',
    {
      schema: {
        tags: TAGS,
        summary: 'Pay a credit from a saved card (confirm OTP)',
        security: SECURITY,
        body: ConfirmBody,
        response: { 200: ConfirmResponse, 400: ERROR, 401: ERROR, 404: ERROR, 409: ERROR },
      },
      preHandler: guards,
    },
    async (request) => {
      const result = await confirmPlumPayment({
        userId: Number(request.user.sub),
        sessionId: request.body.sessionId,
        otp: request.body.otp,
      });
      return {
        ...result,
        // Stringified like every other id on the client surface.
        paymentId: result.paymentId != null ? String(result.paymentId) : null,
      };
    },
  );
}
