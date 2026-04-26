import type { FastifyPluginAsync } from "fastify";
import { artifactsPool } from "../db/artifacts.ts";
import { requireAuth } from "../auth.ts";

export const listRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/artifacts",
    { preHandler: requireAuth },
    async () => {
      const { rows } = await artifactsPool.query<{
        id: string;
        name: string;
        description: string | null;
        version_ts: string;
      }>(
        `SELECT id, name, description, version_ts
         FROM artifacts
         WHERE is_starred = TRUE
         ORDER BY name ASC`,
      );
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        version_ts: Number(r.version_ts),
      }));
    },
  );
};
