import { env } from '@env';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const sql = postgres(env.DATABASE_URL!, { max: 1 });
const db = drizzle(sql);

try {
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  console.log('done');
} catch (err: any) {
  console.error(err); // stack
  console.error({
    // postgres.js puts the good stuff here
    message: err.message,
    detail: err.detail,
    hint: err.hint,
    position: err.position,
    where: err.where,
    file: err.file,
    query: err.query,
  });
  process.exit(1);
} finally {
  await sql.end();
}
