import pg from "pg";
import { config, isLocalDB } from "../config.ts";

export const artifactsPool = new pg.Pool({
  connectionString: config.ARTIFACTS_DB_URL,
  ssl: isLocalDB(config.ARTIFACTS_DB_URL)
    ? false
    : { rejectUnauthorized: false },
  max: 5,
});
