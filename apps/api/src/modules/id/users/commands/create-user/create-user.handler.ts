import { db, type Db } from '@db';
import { CreateUserCommand } from './create-user.command';
import { users } from '@db/users';

// Accepts an optional executor so callers can create the user inside an existing
// transaction (e.g. client registration inserts the terms acceptance atomically).
// Defaults to the shared db connection.
export async function createUserHandler(
  {
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
    citizenShipId,
    permanentRegistration,
    temporaryRegistration,
  }: CreateUserCommand,
  executor: Pick<Db, 'insert'> = db,
) {
  const [row] = await executor
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
      citizenShipId,
      permanentRegistration,
      temporaryRegistration,
    })
    .returning();
  return row;
}
