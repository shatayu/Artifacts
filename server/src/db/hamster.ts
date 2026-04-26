import pg from "pg";
import { config, isLocalDB } from "../config.ts";

export const hamsterPool = new pg.Pool({
  connectionString: config.HAMSTER_DB_URL,
  ssl: isLocalDB(config.HAMSTER_DB_URL) ? false : { rejectUnauthorized: false },
  max: 5,
});
