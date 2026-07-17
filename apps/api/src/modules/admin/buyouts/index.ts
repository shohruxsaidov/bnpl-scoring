import { randomUUID } from "node:crypto"
import { Type } from "@sinclair/typebox"
import fastifyMultipart from "@fastify/multipart"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { env } from "@env"
import { sniffImageMime } from "../../../lib/image-type"
import { listBuyouts } from "./queries/list-buyouts/list-buyouts.handler"
import { markBuyoutPaid } from "./commands/mark-buyout-paid/mark-buyout-paid.handler"

const UPLOAD_PREFIX = "buyout-documents"
const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024 // 15 MB

const PDF_MAGIC = Buffer.from("%PDF-", "ascii")

// The declared multipart mimetype is caller-supplied text, not evidence — a
// mislabelled file would become an unopenable entry in the payment archive.
// PDFs plus the phone-camera image formats; WebP is dropped from the image
// sniffer's range because nothing here produces it.
function sniffDocumentMime(buf: Buffer): string | null {
  if (buf.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) return "application/pdf"
  const image = sniffImageMime(buf)
  return image === "image/png" || image === "image/jpeg" ? image : null
}

export default async function adminBuyoutRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()

  // Scoped to this plugin: only the pay route consumes multipart, so the rest of
  // the admin API keeps its JSON-only body parsing.
  await app.register(fastifyMultipart, {
    limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
    // Don't throw on oversize; flag `file.truncated` so we can reject with a
    // localized 400 (file_too_large) instead of an opaque 413.
    throwFileSizeLimit: false,
  })

  const TAGS = ["Admin · Buyouts"]

  const ListQuery = Type.Object({
    merchantId: Type.Optional(Type.String()),
    status: Type.Optional(Type.String()),
  })

  const IdParams = Type.Object({ id: Type.String() })

  fastify.get("/", { schema: { tags: TAGS, querystring: ListQuery } }, async (request) => {
    const { merchantId, status } = request.query
    const buyouts = await listBuyouts({
      merchantId: merchantId ? Number(merchantId) : undefined,
      status: status || undefined,
    })
    return { buyouts }
  })

  fastify.patch(
    "/:id/pay",
    {
      schema: {
        tags: TAGS,
        summary: "Mark a buyout paid, attaching the proof of payment",
        description:
          "Accepts a single multipart PDF/PNG/JPEG document, stores it, and flips " +
          "the buyout pending → paid. The transition is one-shot: paying an " +
          "already-paid buyout is a 409, so its document is never replaced.",
        consumes: ["multipart/form-data"],
        params: IdParams,
      },
    },
    async (request, reply) => {
      const upload = await request.file()
      if (!upload) return reply.code(400).sendError("file_required")

      // Buffer the whole file so a truncated stream (over the size limit) is
      // rejected before anything lands in storage.
      const buffer = await upload.toBuffer()
      if (upload.file.truncated) return reply.code(400).sendError("file_too_large")

      const mimeType = sniffDocumentMime(buffer)
      if (!mimeType) return reply.code(400).sendError("invalid_document_type")

      const objectKey = `${UPLOAD_PREFIX}/${randomUUID()}`
      await app.minio.putObject(env.MINIO_BUCKET, objectKey, buffer, buffer.length, {
        "Content-Type": mimeType,
      })

      const result = await markBuyoutPaid({
        id: Number(request.params.id),
        adminId: Number((request.user as { sub: string }).sub),
        document: { objectKey, mimeType, originalName: upload.filename ?? undefined },
      })

      if (result.status === "not_found") return reply.code(404).sendError("not_found")
      if (result.status === "already_paid") return reply.code(409).sendError("buyout_already_paid")
      return { buyout: result.buyout }
    },
  )
}
