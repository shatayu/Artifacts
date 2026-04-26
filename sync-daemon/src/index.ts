import { config } from "./config.ts";
import {
  getWorkspaceDir,
  readManifest,
  getSessionAuditPath,
} from "./sources.ts";
import { extractLatestHtml } from "./extract.ts";
import { uploadSync, type SyncedArtifact } from "./upload.ts";

function ts(): string {
  return new Date().toISOString();
}

async function syncOnce(): Promise<void> {
  const workspaceDir = getWorkspaceDir();
  const manifest = readManifest(workspaceDir);
  const pinned = manifest.filter((a) => a.isStarred);

  console.log(
    `[${ts()}] [sync] ${pinned.length} pinned artifact(s) in manifest`,
  );

  const synced: SyncedArtifact[] = [];
  for (const a of pinned) {
    const auditPath = getSessionAuditPath(
      workspaceDir,
      a.lastModifiedBySessionId,
    );
    const html = extractLatestHtml(auditPath, a.id);
    if (!html) {
      console.warn(
        `[${ts()}] [sync] no html found for ${a.id} (session ${a.lastModifiedBySessionId})`,
      );
      continue;
    }
    synced.push({
      id: a.id,
      name: a.name,
      description: a.description ?? null,
      html,
      version_ts: a.updatedAt ?? a.createdAt,
    });
  }

  const result = await uploadSync(synced);
  console.log(
    `[${ts()}] [sync] uploaded received=${result.received} upserted=${result.upserted} unstarred=${result.unstarred}`,
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isOnce = args.includes("--once");

  if (isOnce) {
    await syncOnce();
    return;
  }

  console.log(
    `[${ts()}] [sync] watch mode (every ${config.POLL_INTERVAL_MS}ms)`,
  );
  while (true) {
    try {
      await syncOnce();
    } catch (e) {
      console.error(`[${ts()}] [sync] error:`, e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, config.POLL_INTERVAL_MS));
  }
}

main().catch((e) => {
  console.error(`[${ts()}] [sync] fatal:`, e);
  process.exit(1);
});
