import { readFileSync, existsSync } from "node:fs";

const ARTIFACT_TOOL_NAMES = new Set([
  "mcp__cowork__create_artifact",
  "mcp__cowork__update_artifact",
]);

interface AuditEntry {
  message?: {
    content?: Array<{
      type?: string;
      name?: string;
      input?: { id?: string; html?: string };
    }>;
  };
}

export function extractLatestHtml(
  auditPath: string,
  artifactId: string,
): string | null {
  if (!existsSync(auditPath)) return null;

  const data = readFileSync(auditPath, "utf8");
  const lines = data.split("\n");

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line) continue;

    let entry: AuditEntry;
    try {
      entry = JSON.parse(line) as AuditEntry;
    } catch {
      continue;
    }

    const content = entry.message?.content;
    if (!Array.isArray(content)) continue;

    for (const c of content) {
      if (
        c?.type === "tool_use" &&
        c.name &&
        ARTIFACT_TOOL_NAMES.has(c.name) &&
        c.input?.id === artifactId &&
        typeof c.input.html === "string" &&
        c.input.html.length > 0
      ) {
        return c.input.html;
      }
    }
  }
  return null;
}
