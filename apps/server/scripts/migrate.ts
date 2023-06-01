//* this file is used post install
import { sqlite_client, libsql_client } from "index";

import type { LibsqlError } from "@libsql/client";

// eslint-disable-next-line unicorn/no-process-exit
await migrate().then(() => process.exit(0));

async function migrate() {
  console.log("\nstarting migrating databases...\n");
  migrateSqlite();
  await migrateLibsql().catch(
    (error: LibsqlError) => error.code !== "SQLITE_CONSTRAINT" && console.error(error)
  );
}

export function migrateSqlite() {
  sqlite_client.run(
    "CREATE TABLE IF NOT EXISTS s (i TEXT PRIMARY KEY, f TEXT, t INTEGER)"
  );
  sqlite_client.run(
    "CREATE TABLE IF NOT EXISTS i (i TEXT PRIMARY KEY, c INTEGER NOT NULL, b INTEGER)"
  );
  console.log("\nfinished migrating sqlite\n");
}

async function migrateLibsql() {
  await libsql_client.execute(
    "CREATE TABLE IF NOT EXISTS c (i TEXT PRIMARY KEY, v TEXT, s TEXT)"
  );
  await libsql_client.execute(
    "CREATE TABLE IF NOT EXISTS f (i TEXT PRIMARY KEY, n TEXT, p TEXT)"
  );
  await libsql_client.execute(
    "CREATE TABLE IF NOT EXISTS p (i TEXT PRIMARY KEY, n TEXT, c TEXT)"
  );
  await libsql_client.execute(
    "CREATE TABLE IF NOT EXISTS r (i TEXT PRIMARY KEY, a TEXT)"
  );
  await libsql_client.execute(
    "INSERT OR FAIL INTO r (i, a) VALUES ('default', '')"
  );
  console.log("\nfinished migrating libsql\n");
}
