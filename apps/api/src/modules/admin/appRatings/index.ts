import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { getRatingSummary } from "../../client/ratings/queries"

// The aggregate view of how clients rate the mobile app. Read-only by design —
// see the registration comment in admin/index.ts before adding any route here.
//
// Deliberately aggregate-only: there is no per-user rating list. A rating
// carries no comment, so knowing that user 412 gave 1 star tells you nothing
// actionable, while exposing it makes a support-visible judgement out of what
// the client submitted as anonymous feedback.

const TAGS = ["Admin · App Ratings"]
const SECURITY = [{ adminAuth: [] }]
const ERROR = { $ref: "ErrorResponse#" }

const Summary = Type.Object(
  {
    // null when nobody has rated yet — not 0, which would read as a real,
    // catastrophic score.
    average: Type.Union([Type.Number(), Type.Null()]),
    count: Type.Integer(),
    histogram: Type.Object({
      1: Type.Integer(),
      2: Type.Integer(),
      3: Type.Integer(),
      4: Type.Integer(),
      5: Type.Integer(),
    }),
  },
  {
    examples: [
      { average: 4.31, count: 128, histogram: { 1: 6, 2: 4, 3: 12, 4: 28, 5: 78 } },
    ],
  },
)

export default async function adminAppRatingRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()

  fastify.get(
    "/summary",
    {
      schema: {
        tags: TAGS,
        summary: "App rating summary",
        description:
          "Average rating, how many clients have rated, and the 1..5 star " +
          "distribution. Each client contributes exactly one rating — their " +
          "current one, since re-rating replaces the previous value.",
        security: SECURITY,
        response: { 200: Summary, 401: ERROR, 403: ERROR },
      },
    },
    async () => getRatingSummary(),
  )
}
