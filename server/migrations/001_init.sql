CREATE TABLE IF NOT EXISTS artifacts (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  html         TEXT NOT NULL,
  version_ts   BIGINT NOT NULL,
  is_starred   BOOLEAN NOT NULL DEFAULT TRUE,
  synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS artifacts_is_starred_idx
  ON artifacts (is_starred) WHERE is_starred;
