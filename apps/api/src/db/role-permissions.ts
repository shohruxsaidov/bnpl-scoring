import { integer, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core';
import { roles } from './roles';

// Default-deny grant list: a row means the Feature is granted to the Role.
// Superadmin bypasses this table entirely (treated as holding every Feature).
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    feature: varchar('feature', { length: 50 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.feature] })],
);
