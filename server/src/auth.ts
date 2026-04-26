import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.ts";

const expectedKey = Buffer.from(config.API_KEY, "utf8");

function extractKey(req: FastifyRequest): string {
  const auth = req.headers.authorization ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);

  const headerKey = req.headers["x-api-key"];
  if (typeof headerKey === "string" && headerKey) return headerKey;

  const queryKey = (req.query as { key?: string } | undefined)?.key;
  if (typeof queryKey === "string" && queryKey) return queryKey;

  return "";
}

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const provided = extractKey(req);
  const providedBuf = Buffer.from(provided, "utf8");

  if (
    providedBuf.length !== expectedKey.length ||
    !timingSafeEqual(providedBuf, expectedKey)
  ) {
    return reply.code(401).send({ error: "unauthorized" });
  }
}
