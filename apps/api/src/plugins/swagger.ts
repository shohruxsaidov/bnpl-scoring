import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { env } from '../env'

/**
 * Interactive API docs — non-production only. Split into three audience docs:
 *   /docs/admin     — admin portal endpoints
 *   /docs/merchant  — merchant portal endpoints
 *   /docs/client    — client portal endpoints
 *
 * One @fastify/swagger instance generates the full spec; each UI instance below
 * filters it to its audience via `transformSpecification` (by path prefix).
 *
 * Spec is generated live by introspecting registered route schemas. Inputs
 * (body/params/querystring) are already typed via TypeBox and document
 * themselves. Success-response bodies are largely undocumented for now and are
 * backfilled per-module; the shared error envelope is registered here once.
 *
 * Admin/merchant auth is cookie-based (httpOnly), so Swagger UI's Authorize
 * dialog cannot set those credentials directly. The working flow: call an auth
 * `login` route from the UI — the browser stores the cookie — then "Try it out"
 * on protected routes sends it automatically (docs are same-origin and CORS uses
 * credentials).
 *
 * Client auth is a Bearer token (`Authorization: Bearer <token>`), so for the
 * client doc paste the token into the Authorize dialog directly.
 */

// Header parameter documented on every client operation. Enforcement lives in
// the client module's onRequest hook; this just surfaces it in the client doc.
const DEVICE_ID_PARAM = {
  name: 'x-device-id',
  in: 'header',
  required: true,
  description: 'Mobile device identifier. Required on all client endpoints.',
  schema: { type: 'string', pattern: '^[A-Za-z0-9._:-]{1,255}$', maxLength: 255 },
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const

// Append `param` to every operation under a path item, returning fresh objects
// so the shared (un-cloned) spec is never mutated.
function withParam(item: Record<string, any>, param: unknown) {
  const next: Record<string, any> = { ...item }
  for (const method of HTTP_METHODS) {
    const op = item[method]
    if (op) next[method] = { ...op, parameters: [...(op.parameters ?? []), param] }
  }
  return next
}

// Registers an encapsulated swagger-ui that serves only the paths matching
// `include`. Encapsulation keeps the three @fastify/static instances (one per
// UI) from colliding on shared decorators. When `injectParam` is set, it is
// added to every operation in this doc.
function audienceDocs(
  routePrefix: string,
  title: string,
  include: (path: string) => boolean,
  authScheme: string,
  injectParam?: unknown,
) {
  return async function (scope: FastifyInstance) {
    await scope.register(swaggerUi, {
      routePrefix,
      uiConfig: { docExpansion: 'list', deepLinking: true, persistAuthorization: true },
      transformSpecificationClone: false,
      transformSpecification(spec) {
        const paths: Record<string, unknown> = {}
        for (const [path, item] of Object.entries(spec.paths ?? {})) {
          if (!include(path)) continue
          // Only the enforced client routes advertise the header — not /health.
          const inject = injectParam && path.startsWith('/api/v1/client')
          paths[path] = inject ? withParam(item as Record<string, any>, injectParam) : item
        }
        // Show only this audience's auth scheme in the Authorize dialog, so the
        // client doc offers clientAuth alone (not merchantAuth/adminAuth too).
        const allSchemes = spec.components?.securitySchemes ?? {}
        const securitySchemes = allSchemes[authScheme]
          ? { [authScheme]: allSchemes[authScheme] }
          : {}
        return {
          ...spec,
          info: { ...spec.info, title },
          paths,
          components: { ...spec.components, securitySchemes },
        }
      },
    })
  }
}
export default fp(async function swaggerPlugin(app: FastifyInstance) {
  if (env.NODE_ENV === 'production') return

  await app.register(swagger, {
    // Preserve $id as the component name (default would emit def-0, def-1…).
    refResolver: {
      buildLocalReference(json, _baseUri, _fragment, i) {
        return (json.$id as string) || `def-${i}`
      },
    },
    openapi: {
      info: {
        title: 'Scoring API',
        description:
          'Internal API reference. Responses are localized by the optional `x-lang` header. ' +
          'Errors share the envelope `{ code, message, args }`.',
        version: '0.1.0',
      },
      servers: [{ url: '/', description: 'current host' }],
      components: {
        securitySchemes: {
          merchantAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'merchant_access_token',
            description: 'Set by POST /api/v1/auth/merchant/login.',
          },
          clientAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description:
              'Bearer token from the client portal login. Sent as `Authorization: Bearer <token>`.',
          },
          adminAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'admin_access_token',
            description: 'Set by the admin login.',
          },
        },
        parameters: {
          // Reusable optional language header — reference from a route's
          // schema via: parameters: [{ $ref: '#/components/parameters/xLang' }]
          xLang: {
            name: 'x-lang',
            in: 'header',
            required: false,
            description: 'Response language. Defaults to uz.',
            schema: { type: 'string', enum: ['uz', 'ru'] },
          },
        },
      },
    },
  })

  // Shared error envelope — emitted by reply.sendError() and the global error
  // handler. Registered as a shared schema so routes can reference it via
  //   response: { 4xx: { $ref: 'ErrorResponse#' } }
  // @fastify/swagger auto-includes addSchema'd schemas under components.schemas.
  app.addSchema({
    $id: 'ErrorResponse',
    type: 'object',
    required: ['code', 'message'],
    properties: {
      code: { type: 'string' },
      message: { type: 'string' },
      args: { type: 'object', additionalProperties: true },
    },
  })

  const isAdmin = (p: string) =>
    p.startsWith('/api/v1/admin') || p.startsWith('/api/v1/auth/admin') || p === '/health'
  const isMerchant = (p: string) =>
    p.startsWith('/api/v1/merchant') || p.startsWith('/api/v1/auth/merchant') || p === '/health'
  const isClient = (p: string) => p.startsWith('/api/v1/client') || p === '/health'

  await app.register(audienceDocs('/docs/admin', 'Scoring API — Admin', isAdmin, 'adminAuth'))
  await app.register(audienceDocs('/docs/merchant', 'Scoring API — Merchant', isMerchant, 'merchantAuth'))
  await app.register(
    audienceDocs('/docs/client', 'Scoring API — Client', isClient, 'clientAuth', DEVICE_ID_PARAM),
  )
}, { name: 'swagger', dependencies: [] })
