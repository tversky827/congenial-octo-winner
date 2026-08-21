// Generates a Postgres version of the Prisma schema for cloud deployment,
// derived from the SQLite schema so there's a single source of truth.
//
// Local development uses prisma/schema.prisma (SQLite, zero-config).
// The cloud build runs this script to emit prisma/schema.production.prisma
// (PostgreSQL) and points Prisma at it. Keeps both working without drift.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "prisma");
const src = readFileSync(join(dir, "schema.prisma"), "utf8");

// Swap the datasource block for a Postgres one. `directUrl` is used for
// schema pushes/migrations (a direct, non-pooled connection); `url` is the
// pooled connection the app uses at runtime.
const postgresDatasource = `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`;

const out = src.replace(/datasource\s+db\s*\{[\s\S]*?\}/, postgresDatasource);

if (!out.includes('provider  = "postgresql"')) {
  console.error("Failed to rewrite datasource block — check prisma/schema.prisma");
  process.exit(1);
}

writeFileSync(join(dir, "schema.production.prisma"), out);
console.log("Wrote prisma/schema.production.prisma (PostgreSQL)");
