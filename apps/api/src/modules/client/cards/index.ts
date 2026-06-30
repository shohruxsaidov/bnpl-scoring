import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@db';
import { userCards, users } from '@db/schema';
import { addCard } from '../../integrations/plumgate/commands/add-card/add-card.handler';
import { confirmCard } from '../../integrations/plumgate/commands/confirm-card/confirm-card.handler';
import { deleteCard } from '../../integrations/plumgate/commands/delete-card/delete-card.handler';

// Client (mobile) card management. user_cards is the local source of truth for the
// card list; Plumgate is the rail for OTP add + remote delete. Reads never hit
// Plumgate. Authenticated by the client JWT — user id comes from request.user.sub.

function toCardDto(c: typeof userCards.$inferSelect) {
  return {
    id: c.id.toString(),
    maskedPan: c.maskedPan,
    holderName: c.holderName,
    expiry: c.expiry,
    pcType: c.pcType,
    bank: c.pcType === 'humo' ? 'Humo' : 'Uzcard',
  };
}

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

  /* ── GET /client/cards — list the user's saved cards ──────────────────── */

  fastify.get('/', { schema: { tags: TAGS }, preHandler: guards }, async (request) => {
    const userId = Number(request.user.sub);
    const rows = await db
      .select()
      .from(userCards)
      .where(eq(userCards.userId, userId))
      .orderBy(desc(userCards.createdAt));
    return { cards: rows.map(toCardDto) };
  });

  /* ── POST /client/cards — initiate add (sends Plumgate OTP) ───────────── */

  fastify.post(
    '/',
    { schema: { tags: TAGS, body: AddCardBody }, preHandler: guards },
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
    { schema: { tags: TAGS, body: ConfirmCardBody }, preHandler: guards },
    async (request, reply) => {
      const userId = Number(request.user.sub);
      const { sessionId, otp } = request.body;

      const card = await confirmCard({ sessionId, otp });

      // Re-adding the same card is idempotent (unique on user_id + plum_id).
      await db
        .insert(userCards)
        .values({
          userId,
          plumId: card.id,
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
    { schema: { tags: TAGS, params: IdParams }, preHandler: guards },
    async (request, reply) => {
      const userId = Number(request.user.sub);
      const id = Number(request.params.id);

      const [row] = await db
        .select()
        .from(userCards)
        .where(and(eq(userCards.id, id), eq(userCards.userId, userId)))
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
