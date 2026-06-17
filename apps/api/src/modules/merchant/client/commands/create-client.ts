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
    address: string | null
    katmRegionCode: string | null
    katmDistrictCode: string | null
    docType: number | null
    merchantId: number
    branchId: number
  },
) {
  const [row] = await db
    .insert(clients)
    .values({ ...input, myidVerifiedAt: new Date() })
    .returning()
  return row!
}
