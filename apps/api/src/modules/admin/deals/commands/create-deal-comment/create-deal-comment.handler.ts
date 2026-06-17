import { db } from "@db"
import { dealComments } from "../../../../deals/schema"
import type { CreateDealCommentCommand } from "./create-deal-comment.command"

export async function createDealComment({ dealId, adminUserId, text }: CreateDealCommentCommand) {
  const [row] = await db
    .insert(dealComments)
    .values({ dealId, adminUserId, text })
    .returning({
      id: dealComments.id,
      createdAt: dealComments.createdAt,
    })
  return { id: row!.id.toString(), dealId, text, createdAt: row!.createdAt.toISOString() }
}
