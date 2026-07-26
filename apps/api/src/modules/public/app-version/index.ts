import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { db } from '@db';
import { appVersionPolicies } from '@db/app-version-policies';
import { StringEnum } from '@lib/typebox';
import { resolveLang, type SupportedLang } from '../../../i18n/index';
import { compareSemver, parseSemver, MAX_VERSION_LENGTH } from '../../../lib/semver';

// ---------------------------------------------------------------------------
// The force-update check, called by the mobile app at launch — before login,
// which is why it lives in publicModule (no session, no x-device-id): a client
// on a dead build must be told so before it asks for a phone number.
//
// The server states the verdict; the app enforces it by rendering a blocking
// screen. That means a tampered client can ignore this, which is accepted —
// the alternative (a 426 gate on every /client route) would brick every build
// already in the wild that does not send a version header.
//
// EVERYTHING FAILS OPEN. Unparseable version, unknown platform, or no policy
// row all resolve to 'ok'. The app must do the same on network error, timeout
// or 5xx — see the fail-open note below. Failing closed would convert a
// backend outage into a total product lockout, pointing every user at a store
// with nothing newer to install.
// ---------------------------------------------------------------------------

const ERROR = { $ref: 'ErrorResponse#' };

// Five minutes. This is the highest-volume endpoint by request count (every
// cold launch) and the lowest by information content (the policy changes maybe
// monthly), so caching is nearly free. Not longer, because this is also the
// recovery latency for a floor published by mistake: when the fleet is locked
// out wrongly, it must heal in minutes.
//
// Vary on x-lang is MANDATORY, not decorative: the message is localized from a
// header that does not appear in the URL, so a shared cache keying on URL alone
// would serve Uzbek copy to Russian users at random. That bug is invisible in
// dev and appears only behind a CDN.
const CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=600';

// The global limiter (app.ts: 100/min per IP) is wrong for a launch-time check:
// Uzbek carriers put many subscribers behind one CGNAT egress IP, so a busy
// network would take 429s, which the app's fail-open rule correctly swallows as
// 'ok' — silently disabling the gate for exactly the users behind the busiest
// networks. This route is a cached read with no side effects, so the limit here
// is DoS hygiene rather than abuse prevention.
const RATE_LIMIT = { max: 1000, timeWindow: '1 minute' };

export default async function publicAppVersionRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const TAGS = ['Public · App'];

  const Query = Type.Object({
    platform: StringEnum(['ios', 'android'] as const),
    version: Type.String({
      minLength: 1,
      maxLength: MAX_VERSION_LENGTH,
      description: 'The running build, strict MAJOR.MINOR.PATCH.',
      examples: ['1.2.0'],
    }),
  });

  const Response = Type.Object(
    {
      status: StringEnum(['ok', 'soft', 'force'] as const, {
        description:
          "'force' — block the app with a non-dismissible screen. 'soft' — dismissible " +
          "update nudge. 'ok' — proceed.",
      }),
      latestVersion: Type.Union([Type.String(), Type.Null()]),
      storeUrl: Type.Union([Type.String(), Type.Null()]),
      message: Type.Union([Type.String(), Type.Null()], {
        description:
          'Localized by x-lang. The app must still carry a hardcoded fallback string: ' +
          'if this is ever null on a force verdict, the stranded user cannot be sent a fix.',
      }),
    },
    {
      examples: [{ status: 'ok', latestVersion: '1.4.0', storeUrl: 'https://...', message: null }],
    },
  );

  const OPEN = { status: 'ok', latestVersion: null, storeUrl: null, message: null } as const;

  fastify.get(
    '/app-version',
    {
      config: { rateLimit: RATE_LIMIT },
      schema: {
        tags: TAGS,
        summary: 'Force-update check for the mobile app',
        description:
          'Called at launch, before login. Returns the verdict for the calling build. ' +
          'The app MUST treat network failure, timeout and 5xx as `ok` — never as `force`.',
        querystring: Query,
        response: { 200: Response, 400: ERROR },
      },
    },
    async (request, reply) => {
      const running = parseSemver(request.query.version);
      // A client bug or a suffixed internal build ('1.2.3-rc1'). Surfaced loudly
      // rather than guessed at; the app's fail-open rule renders it harmless.
      if (!running) return reply.code(400).sendError('invalid_version');

      const [policy] = await db
        .select()
        .from(appVersionPolicies)
        .where(eq(appVersionPolicies.platform, request.query.platform as any))
        .orderBy(desc(appVersionPolicies.version))
        .limit(1);

      reply.header('Cache-Control', CACHE_CONTROL).header('Vary', 'x-lang');

      // Absence means 'default', not 'locked out'.
      if (!policy) return OPEN;

      const min = parseSemver(policy.minSupportedVersion);
      const latest = parseSemver(policy.latestVersion);
      // Unreachable while the write handler validates both, but a policy we
      // cannot parse must never become a lockout: fail open here too.
      if (!min || !latest) {
        request.log.error(
          { policyId: policy.id, platform: policy.platform },
          'app-version policy holds an unparseable version; failing open',
        );
        return OPEN;
      }

      const lang = resolveLang(request.headers['x-lang'] as string | undefined);
      const status: 'ok' | 'soft' | 'force' =
        compareSemver(running, min) < 0
          ? 'force'
          : compareSemver(running, latest) < 0
            ? 'soft'
            : 'ok';

      return {
        status,
        latestVersion: policy.latestVersion,
        storeUrl: policy.storeUrl,
        message: pickMessage(policy, lang),
      };
    },
  );
}

// Mirrors pickText() in client/notifications/push.ts: prefer the requested
// language, fall back across languages rather than render an empty screen to a
// user who cannot be sent a corrected build.
function pickMessage(
  policy: { messageUz: string; messageRu: string },
  lang: SupportedLang,
): string | null {
  const ordered =
    lang === 'uz' ? [policy.messageUz, policy.messageRu] : [policy.messageRu, policy.messageUz];
  return ordered.find((v) => v.trim() !== '') ?? null;
}
