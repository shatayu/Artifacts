import { runMigrations } from "../src/db/migrate.ts";
import { artifactsPool } from "../src/db/artifacts.ts";

runMigrations()
  .then(() => artifactsPool.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
