import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '@db';
import { appVersionPolicies } from '@db/app-version-policies';
import { adminUsers } from '@db/admin-users';
import { userDevices } from '@db/user-devices';
import { compareSemver, parseSemver, MAX_VERSION_LENGTH } from '../../../lib/semver';

// ---------------------------------------------------------------------------
// Admin management of the mobile force-update policy. Read + create only:
// revisions are append-only and immutable, because this is the one switch that
// can lock the entire user base out of the app at once and "what was it before,
// and who changed it" must survive the incident.
//
// Two guards sit on the write, since nothing else stands between a typo and a
// fleet-wide lockout:
//   1. minSupportedVersion <= latestVersion, enforced here rather than as a SQL
//      CHECK (semver is not comparable in Postgres).
//   2. `confirm` must repeat minSupportedVersion verbatim — the retype-the-repo-
//      name pattern, so the floor is never moved by a stray keystroke.
// The blast-radius preview (GET /fleet-impact) is the third: it turns the
// decision from typing a string into acknowledging a device count.
//
// Deliberately NOT capped by "refuse if >N% would be locked out". A real
// security incident SHOULD lock out most of the fleet immediately — that is the
// feature working. A cap either blocks the one case this exists for, or sits so
// high it never fires, and guards that fire on legitimate use get routed around.
// ---------------------------------------------------------------------------

const ERROR = { $ref: 'ErrorResponse#' };

const Platform = Type.Union([Type.Literal('ios'), Type.Literal('android')]);

const VersionString = Type.String({
  minLength: 1,
  maxLength: MAX_VERSION_LENGTH,
  description: 'Strict MAJOR.MINOR.PATCH.',
  examples: ['1.4.0'],
});

// Default window for "active device". user_devices rows accumulate forever, so
// an unbounded denominator would make the blast radius meaningless.
const DEFAULT_ACTIVE_DAYS = 30;

