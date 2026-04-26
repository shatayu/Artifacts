import type { FastifyPluginAsync } from "fastify";
import { artifactsPool } from "../db/artifacts.ts";
import { requireAuth } from "../auth.ts";

interface SyncedArtifact {
  id: string;
  name: string;
  description: string | null;
  html: string;
  version_ts: number;
}

export const syncRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { artifacts: SyncedArtifact[] } }>(
    "/artifacts/sync",
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: "object",
          required: ["artifacts"],
          properties: {
            artifacts: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "name", "html", "version_ts"],
                properties: {
                  id: { type: "string", minLength: 1 },
                  name: { type: "string", minLength: 1 },
                  description: { type: ["string", "null"] },
                  html: { type: "string", minLength: 1 },
                  version_ts: { type: "number" },
                },
                additionalProperties: false,
              },
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (req) => {
      const incoming = req.body.artifacts;
      const ids = incoming.map((a) => a.id);

      const client = await artifactsPool.connect();
      let upserted = 0;
      let unstarred = 0;
      try {
        await client.query("BEGIN");

        for (const a of incoming) {
          const result = await client.query(
            `INSERT INTO artifacts (id, name, description, html, version_ts, is_starred, synced_at)
             VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
             ON CONFLICT (id) DO UPDATE SET
               name        = EXCLUDED.name,
               description = EXCLUDED.description,
               html        = EXCLUDED.html,
               version_ts  = EXCLUDED.version_ts,
               is_starred  = TRUE,
               synced_at   = NOW()
             WHERE artifacts.version_ts < EXCLUDED.version_ts
                OR artifacts.is_starred = FALSE`,
            [a.id, a.name, a.description, a.html, a.version_ts],
          );
          if ((result.rowCount ?? 0) > 0) upserted++;
        }

        const unstarResult = await client.query(
          `UPDATE artifacts
              SET is_starred = FALSE, synced_at = NOW()
            WHERE id != ALL($1) AND is_starred = TRUE`,
          [ids],
        );
        unstarred = unstarResult.rowCount ?? 0;

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }

      req.log.info({ upserted, unstarred }, "sync complete");
      return { ok: true, received: incoming.length, upserted, unstarred };
    },
  );
};
