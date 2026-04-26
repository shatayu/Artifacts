import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v || v === "CHANGEME") {
    throw new Error(`Missing or unset required env var: ${name}`);
  }
  return v;
}

export const config = {
  PORT: Number(process.env.PORT ?? 3000),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  ARTIFACTS_DB_URL: required("ARTIFACTS_DB_URL"),
  HAMSTER_DB_URL: required("HAMSTER_DB_URL"),
  API_KEY: required("API_KEY"),
  SQL_TIMEOUT_MS: Number(process.env.SQL_TIMEOUT_MS ?? 5000),
};

export const isLocalDB = (url: string) =>
  url.includes("localhost") || url.includes("127.0.0.1");
