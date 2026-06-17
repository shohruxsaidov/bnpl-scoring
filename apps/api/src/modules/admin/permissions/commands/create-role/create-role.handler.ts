import { db } from "@db"
import { roles } from '@db/schema'
import type { CreateRoleInput } from "./create-role.command"

export async function createRole(input: CreateRoleInput) {
  const [row] = await db
    .insert(roles)
    .values({ platform: input.platform, key: input.key, name: input.name })
    .returning()
  return row!
}
