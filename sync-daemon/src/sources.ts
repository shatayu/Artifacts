import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export interface ArtifactManifestEntry {
  id: string;
  name: string;
  description?: string;
  isStarred: boolean;
  createdAt: number;
  updatedAt?: number;
  lastModifiedBySessionId: string;
  createdBySessionId: string;
  versions?: number[];
  mcpTools?: string[];
}

const DEFAULT_WORKSPACE_DIR = path.join(
  os.homedir(),
  "Library/Application Support/Claude/local-agent-mode-sessions",
  "3cac6382-4eed-4c3c-adda-a3b49db1c031",
  "351936ed-a38a-42fd-a05b-ac73f950c80e",
);

export function getWorkspaceDir(): string {
  const dir = process.env.CLAUDE_WORKSPACE_DIR ?? DEFAULT_WORKSPACE_DIR;
  if (!existsSync(path.join(dir, "artifacts.json"))) {
    throw new Error(
      `No artifacts.json in ${dir}. Set CLAUDE_WORKSPACE_DIR in .env to override.`,
    );
  }
  return dir;
}

export function readManifest(workspaceDir: string): ArtifactManifestEntry[] {
  const file = path.join(workspaceDir, "artifacts.json");
  return JSON.parse(readFileSync(file, "utf8")) as ArtifactManifestEntry[];
}

export function getSessionAuditPath(
  workspaceDir: string,
  sessionId: string,
): string {
  return path.join(workspaceDir, sessionId, "audit.jsonl");
}
