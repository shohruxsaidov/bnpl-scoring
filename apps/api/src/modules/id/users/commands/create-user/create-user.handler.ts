import { db } from '@db';
import { CreateUserCommand } from './create-user.command';
import { users } from '@db/users';

export async function createUserHandler({
  phone,
  pinfl,
  firstName,
  lastName,
  middleName,
  birthDate,
  gender,
  nationality,
  passportSeries,
  passportNumber,
  address,
  regionCode,
  districtCode,
  docType,
  verifiedAt,
}: CreateUserCommand) {
  const [row] = await db
    .insert(users)
    .values({
      phone,
      pinfl,
      firstName,
      lastName,
      middleName,
      birthDate,
      gender,
      nationality,
      passportSeries,
      passportNumber,
      address,
      regionCode,
      districtCode,
      docType,
      verifiedAt,
    })
    .returning();
  return row;
}
