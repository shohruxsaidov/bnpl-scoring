import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { regions } from '@db/schema';

interface RegionLocale {
  localeKey: 'ru' | 'uz' | 'uzc';
  title: string;
}

interface RegionEntry {
  id: number;
  regionType: string;
  upperId: number | null;
  locales: RegionLocale[];
}

const client = postgres(process.env['DATABASE_URL']!);
const db = drizzle(client);

function locale(entry: RegionEntry, key: 'ru' | 'uz' | 'uzc'): string {
  return entry.locales.find((l) => l.localeKey === key)?.title ?? '';
}

async function main() {
  const raw = readFileSync(
    join(import.meta.dirname, '../references/regions.json'),
    'utf-8',
  );
  const data: RegionEntry[] = JSON.parse(raw);

  // Skip country row (id: -2) and unknown sentinel (id: -1)
  const rows = data.filter((r) => r.id > 0);

  // Regions (upperId IS NULL) must be inserted before Districts to satisfy FK
  const topLevel = rows.filter((r) => r.upperId === null);
  const districts = rows.filter((r) => r.upperId !== null);

  console.log(`Seeding ${topLevel.length} regions and ${districts.length} districts…`);

  for (const batch of [topLevel, districts]) {
    await db
      .insert(regions)
      .values(
        batch.map((r) => ({
          id: r.id,
          upperId: r.upperId ?? null,
          nameRu: locale(r, 'ru'),
          nameUz: locale(r, 'uz'),
          nameUzc: locale(r, 'uzc'),
        })),
      )
      .onConflictDoUpdate({
        target: regions.id,
        set: {
          nameRu: sql`excluded.name_ru`,
          nameUz: sql`excluded.name_uz`,
          nameUzc: sql`excluded.name_uzc`,
        },
      });
  }

  console.log(`Done. ${rows.length} rows upserted into regions.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
