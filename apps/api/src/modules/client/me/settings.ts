import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import {
  findOwnDevice,
  getClientSettings,
  revokeClientDevice,
  updateClientSettings,
} from './settings.service';

// ---------------------------------------------------------------------------
// Client app settings — GET/PATCH /client/me/settings and
// DELETE /client/me/devices/:id.
//
// Shares the /client/me prefix with the profile in ./index.ts but kept in its own
// plugin: that file answers "who am I", this one is the Settings screen. Read
// settings.service.ts before touching either write — the scoping rule there is
// what stops a stale token from muting somebody else's phone.
//
// Note what is NOT here. Biometric is reported but never toggled: turning it ON
// requires a public key from the Secure Enclave, which POST /client/auth/register-
// device already owns. Offering `biometricEnabled: true` in the PATCH body would
// be a field that always 400s.
// ---------------------------------------------------------------------------

const SECURITY = [{ clientAuth: [] }];
const ERROR = { $ref: 'ErrorResponse#' };

const Language = Type.Union([Type.Literal('uz'), Type.Literal('ru')], { examples: ['ru'] });

const DeviceItem = Type.Object({
  id: Type.String(),
  // OS model string, null on devices last seen by an app build that predates it.
  name: Type.Union([Type.String(), Type.Null()]),
  platform: Type.Union([Type.Literal('ios'), Type.Literal('android')]),
  appVersion: Type.String(),
  trusted: Type.Boolean(),
  current: Type.Boolean(),
  lastActiveAt: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

const Settings = Type.Object(
  {
    notifications: Type.Object({ pushEnabled: Type.Boolean() }),
    biometric: Type.Object({
      enabled: Type.Boolean(),
      enrolledAt: Type.Union([Type.String(), Type.Null()]),
    }),
    language: Language,
    devices: Type.Array(DeviceItem),
  },
  {
    examples: [
      {
        notifications: { pushEnabled: true },
        biometric: { enabled: true, enrolledAt: '2026-07-09T08:11:00.000Z' },
        language: 'ru',
        devices: [
          {
            id: '9f2c1b7e-3a44-4c8d-9f01-2b3c4d5e6f70',
            name: 'iPhone 14 Pro',
            platform: 'ios',
            appVersion: '1.0.2',
            trusted: true,
            current: true,
            lastActiveAt: '2026-07-30T09:40:00.000Z',
            createdAt: '2026-06-02T12:00:00.000Z',
          },
          {
            id: '3ab1d904-77cc-4e10-8a52-11de9f0c4477',
            name: 'Samsung SM-S911B',
            platform: 'android',
            appVersion: '1.0.0',
            trusted: true,
            current: false,
            lastActiveAt: '2026-07-12T18:02:00.000Z',
            createdAt: '2026-05-20T09:15:00.000Z',
          },
        ],
      },
    ],
  },
);

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export default async function clientSettingsRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const TAGS = ['Client · Me'];
  const guards = [app.verifyClientJwt];
  const Ok = Type.Object({ ok: Type.Boolean() }, { examples: [{ ok: true }] });

  /* ── GET /client/me/settings ─────────────────────────────────────────────── */

  fastify.get(
    '/settings',
    {
      schema: {
        tags: TAGS,
        summary: 'Get my app settings',
        description:
          'Everything the Settings screen renders. `notifications`, `biometric` and ' +
          '`language` describe THE CALLING DEVICE (resolved from x-device-id); ' +
          '`devices` lists every device on the account, newest-active first, with ' +
          '`current: true` on the caller. `lastActiveAt` is the last time that ' +
          'device minted or refreshed a session. Biometric is read-only here — ' +
          'enable it via POST /client/auth/register-device.',
        security: SECURITY,
        response: { 200: Settings, 400: ERROR, 401: ERROR },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      if (!request.deviceId) return reply.code(400).sendError('missing_device_id');

      const userId = Number(request.user.sub);
      // Scoped by user as well as device: a device that has changed hands belongs
      // to somebody else now, and this token has no business reading its state.
      const device = await findOwnDevice(request.deviceId, userId);
      if (!device) return reply.code(400).sendError('device_not_trusted');

      const s = await getClientSettings(userId, device);
      return {
        ...s,
        biometric: { enabled: s.biometric.enabled, enrolledAt: iso(s.biometric.enrolledAt) },
        devices: s.devices.map((d) => ({
          ...d,
          lastActiveAt: iso(d.lastActiveAt),
          createdAt: d.createdAt.toISOString(),
        })),
      };
    },
  );

  /* ── PATCH /client/me/settings ───────────────────────────────────────────── */

  fastify.patch(
    '/settings',
    {
      schema: {
        tags: TAGS,
        summary: 'Update my app settings',
        description:
          'Partial update, applied to THE CALLING DEVICE (x-device-id). ' +
          '`pushEnabled: false` stops FCM pushes to this device only — the in-app ' +
          'notification inbox keeps receiving everything, so nothing is lost. ' +
          '`language` sets the locale of pushes sent to this device. Omitted fields ' +
          'are left alone; an empty body is a no-op.',
        security: SECURITY,
        body: Type.Object(
          {
            pushEnabled: Type.Optional(Type.Boolean()),
            language: Type.Optional(Language),
          },
          { examples: [{ pushEnabled: false }] },
        ),
        response: { 200: Ok, 400: ERROR, 401: ERROR },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      if (!request.deviceId) return reply.code(400).sendError('missing_device_id');

      const device = await findOwnDevice(request.deviceId, Number(request.user.sub));
      // Same guard as the read, and here it is not merely tidy: keyed on deviceId
      // alone, a token from a device that changed hands would write to the new
      // owner's row.
      if (!device) return reply.code(400).sendError('device_not_trusted');

      await updateClientSettings(device.id, request.body);
      return { ok: true };
    },
  );

  /* ── DELETE /client/me/devices/:id — untrust another device ──────────────── */

  fastify.delete(
    '/devices/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Revoke a device',
        description:
          'Untrusts one of the caller’s OTHER devices: revokes its sessions, ' +
          'removes its biometric key and its push token, and clears its trusted ' +
          'flag. PIN and biometric login on that device stop working — it must go ' +
          'through /setup (full OTP + MyID) to return, which is the point. Refuses ' +
          'the caller’s own device with 409; use POST /client/auth/logout for that.',
        security: SECURITY,
        params: Type.Object({
          id: Type.String({ format: 'uuid', examples: ['3ab1d904-77cc-4e10-8a52-11de9f0c4477'] }),
        }),
        response: { 200: Ok, 400: ERROR, 401: ERROR, 404: ERROR, 409: ERROR },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      if (!request.deviceId) return reply.code(400).sendError('missing_device_id');

      const result = await revokeClientDevice(
        Number(request.user.sub),
        request.params.id,
        request.deviceId,
      );
      if (result === 'not_found') return reply.code(404).sendError('device_not_found');
      if (result === 'current_device') {
        return reply.code(409).sendError('cannot_revoke_current_device');
      }
      return { ok: true };
    },
  );
}
