import type { FastifyPluginAsync } from "fastify";
import { artifactsPool } from "../db/artifacts.ts";
import { requireAuth } from "../auth.ts";

export const htmlRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>(
    "/artifacts/:id/html",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { rows } = await artifactsPool.query<{ html: string }>(
        `SELECT html FROM artifacts WHERE id = $1 AND is_starred = TRUE`,
        [req.params.id],
      );
      if (rows.length === 0) {
        return reply.code(404).send({ error: "artifact not found" });
      }
      reply.header("Content-Type", "text/html; charset=utf-8");
      return rows[0]!.html;
    },
  );
};
