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
import { listCards } from '../../integrations/plumgate/queries/list-cards/list-cards.handler';

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
  },
  {
    examples: [
      {
        id: '77',
        maskedPan: '8600 **** **** 1234',
        holderName: 'ALISHER KARIMOV',
        expiry: '08/27',
        pcType: 'uzcard',
      },
    ],
  },
);

export default async function clientScoringCardsRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const TAGS = ['Client · Scoring'];
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
        description: "Returns the authenticated client's saved cards, newest first.",
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
            pcType: item.pcType,
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
        description:
          'Registers the card at Plumgate and triggers an OTP SMS. Returns the ' +
          'session id to pass to POST /confirm along with the code.',
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
        description: 'Verifies the Plumgate OTP and persists the card. Idempotent per card.',
        security: SECURITY,
        body: ConfirmCardBody,
        response: { 200: Type.Object({ card: Card }), 401: ERROR, 500: ERROR },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      const userId = Number(request.user.sub);
      const { sessionId, otp } = request.body;

      const card = await confirmCard({ sessionId, otp: otp.toLowerCase() });

      // Re-adding the same card is idempotent (unique on user_id + plum_id).
      // Both Plumgate ids are stored: plumId (the attachment) is what deleteUserCard
      // takes, plumCardId (the card in My Uzcard) is what the scoring rail takes.
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
        description:
          'Removes the card at Plumgate, then locally. A remote 404 is treated as already-removed.',
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

      return { ok: true };
    },
  );
}
