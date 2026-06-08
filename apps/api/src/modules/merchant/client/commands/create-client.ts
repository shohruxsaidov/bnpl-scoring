import type { Db } from "../../../../db"
import { clients } from "../../../id/db/schema"

export async function createClient(
  db: Db,
  input: {
    phone: string
    pinfl: string
    firstName: string
    lastName: string
    birthDate: string
    gender: string
    nationality: string
    passportSerial: string | null
    passportNumber: string | null
    photoUrl: string | null
    merchantId: bigint
    branchId: bigint
  },
) {
  const [row] = await db
    .insert(clients)
    .values({ ...input, myidVerifiedAt: new Date() })
    .returning()
  return row!
}
