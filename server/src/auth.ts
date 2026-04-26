import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.ts";

const expectedKey = Buffer.from(config.API_KEY, "utf8");

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const auth = req.headers.authorization ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const providedBuf = Buffer.from(provided, "utf8");

  if (
    providedBuf.length !== expectedKey.length ||
    !timingSafeEqual(providedBuf, expectedKey)
  ) {
    return reply.code(401).send({ error: "unauthorized" });
  }
}
