import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@db';
import { userDevices, userSessions } from '@db/schema';
import { recordAction } from '../actions/service';

// ---------------------------------------------------------------------------
// Client app settings — the read model behind the Settings screen, plus the two
// writes that screen performs.
//
// THE SCOPING RULE, and it is the load-bearing one: every lookup here is keyed on
// (deviceId, userId) TOGETHER, never deviceId alone. A device can change hands —
// activateDevice reassigns user_devices.user_id — and the previous owner's access
// token stays valid for its remaining 15 minutes. Keyed on deviceId alone, that
// token could mute the NEW owner's phone. `register-device` already guards this
// way; so does everything below.
//
// WHAT IS NOT HERE: enabling biometric. That needs a fresh SPKI public key out of
// the Secure Enclave, and a boolean carries no key — POST /client/auth/register-
// device owns it and always will. This module reports biometric state and nothing
// more, which is why the resource is read-mostly rather than a writable object.
// ---------------------------------------------------------------------------

/** The caller's own device row, or undefined when the device is not theirs. */
export async function findOwnDevice(deviceId: string, userId: number) {
  const [row] = await db
    .select()
    .from(userDevices)
    .where(and(eq(userDevices.deviceId, deviceId), eq(userDevices.userId, userId)))
    .limit(1);
  return row;
}

export interface DeviceListItem {
  id: string;
  name: string | null;
  platform: 'ios' | 'android';
  appVersion: string;
  /** Trusted for PIN/biometric login (user_devices.activated_at is set). */
  trusted: boolean;
  /** True for the device making the request, which the app must not offer to revoke. */
  current: boolean;
  /** Last time this device minted or refreshed a session. Null if it never has. */
  lastActiveAt: Date | null;
  createdAt: Date;
}

export interface ClientSettings {
  notifications: { pushEnabled: boolean };
  biometric: { enabled: boolean; enrolledAt: Date | null };
  language: 'uz' | 'ru';
  devices: DeviceListItem[];
}

/**
 * Everything the Settings screen renders, in one call.
 *
 * The top-level sections describe THE CALLING DEVICE; `devices` describes the
 * account. That split is not arbitrary — both toggles are per-device facts (there
 * is no such thing as enabling push on a phone you are not holding), so putting
 * them at the top and leaving them out of the array keeps one value in one place.
 *
 * `lastActiveAt` is derived rather than stored: every session refresh revokes its
 * token and INSERTS a replacement (see rotateSession), so the newest
 * user_sessions row per device already is the activity timestamp. A stored
 * last_seen column would mean a write on a hot path to learn what a join can
 * already tell us.
 */
export async function getClientSettings(
  userId: number,
  currentDevice: typeof userDevices.$inferSelect,
): Promise<ClientSettings> {
  const rows = await db
    .select({
      id: userDevices.id,
      name: userDevices.deviceName,
      platform: userDevices.platform,
      appVersion: userDevices.appVersion,
      activatedAt: userDevices.activatedAt,
      createdAt: userDevices.createdAt,
      lastActiveAt: sql<Date | null>`max(${userSessions.createdAt})`,
    })
    .from(userDevices)
    // All sessions, including revoked ones: a rotated session's created_at is
    // precisely "this device was in use then", and every refresh revokes the row
    // it replaces — filtering to live sessions would report null for every device
    // except the one currently logged in.
    .leftJoin(userSessions, eq(userSessions.deviceId, userDevices.id))
    .where(eq(userDevices.userId, userId))
    .groupBy(
      userDevices.id,
      userDevices.deviceName,
      userDevices.platform,
      userDevices.appVersion,
      userDevices.activatedAt,
      userDevices.createdAt,
    )
    // Most recently used first, and a device that has never held a session sinks
    // to the bottom rather than to the top.
    .orderBy(sql`max(${userSessions.createdAt}) desc nulls last`);

  return {
    notifications: { pushEnabled: currentDevice.pushEnabled },
    biometric: {
      enabled: Boolean(currentDevice.publicKey),
      enrolledAt: currentDevice.keyRegisteredAt,
    },
    language: currentDevice.language,
    devices: rows.map((r) => ({
      id: r.id,
      name: r.name,
      platform: r.platform,
      appVersion: r.appVersion,
      trusted: Boolean(r.activatedAt),
      current: r.id === currentDevice.id,
      lastActiveAt: r.lastActiveAt,
      createdAt: r.createdAt,
    })),
  };
}

