// TODO get rid off all underscores
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

//* libsql_database tables

export const folders = sqliteTable("f", {
  id: text("i").primaryKey(),
  name: text("n"),
  page_ids: text("p"),
});

export const pages = sqliteTable("p", {
  id: text("i").primaryKey(),
  name: text("n"),
  content: text("c"),
});

export const contents = sqliteTable("c", {
  id: text("i").primaryKey(),
  value: text("v"),
  style: text("s"),
});

export const folder_reference = sqliteTable("r", {
  id: text("i").primaryKey(),
  ids: text("a"),
});

// * sqlite_database tables

export const subs = sqliteTable("s", {
  id: text("i").primaryKey(),
  folders: text("f"),
  t: integer("t"),
});

export const ips = sqliteTable("i", {
  ip: text("i").primaryKey(),
  //* count requests per second
  c: integer("c").notNull(),
  //* blacklisted
  b: integer("b"),
  //* warn // TODO allow up to 2 warnings per ip
  w: integer("w"),
});
