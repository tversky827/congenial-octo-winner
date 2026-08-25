import { execSync } from "node:child_process";

// Create a fresh test database schema once before the DB-backed tests run.
export default function setup() {
  execSync("prisma db push --force-reset --skip-generate", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
  });
}
