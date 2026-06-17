import { AnyPgColumn, integer, pgTable, varchar } from 'drizzle-orm/pg-core';

// Two-level geographic hierarchy: Region (oblast, upperId IS NULL) and
// District (rayon, upperId → parent Region). Seeded from references/regions.json.
// Uses external IDs from finsum.uz — stable integers that map to the source system.
export const regions = pgTable('regions', {
  id: integer('id').primaryKey(),
  upperId: integer('upper_id').references((): AnyPgColumn => regions.id),
  nameRu: varchar('name_ru', { length: 200 }).notNull(),
  nameUz: varchar('name_uz', { length: 200 }).notNull(),
  nameUzc: varchar('name_uzc', { length: 200 }).notNull(),
});
