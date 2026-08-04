import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@db';
import { userCards, users } from '@db/schema';
import { addCard } from '../../integrations/plumgate/commands/add-card/add-card.handler';
import { confirmCard } from '../../integrations/plumgate/commands/confirm-card/confirm-card.handler';
import { deleteCard } from '../../integrations/plumgate/commands/delete-card/delete-card.handler';
import { finalizeClientScoringIfReady } from '../scoring/finalize';
import { recordAction, vendorReasonCode } from '../actions/service';
import {
  listCards,
  PlumCard,
} from '../../integrations/plumgate/queries/list-cards/list-cards.handler';

// Client (mobile) card management. user_cards is the local source of truth for the
// card list; Plumgate is the rail for OTP add + remote delete. Reads never hit
// Plumgate. Authenticated by the client JWT — user id comes from request.user.sub.

function toCardDto(c: typeof userCards.$inferSelect) {
  return {
    id: c.plumId,
    maskedPan: c.maskedPan,
    holderName: c.holderName,
    expiry: c.expiry,
    pcType: c.pcType,
    bank: c.pcType ,
  };
}

const SECURITY = [{ clientAuth: [] }];
const ERROR = { $ref: 'ErrorResponse#' };

// Mirrors toCardDto(): bigint id is emitted as a string. The full-object
// `examples` entry is what Swagger UI renders as the sample response body.
const Card = Type.Object(
  {
    id: Type.Number(),
    maskedPan: Type.String(),
    holderName: Type.Union([Type.String(), Type.Null()]),
    expiry: Type.String(),
    pcType: Type.String(),
    bank: Type.String(),
  },
  {
    examples: [
      {
        id: '77',
        maskedPan: '8600 **** **** 1234',
        holderName: 'ALISHER KARIMOV',
        expiry: '08/27',
        pcType: 'uzcard',
        bank: 'Uzcard',
      },
    ],
  },
);

export default async function clientCardsRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const TAGS = ['Client · Cards'];
  const guards = [app.verifyClientJwt];

  const AddCardBody = Type.Object({
    cardNumber: Type.String({ minLength: 16, maxLength: 19, examples: ['8600123412341234'] }),
    expiry: Type.String({ minLength: 4, maxLength: 5, examples: ['08/27'] }),
  });
  const ConfirmCardBody = Type.Object({
    sessionId: Type.String({ minLength: 1 }),
    otp: Type.String({ minLength: 4, maxLength: 8, examples: ['1234'] }),
  });
  const IdParams = Type.Object({ id: Type.String({ pattern: '^\\d+$' }) });

  const AddCardResponse = Type.Object(
    { sessionId: Type.String(), maskedPhone: Type.String() },
    { examples: [{ sessionId: 'ps_9f3a1c2b', maskedPhone: '998 ** *** 45 67' }] },
  );
  const OkResponse = Type.Object({ ok: Type.Boolean() }, { examples: [{ ok: true }] });

  /* ── GET /client/cards — list the user's saved cards ──────────────────── */

  fastify.get(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'List cards',
        security: SECURITY,
        response: { 200: Type.Object({ cards: Type.Array(Card) }), 401: ERROR },
      },
      preHandler: guards,
    },
    async (request) => {
      const cards = await listCards(request.user.sub).catch(() => {
        return [];
      });

      return {
        cards: cards.map((item) => {
          return {
            id: item.id,
            maskedPan: item.maskedPan,
            holderName: item.holderName,
            expiry: item.expiry,
            pcType: 'Uzcard',
            bank: '',
          };
        }),
      };
    },
  );

  /* ── POST /client/cards — initiate add (sends Plumgate OTP) ───────────── */

  fastify.post(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'Add card (initiate)',
        security: SECURITY,
        body: AddCardBody,
        response: { 200: AddCardResponse, 401: ERROR, 404: ERROR },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      const userId = Number(request.user.sub);
      const [user] = await db
        .select({ id: users.id, phone: users.phone })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!user) return reply.code(404).sendError('user_not_found');

      const { cardNumber, expiry } = request.body;
      const result = await addCard({
        userId: String(user.id),
        phone: user.phone,
        cardNumber,
        expiry,
      });
      return result; // { sessionId, maskedPhone }
    },
  );

  /* ── POST /client/cards/confirm — verify OTP and persist the card ─────── */

  fastify.post(
    '/confirm',
    {
      schema: {
        tags: TAGS,
        summary: 'Confirm card (verify OTP)',
        security: SECURITY,
        body: ConfirmCardBody,
        response: { 200: Type.Object({ card: Card }), 401: ERROR, 500: ERROR },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      const userId = Number(request.user.sub);
      const { sessionId, otp } = request.body;

      let card;
      try {
        card = await confirmCard({ sessionId, otp });
      } catch (err) {
        await recordAction({
          userId,
          action: 'card_add',
          status: 'failed',
          reasonCode: vendorReasonCode(err, 'card_confirm_failed'),
          actorType: 'client',
        });
        throw err;
      }

      // Re-adding the same card is idempotent (unique on user_id + plum_id).
      await db
        .insert(userCards)
        .values({
          userId,
          plumId: card.id,
          plumCardId: card.plumCardId,
          maskedPan: card.maskedPan,
          holderName: card.holderName,
          expiry: card.expiry,
          pcType: card.pcType,
        })
        .onConflictDoNothing({ target: [userCards.userId, userCards.plumId] });

      const [row] = await db
        .select()
        .from(userCards)
        .where(and(eq(userCards.userId, userId), eq(userCards.plumId, card.id)))
        .limit(1);
      if (!row) return reply.code(500).sendError('card_persist_failed');

      // Keyed on the card row, so a re-add of a card the client already holds
      // (the insert above is a no-op conflict) does not write a second row.
      await recordAction({
        userId,
        action: 'card_add',
        status: 'success',
        actorType: 'client',
        userCardId: row.id,
        dedupeKey: `card_add:${row.id}`,
      });

      // A run parked at 'awaiting_card' has cleared KATM and is waiting for
      // exactly this. Adding the card is what opens the plum_card stage and, in
      // turn, the model. Best-effort: the card was added either way.
      await finalizeClientScoringIfReady(userId).catch((err) =>
        request.log.warn({ err, userId }, 'post-card scoring advance failed'),
      );

      return { card: toCardDto(row) };
    },
  );

  /* ── DELETE /client/cards/:id — remove at Plumgate, then locally ──────── */

  fastify.delete(
    '/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Delete card',
        security: SECURITY,
        params: IdParams,
        response: { 200: OkResponse, 401: ERROR, 404: ERROR },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      const userId = Number(request.user.sub);
      const id = Number(request.params.id);

      const [row] = await db
        .select()
        .from(userCards)
        .where(and(eq(userCards.plumId, id), eq(userCards.userId, userId)))
        .limit(1);
      if (!row) return reply.code(404).sendError('card_not_found');

      // Plumgate first — a 404 there is swallowed as already-removed. Any other
      // failure throws and the local row is kept, so the two stay in sync.
      await deleteCard({ id: row.plumId });
      await db.delete(userCards).where(eq(userCards.id, row.id));

      // userCardId is intentionally left null: the row it would point at was
      // just deleted, and the FK is ON DELETE SET NULL anyway. The masked PAN
      // is not copied here — this table records that an action happened, not
      // the card details, and «кто удалил мою карту?» is answered by actorType.
      await recordAction({
        userId,
        action: 'card_delete',
        status: 'success',
        actorType: 'client',
      });

      return { ok: true };
    },
  );
}
