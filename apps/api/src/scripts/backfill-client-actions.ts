import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { asc, inArray } from 'drizzle-orm';
import { clientActions } from '@db/client-actions';
import { dealSessions } from '@db/deal-sessions';
import { scorings } from '@db/scorings';
import { userCards } from '@db/user-cards';
import { users } from '@db/users';

// ---------------------------------------------------------------------------
// Reconstruct client_actions for clients who existed before the table did.
//
// Without this, the Действия tab ships EMPTY for every client anyone actually
// gets support calls about, and only fills for people who happen to do something
// new. Run once after db:migrate:
//
//     npm run backfill:client-actions
//
// Idempotent — every row carries a dedupe key and inserts ON CONFLICT DO NOTHING,
// so re-running is free and a half-finished run can simply be repeated.
//
// WHAT CANNOT BE RECONSTRUCTED, and why you should stop looking for the writer:
//
//   deal_sign_myid / deal_sign_otp / deal_sign_reject — GONE, permanently. The
//   proofs only ever lived in deal_sessions.step_data.signing, which
//   rejectSigningRequest deletes outright and a re-scan overwrites; `deals` never
//   copied them. For any historical deal there is no record of when the client
//   face-scanned or gave the акцепт, and no way to derive one. Signing history
//   therefore starts on the day this feature shipped. Deals closed before then
//   will show card and scoring rows with a signing-shaped hole between them —
//   that is the truth about what was recorded, not a bug in this script.
//
//   registration failures — never existed. They happen before the users row, so
//   there is nothing to key them to (see the note in db/client-actions.ts).
//
// EVERY ROW THIS WRITES IS INFERRED, not observed, and is marked as such:
// actor_type is 'system' throughout. That is deliberate for card_add above all —
// cards have three call sites, two of them the client in their app and one an
// AGENT typing at a counter, and user_cards keeps no discriminator. Claiming the
// client added a card an employee may have added would be inventing evidence.
// The admin tab tells these rows apart by created_at being far later than
// occurred_at, so no flag column is needed.
// ---------------------------------------------------------------------------

const client = postgres(process.env['DATABASE_URL']!);
const db = drizzle(client);

async function main() {
  let registrations = 0;
  let cards = 0;
  let scoringRuns = 0;

  // ── registration ── users.created_at is the account's birth, and unambiguous.
  const userRows = await db
    .select({ id: users.id, createdAt: users.createdAt })
    .from(users)
    .orderBy(asc(users.id));

  for (const u of userRows) {
    const inserted = await db
      .insert(clientActions)
      .values({
        userId: u.id,
        action: 'registration',
        status: 'success',
        actorType: 'system',
        occurredAt: u.createdAt,
        dedupeKey: `registration:${u.id}`,
      })
      .onConflictDoNothing({ target: clientActions.dedupeKey })
      .returning({ id: clientActions.id });
    if (inserted.length > 0) registrations++;
  }

  // ── card_add ── only cards the client still holds. A card added and later
  // removed left no trace to reconstruct, so old deletions stay invisible.
  const cardRows = await db
    .select({ id: userCards.id, userId: userCards.userId, createdAt: userCards.createdAt })
    .from(userCards)
    .orderBy(asc(userCards.id));

  for (const c of cardRows) {
    const inserted = await db
      .insert(clientActions)
      .values({
        userId: c.userId,
        action: 'card_add',
        status: 'success',
        actorType: 'system',
        userCardId: c.id,
        occurredAt: c.createdAt,
        dedupeKey: `card_add:${c.id}`,
      })
      .onConflictDoNothing({ target: clientActions.dedupeKey })
      .returning({ id: clientActions.id });
    if (inserted.length > 0) cards++;
  }

  // ── scoring ── terminal runs only; anything still in_progress or merely
  // 'passed' has not reached a verdict and gets its row from the live writer.
  const scoringRows = await db
    .select({
      id: scorings.id,
      userId: scorings.userId,
      dealSessionId: scorings.dealSessionId,
      status: scorings.status,
      rejectReasonCode: scorings.rejectReasonCode,
      updatedAt: scorings.updatedAt,
    })
    .from(scorings)
    .where(inArray(scorings.status, ['scored', 'rejected', 'error']))
    .orderBy(asc(scorings.id));

  // Merchant runs are attributed to the Agent who drove the wizard where the
  // session survives — the one piece of actor detail that IS recoverable.
  const sessionIds = scoringRows.map((s) => s.dealSessionId).filter((v): v is string => !!v);
  const sessions = sessionIds.length
    ? await db
        .select({
          id: dealSessions.id,
          agentId: dealSessions.agentId,
          merchantId: dealSessions.merchantId,
        })
        .from(dealSessions)
        .where(inArray(dealSessions.id, sessionIds))
    : [];
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  for (const s of scoringRows) {
    if (!s.userId) continue; // client-keyed table; a run with no client has no page
    const session = s.dealSessionId ? sessionById.get(s.dealSessionId) : undefined;
    const inserted = await db
      .insert(clientActions)
      .values({
        userId: s.userId,
        action: 'scoring',
        status: s.status === 'scored' ? 'success' : 'failed',
        reasonCode: s.status === 'error' ? 'scoring_error' : s.rejectReasonCode,
        actorType: 'system',
        actorId: session?.agentId ?? null,
        merchantId: session?.merchantId ?? null,
        scoringId: s.id,
        dealSessionId: s.dealSessionId,
        occurredAt: s.updatedAt,
        dedupeKey: `scoring:${s.id}`,
      })
      .onConflictDoNothing({ target: clientActions.dedupeKey })
      .returning({ id: clientActions.id });
    if (inserted.length > 0) scoringRuns++;
  }

  console.log(
    `[backfill-client-actions] inserted registration=${registrations} card_add=${cards} scoring=${scoringRuns}`,
  );
  console.log('[backfill-client-actions] signing history is NOT recoverable — see file header');
}

main()
  .catch((err) => {
    console.error('[backfill-client-actions] failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
