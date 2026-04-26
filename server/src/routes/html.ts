import type { FastifyPluginAsync } from "fastify";
import { artifactsPool } from "../db/artifacts.ts";
import { requireAuth } from "../auth.ts";

function coworkPolyfill(artifactId: string): string {
  // ARTIFACT_ID is JSON-encoded so any future ids with quotes/backslashes can't break out.
  // KEY is read from this iframe's own URL so the polyfill is self-contained.
  return `<script>
(function () {
  var ARTIFACT_ID = ${JSON.stringify(artifactId)};
  var KEY = new URLSearchParams(window.location.search).get("key") || "";
  window.cowork = {
    callMcpTool: async function (tool, args) {
      if (tool !== "mcp__hamster-db__query") {
        return {
          isError: true,
          structuredContent: null,
          content: [{ type: "text", text: "unsupported tool: " + tool }],
        };
      }
      var res = await fetch("/artifacts/" + encodeURIComponent(ARTIFACT_ID) + "/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + KEY,
        },
        body: JSON.stringify({ sql: (args && args.sql) || "" }),
      });
      if (!res.ok) {
        var text = await res.text();
        return {
          isError: true,
          structuredContent: null,
          content: [{ type: "text", text: text }],
        };
      }
      var data = await res.json();
      var rows = data.rows || [];
      return {
        isError: false,
        structuredContent: rows,
        content: [{ type: "text", text: JSON.stringify(rows) }],
      };
    },
  };
})();
</script>
`;
}

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
      return coworkPolyfill(req.params.id) + rows[0]!.html;
    },
  );
};
