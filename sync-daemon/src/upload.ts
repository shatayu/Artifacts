import { config } from "./config.ts";

export interface SyncedArtifact {
  id: string;
  name: string;
  description: string | null;
  html: string;
  version_ts: number;
}

export async function uploadSync(
  artifacts: SyncedArtifact[],
): Promise<{ received: number; upserted: number; unstarred: number }> {
  const url = `${config.API_BASE_URL.replace(/\/$/, "")}/artifacts/sync`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ artifacts }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sync failed (${res.status}): ${body.slice(0, 500)}`);
  }
  return (await res.json()) as {
    received: number;
    upserted: number;
    unstarred: number;
  };
}
