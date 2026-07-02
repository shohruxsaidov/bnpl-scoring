import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { desc, eq } from 'drizzle-orm';
import { offerRules } from '@db/offer-rules';

const client = postgres(process.env['DATABASE_URL']!);
const db = drizzle(client);

const TYPE = 'registration';

// Placeholder content — replace title/body with the real Markdown terms.
const content = {
  titleUz: "Ro'yxatdan o'tish shartlari",
  titleRu: 'Условия регистрации',
  bodyUz: '# Ro\'yxatdan o\'tish shartlari\n\nMatn keyinroq qo\'shiladi.',
  bodyRu: '# Условия регистрации\n\nТекст будет добавлен позже.',
};

async function main() {
  // Next version = MAX(version)+1 for this type (latest wins).
  const [latest] = await db
    .select({ version: offerRules.version })
    .from(offerRules)
    .where(eq(offerRules.type, TYPE))
    .orderBy(desc(offerRules.version))
    .limit(1);
  const version = (latest?.version ?? 0) + 1;

  const [row] = await db
    .insert(offerRules)
    .values({ type: TYPE, version, ...content, createdBy: null })
    .returning({ id: offerRules.id });

  console.log(`offer_rules seeded: #${row!.id} (${TYPE} v${version})`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
