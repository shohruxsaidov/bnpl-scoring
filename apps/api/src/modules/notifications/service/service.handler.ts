import { and, desc, eq, lt, ne } from 'drizzle-orm';
import { db } from '@db';
import { notifications } from '../schema';
import { clients, merchantUsers, users } from '@db/schema';
import { ssePush } from '../../../lib/sse';
import { sendPushToEmployee } from '../../push/service/service.handler';
import { sendFcmToUser, type FcmNotificationType } from '../../push/fcm';

export type ActorType = 'employee' | 'client' | 'admin';

export interface CreateNotificationInput {
  actorType: ActorType;
  actorId: number;
  type: string;
  params: Record<string, string>;
}

export function toDto(n: typeof notifications.$inferSelect) {
  return {
    id: n.id,
    type: n.type,
    params: n.params as Record<string, string>,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function createNotification(input: CreateNotificationInput) {
  const [row] = await db
    .insert(notifications)
    .values({
      actorType: input.actorType,
      actorId: input.actorId,
      type: input.type,
      params: input.params,
    })
    .returning();

  if (row) {
    if (input.actorType === 'employee') {
      sendPushToEmployee(input.actorId, toDto(row)).catch(() => {});
      ssePush(input.actorType, input.actorId.toString(), 'notification', toDto(row));
    }
  }

  return row;
}

export async function notifyDealCreated(
  opts: {
    dealId: string;
    agentId: number;
    merchantId: number;
    branchId: number;
    clientId: number;
    amountTiyin: number;
  },
) {
  const [[clientRow], [agentRow], employees] = await Promise.all([
    db
      .select({ firstName: clients.firstName, lastName: clients.lastName })
      .from(clients)
      .where(eq(clients.id, opts.clientId))
      .limit(1),
    db
      .select({ fullName: merchantUsers.fullName })
      .from(merchantUsers)
      .where(eq(merchantUsers.id, opts.agentId))
      .limit(1),
    db
      .select({ id: merchantUsers.id, roles: merchantUsers.roles })
      .from(merchantUsers)
      .where(
        and(
          eq(merchantUsers.merchantId, opts.merchantId),
          eq(merchantUsers.active, true),
          ne(merchantUsers.id, opts.agentId),
        ),
      ),
  ]);

  const clientName = clientRow ? `${clientRow.firstName} ${clientRow.lastName}` : '—';
  const agentName = agentRow?.fullName ?? '—';
  const amountSom = String(Math.round(Number(opts.amountTiyin) / 100));

  const recipients = employees.filter((e) => e.roles.includes('merchant_admin'));

  await Promise.all(
    recipients.map((r) =>
      createNotification({
        actorType: 'employee',
        actorId: r.id,
        type: 'new_deal',
        params: { agentName, dealId: opts.dealId, clientName, amount: amountSom },
      }),
    ),
  );
}

export async function notifyPaymentReceived(
  opts: {
    dealId: string;
    merchantId: number;
    branchId: number;
    clientId: number;
    paidTiyin: number;
    scheduleIndex: number;
    fullyPaid: boolean;
  },
) {
  const [[clientRow], employees] = await Promise.all([
    db
      .select({ firstName: clients.firstName, lastName: clients.lastName })
      .from(clients)
      .where(eq(clients.id, opts.clientId))
      .limit(1),
    db
      .select({ id: merchantUsers.id, roles: merchantUsers.roles })
      .from(merchantUsers)
      .where(and(eq(merchantUsers.merchantId, opts.merchantId), eq(merchantUsers.active, true))),
  ]);

  const clientName = clientRow ? `${clientRow.firstName} ${clientRow.lastName}` : '—';
  const amountSom = String(Math.round(Number(opts.paidTiyin) / 100));

  const recipients = employees.filter((e) => e.roles.includes('merchant_admin'));

  await Promise.all(
    recipients.map((r) =>
      createNotification({
        actorType: 'employee',
        actorId: r.id,
        type: 'payment_received',
        params: {
          dealId: opts.dealId,
          clientName,
          amount: amountSom,
          paymentIndex: String(opts.scheduleIndex + 1),
          fullyPaid: opts.fullyPaid ? 'true' : 'false',
        },
      }),
    ),
  );
}

export async function listNotifications(actorType: ActorType, actorId: number) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.actorType, actorType), eq(notifications.actorId, actorId)))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
}

export async function markOneRead(id: string, actorType: ActorType, actorId: number) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.actorType, actorType),
        eq(notifications.actorId, actorId),
      ),
    );
}

export async function markAllRead(actorType: ActorType, actorId: number) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.actorType, actorType),
        eq(notifications.actorId, actorId),
        eq(notifications.read, false),
      ),
    );
}

export async function deleteRead(actorType: ActorType, actorId: number) {
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.actorType, actorType),
        eq(notifications.actorId, actorId),
        eq(notifications.read, true),
      ),
    );
}

export async function notifyDealDecision(
  opts: {
    dealId: string;
    clientId: number;
    scoringDecision: string | null;
    lang: 'ru' | 'uz';
  },
): Promise<void> {
  if (opts.scoringDecision !== 'approved' && opts.scoringDecision !== 'declined') return;

  const type: FcmNotificationType =
    opts.scoringDecision === 'approved' ? 'deal_approved' : 'deal_declined';

  const [clientRow] = await db
    .select({ pinfl: clients.pinfl })
    .from(clients)
    .where(eq(clients.id, opts.clientId))
    .limit(1);
  if (!clientRow) return;

  const [userRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.pinfl, clientRow.pinfl))
    .limit(1);
  if (!userRow) return; // client hasn't registered on the portal yet

  await createNotification({
    actorType: 'client',
    actorId: userRow.id,
    type,
    params: { dealId: opts.dealId },
  });

  sendFcmToUser(db, userRow.id, type, opts.lang, { dealId: opts.dealId }).catch(() => {});
}

export async function deleteOlderThan(days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  await db.delete(notifications).where(lt(notifications.createdAt, cutoff));
}
