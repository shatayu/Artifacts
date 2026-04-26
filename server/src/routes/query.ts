import type { FastifyPluginAsync } from "fastify";
import { artifactsPool } from "../db/artifacts.ts";
import { hamsterPool } from "../db/hamster.ts";
import { requireAuth } from "../auth.ts";
import { validateAndPrepareSQL } from "../sql-safety.ts";
import { config } from "../config.ts";

export const queryRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { id: string }; Body: { sql: string } }>(
    "/artifacts/:id/query",
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: "object",
          required: ["sql"],
          properties: { sql: { type: "string" } },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const { rows: artifactRows } = await artifactsPool.query(
        `SELECT 1 FROM artifacts WHERE id = $1 AND is_starred = TRUE`,
        [req.params.id],
      );
      if (artifactRows.length === 0) {
        return reply.code(404).send({ error: "artifact not found" });
      }

      const result = validateAndPrepareSQL(req.body.sql);
      if (!result.ok) {
        return reply.code(400).send({ error: result.error });
      }

      const client = await hamsterPool.connect();
      try {
        await client.query(`SET statement_timeout = ${config.SQL_TIMEOUT_MS}`);
        const r = await client.query(result.sql);
        return {
          rows: r.rows,
          fields: r.fields.map((f) => ({
            name: f.name,
            dataTypeID: f.dataTypeID,
          })),
          rowCount: r.rowCount,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        req.log.warn({ err: msg, artifactId: req.params.id }, "query failed");
        return reply.code(400).send({ error: msg });
      } finally {
        client.release();
      }
    },
  );
};
