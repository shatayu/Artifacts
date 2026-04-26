import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { artifactsPool } from "./artifacts.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

const TRANSIENT_PG_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNRESET",
]);

// Render rotates Postgres internal IPs during maintenance/scaling. If a deploy
// lands at the wrong instant, the first DB connection gets ECONNREFUSED and
// crashes the process (we hit this once when the artifacts-db updatedAt
// matched the deploy timestamp). Retry the initial probe with backoff so a
// brief window of unreachability doesn't take down the service.
async function waitForDB(maxAttempts = 8): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await artifactsPool.query("SELECT 1");
      return;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (!code || !TRANSIENT_PG_ERROR_CODES.has(code) || attempt === maxAttempts) {
        throw e;
      }
      const delay = Math.min(500 * 2 ** (attempt - 1), 5000);
      console.warn(
        `[migrate] DB not reachable (${code}); attempt ${attempt}/${maxAttempts}, retrying in ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export async function runMigrations(): Promise<void> {
  await waitForDB();

  await artifactsPool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const { rows } = await artifactsPool.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations WHERE filename = $1",
      [file],
    );
    if (rows.length > 0) continue;

    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    console.log(`[migrate] applying ${file}`);

    const client = await artifactsPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [file],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  console.log("[migrate] done");
}
