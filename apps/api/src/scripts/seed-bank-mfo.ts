import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { bankMfoCache } from '../modules/id/db/schema';

const CBU_URL = 'https://cbu.uz/upload/open_data/0010/4-009-0010_uz.json';

interface CbuEntry {
  Filialkodi: string;
  Filialnomi: string;
}

const client = postgres(process.env['DATABASE_URL']!);
const db = drizzle(client);

async function main() {
  console.log('Fetching bank list from cbu.uz...');
  const res = await fetch(CBU_URL, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`CBU responded with ${res.status}`);

  const data: CbuEntry[] = await res.json();
  const entries = data.filter((e) => /^\d{5}$/.test(e.Filialkodi));

  console.log(`Fetched ${data.length} entries, ${entries.length} with valid MFO codes`);

  await db
    .insert(bankMfoCache)
    .values(entries.map((e) => ({ mfo: e.Filialkodi, bankName: e.Filialnomi })))
    .onConflictDoUpdate({
      target: bankMfoCache.mfo,
      set: { bankName: sql`excluded.bank_name`, fetchedAt: sql`now()` },
    });

  console.log(`Seeded ${entries.length} rows into bank_mfo_cache`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


