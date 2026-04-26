import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v || v === "CHANGEME") {
    throw new Error(`Missing or unset required env var: ${name}`);
  }
  return v;
}

export const config = {
  API_BASE_URL: required("API_BASE_URL"),
  API_KEY: required("API_KEY"),
  POLL_INTERVAL_MS: Number(process.env.POLL_INTERVAL_MS ?? 60_000),
  CLAUDE_WORKSPACE_DIR: process.env.CLAUDE_WORKSPACE_DIR,
};
