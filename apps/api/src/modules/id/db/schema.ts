import { bigserial, pgTable, timestamp } from "drizzle-orm/pg-core";

export const Users = pgTable("users", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
  }).defaultNow(),
});

export const Clients = pgTable("clients", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
  }).defaultNow(),
});