export default async function adminAppVersionRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const TAGS = ['Admin · App Versions'];

  const PolicyRevision = Type.Object({
    id: Type.Integer(),
    platform: Platform,
    version: Type.Integer(),
    minSupportedVersion: Type.String(),
    latestVersion: Type.String(),
    storeUrl: Type.String(),
    messageUz: Type.String(),
    messageRu: Type.String(),
    label: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String(),
    createdByName: Type.Union([Type.String(), Type.Null()]),
  });

  const CreateBody = Type.Object({
    platform: Platform,
    minSupportedVersion: VersionString,
    latestVersion: VersionString,
    storeUrl: Type.String({ minLength: 1, maxLength: 2048 }),
    // notNull in the schema and non-empty here: this copy is rendered to users
    // whose build we have already declared too old to patch. Blank text strands
    // them with no way out.
    messageUz: Type.String({ minLength: 1, maxLength: 500 }),
    messageRu: Type.String({ minLength: 1, maxLength: 500 }),
    label: Type.Optional(Type.String({ maxLength: 500 })),
    confirm: Type.String({
      description: 'Must repeat minSupportedVersion exactly. Guards against a mistyped lockout.',
    }),
  });

  /* ── Revision history (newest first; top row per platform is live) ───────── */

  fastify.get(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'Force-update policy revision history',
        response: { 200: Type.Object({ revisions: Type.Array(PolicyRevision) }) },
      },
    },
    async () => {
      const rows = await db
        .select({
          id: appVersionPolicies.id,
          platform: appVersionPolicies.platform,
          version: appVersionPolicies.version,
          minSupportedVersion: appVersionPolicies.minSupportedVersion,
          latestVersion: appVersionPolicies.latestVersion,
          storeUrl: appVersionPolicies.storeUrl,
          messageUz: appVersionPolicies.messageUz,
          messageRu: appVersionPolicies.messageRu,
          label: appVersionPolicies.label,
          createdAt: appVersionPolicies.createdAt,
          createdByName: adminUsers.fullName,
        })
        .from(appVersionPolicies)
        .leftJoin(adminUsers, eq(appVersionPolicies.createdBy, adminUsers.id))
        .orderBy(desc(appVersionPolicies.createdAt));

      return {
        revisions: rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          createdByName: r.createdByName ?? null,
        })),
      };
    },
  );

  /* ── Blast radius: what a candidate floor would actually do ──────────────── */

  fastify.get(
    '/fleet-impact',
    {
      schema: {
        tags: TAGS,
        summary: 'How many devices a candidate minSupportedVersion would lock out',
        querystring: Type.Object({
          platform: Platform,
          minSupportedVersion: VersionString,
          days: Type.Optional(Type.Integer({ minimum: 1, maximum: 365, default: DEFAULT_ACTIVE_DAYS })),
        }),
        response: { 200: Type.Object({
          activeDevices: Type.Integer(),
          lockedOut: Type.Integer(),
          lockedOutPercent: Type.Number(),
          unknownVersion: Type.Integer({
            description: 'Devices whose reported version does not parse. Never counted as locked out.',
          }),
          days: Type.Integer(),
          distribution: Type.Array(
            Type.Object({
              appVersion: Type.String(),
              devices: Type.Integer(),
              lockedOut: Type.Boolean(),
            }),
          ),
        }), 400: ERROR },
      },
    },
    async (request, reply) => {
      const min = parseSemver(request.query.minSupportedVersion);
      if (!min) return reply.code(400).sendError('invalid_version');

      const days = request.query.days ?? DEFAULT_ACTIVE_DAYS;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const rows = await db
        .select({
          appVersion: userDevices.appVersion,
          devices: sql<number>`count(*)::int`,
        })
        .from(userDevices)
        .where(and(eq(userDevices.platform, request.query.platform), gt(userDevices.updatedAt, since)))
        .groupBy(userDevices.appVersion);

      let activeDevices = 0;
      let lockedOut = 0;
      let unknownVersion = 0;

      const distribution = rows.map((r) => {
        const running = parseSemver(r.appVersion);
        activeDevices += r.devices;
        // An unparseable reported version is not evidence of a stale build, and
        // the runtime check fails open on it — so it must not inflate the count.
        if (!running) unknownVersion += r.devices;
        const isLockedOut = running !== null && compareSemver(running, min) < 0;
        if (isLockedOut) lockedOut += r.devices;
        return { appVersion: r.appVersion, devices: r.devices, lockedOut: isLockedOut };
      });

      distribution.sort((a, b) => b.devices - a.devices);

      return {
        activeDevices,
        lockedOut,
        lockedOutPercent: activeDevices === 0 ? 0 : Math.round((lockedOut / activeDevices) * 1000) / 10,
        unknownVersion,
        days,
        distribution,
      };
    },
  );

  /* ── Publish a revision (goes live immediately) ──────────────────────────── */

  fastify.post(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'Publish a new force-update policy revision',
        body: CreateBody,
        response: { 201: PolicyRevision, 400: ERROR },
      },
    },
    async (request, reply) => {
      const { platform, minSupportedVersion, latestVersion, storeUrl, messageUz, messageRu } = request.body;

      const min = parseSemver(minSupportedVersion);
      const latest = parseSemver(latestVersion);
      if (!min || !latest) return reply.code(400).sendError('invalid_version');

      // A floor above the newest build strands everyone at a store with nothing
      // to give them.
      if (compareSemver(min, latest) > 0) return reply.code(400).sendError('min_above_latest');

      if (request.body.confirm.trim() !== minSupportedVersion.trim()) {
        return reply.code(400).sendError('version_confirmation_mismatch');
      }

      const adminId = Number((request.user as { sub: string }).sub);

      const row = await db.transaction(async (tx) => {
        const [{ next }] = await tx
          .select({
            next: sql<number>`coalesce(max(${appVersionPolicies.version}), 0) + 1`,
          })
          .from(appVersionPolicies)
          // Scoped: version sequences are per-platform, so iOS and Android
          // number their revisions independently.
          .where(eq(appVersionPolicies.platform, platform));

        const [inserted] = await tx
          .insert(appVersionPolicies)
          .values({
            platform,
            version: next!,
            minSupportedVersion: minSupportedVersion.trim(),
            latestVersion: latestVersion.trim(),
            storeUrl: storeUrl.trim(),
            messageUz: messageUz.trim(),
            messageRu: messageRu.trim(),
            label: request.body.label?.trim() || null,
            createdBy: adminId,
          })
          .returning();
        return inserted!;
      });

      const [author] = await db
        .select({ fullName: adminUsers.fullName })
        .from(adminUsers)
        .where(eq(adminUsers.id, adminId))
        .limit(1);

      request.log.warn(
        { platform, minSupportedVersion, latestVersion, adminId },
        'app-version policy published',
      );

      return reply.code(201).send({
        ...row,
        createdAt: row.createdAt.toISOString(),
        createdByName: author?.fullName ?? null,
      });
    },
  );
}
