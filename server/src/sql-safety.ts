const READ_PREFIX = /^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*\s*(SELECT|WITH)\b/i;

const DEFAULT_LIMIT = 10000;

export type ValidationResult =
  | { ok: true; sql: string }
  | { ok: false; error: string };

export function validateAndPrepareSQL(input: string): ValidationResult {
  if (typeof input !== "string") {
    return { ok: false, error: "sql must be a string" };
  }

  const trimmed = input.trim().replace(/;\s*$/, "");

  if (trimmed.length === 0) {
    return { ok: false, error: "sql is empty" };
  }
  if (trimmed.length > 50_000) {
    return { ok: false, error: "sql too long" };
  }
  if (trimmed.includes(";")) {
    return { ok: false, error: "multiple statements not allowed" };
  }
  if (!READ_PREFIX.test(trimmed)) {
    return { ok: false, error: "only SELECT and WITH queries are allowed" };
  }

  const hasLimit = /\blimit\b/i.test(trimmed);
  const final = hasLimit ? trimmed : `${trimmed}\nLIMIT ${DEFAULT_LIMIT}`;
  return { ok: true, sql: final };
}