export interface UpdateSettingsInput {
  pushEnabled?: boolean;
  language?: 'uz' | 'ru';
}

/**
 * Apply a partial settings change to the calling device.
 *
 * Both fields live on user_devices, so this is one UPDATE keyed on the device's
 * primary key — the (deviceId, userId) check has already happened in the route.
 * A body with neither field is a no-op rather than an error: PATCH semantics, and
 * refusing it would give the app an error to handle for a request that changes
 * nothing.
 */
export async function updateClientSettings(
  deviceRowId: string,
  input: UpdateSettingsInput,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.pushEnabled !== undefined) patch['pushEnabled'] = input.pushEnabled;
  if (input.language !== undefined) patch['language'] = input.language;
  if (Object.keys(patch).length === 0) return;

  patch['updatedAt'] = new Date();
  await db.update(userDevices).set(patch).where(eq(userDevices.id, deviceRowId));
}

export type RevokeDeviceResult = 'ok' | 'not_found' | 'current_device';

/**
 * Untrust one of the caller's other devices.
 *
 * REVOKING SESSIONS IS NOT ENOUGH, and that is the whole point of this function.
 * POST /client/auth/login/pin is unauthenticated and gated only on
 * activated_at + the account PIN; /biometric likewise needs only activated_at +
 * public_key. Neither needs a session. So a "log out" that merely revoked
 * sessions would be undone by whoever holds the phone typing four digits. The
 * device has to lose its TRUST, its KEY and its PUSH TOKEN together.
 *
 * The row itself survives. Deleting it would cascade the sessions away and erase
 * the only record the device ever existed — and the row would silently reappear,
 * untrusted, on the device's next fcm-token upsert anyway. Keeping it is what
 * makes the client_actions row below point at something.
 *
 * Returns a verdict rather than throwing: the route owns the status codes.
 */
export async function revokeClientDevice(
  userId: number,
  targetDeviceRowId: string,
  callerDeviceId: string,
): Promise<RevokeDeviceResult> {
  const [target] = await db
    .select()
    .from(userDevices)
    .where(and(eq(userDevices.id, targetDeviceRowId), eq(userDevices.userId, userId)))
    .limit(1);
  // Someone else's device id is indistinguishable from one that does not exist.
  if (!target) return 'not_found';

  // Self-revoke is refused, not silently turned into a logout. POST
  // /client/auth/logout is the way out of your own session; doing it here would
  // cost the caller activated_at and force a full OTP + MyID re-onboarding to get
  // back in — an expensive thing to let an app bug do by accident.
  if (target.deviceId === callerDeviceId) return 'current_device';

  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessions.deviceId, target.id), isNull(userSessions.revokedAt)));

  await db
    .update(userDevices)
    .set({
      activatedAt: null, // PIN login → device_not_trusted
      publicKey: null, // biometric login → device_not_enrolled
      keyRegisteredAt: null,
      fcmToken: null, // pushes stop
      // push_enabled is deliberately left alone. There is exactly one rule about
      // when a mute dies — the device changes owner, enforced in activateDevice —
      // and duplicating it here would mean a client who revoked their own spare
      // phone and re-onboarded it silently lost the setting. With no token the
      // flag is inert anyway.
      updatedAt: new Date(),
    })
    .where(eq(userDevices.id, target.id));

  // No dedupeKey: revoking the same device twice — after it was re-onboarded and
  // lost again — is two real events, and the tab should show both.
  await recordAction({
    userId,
    action: 'device_revoke',
    status: 'success',
    actorType: 'client',
  });

  return 'ok';
}
