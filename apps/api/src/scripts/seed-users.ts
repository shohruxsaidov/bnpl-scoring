import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '@db/users';

const DEFAULT_SUBJECTS_DIR =
  '/Users/shohruxsaidov/Documents/projects/katm-mock/src/mocks/generated/subjects';

const ADDRESS_MAX = 100; // users.address is varchar(100)
const CHUNK_SIZE = 1000;

interface IdentityData {
  pinfl: string;
  phone: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  dateBirth: string;
  male: number;
  docSeries: string | null;
  docNumber: string | null;
  address: string | null;
}

interface Subject {
  identity: { data: IdentityData };
}

const client = postgres(process.env['DATABASE_URL']!);
const db = drizzle(client);

async function main() {
  const dir = resolve(process.env['SUBJECTS_JSON_PATH'] ?? DEFAULT_SUBJECTS_DIR);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

  const seenPhones = new Set<string>();
  const droppedDupPhone: string[] = [];

  const rows = files
    .map((file) => {
      const d = (JSON.parse(readFileSync(join(dir, file), 'utf8')) as Subject).identity.data;
      return {
        phone: d.phone,
        pinfl: d.pinfl,
        firstName: d.firstName,
        lastName: d.lastName,
        middleName: d.middleName,
        birthDate: d.dateBirth.slice(0, 10), // raw UTC slice
        gender: d.male === 1 ? 1 : 2,
        nationality: 'UZB',
        passportSeries: d.docSeries,
        passportNumber: d.docNumber,
        address: d.address?.slice(0, ADDRESS_MAX) ?? null,
        verifiedAt: new Date(),
      };
    })
    .filter((row) => {
      // phone is UNIQUE; keep first occurrence, drop later dupes within this batch
      if (seenPhones.has(row.phone)) {
        droppedDupPhone.push(row.pinfl);
        return false;
      }
      seenPhones.add(row.phone);
      return true;
    });

  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const res = await db
      .insert(users)
      .values(chunk)
      .onConflictDoNothing() // absorbs both pinfl and phone collisions vs existing rows
      .returning({ pinfl: users.pinfl });
    inserted += res.length;
  }

  console.log(
    `Seeded users from ${dir}: ${files.length} files, ${rows.length} candidates, ` +
      `${inserted} inserted, ${rows.length - inserted} skipped (already existed), ` +
      `${droppedDupPhone.length} dropped for duplicate phone.`,
  );
  if (droppedDupPhone.length) {
    console.log(`  dropped dup-phone pinfls: ${droppedDupPhone.join(', ')}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
