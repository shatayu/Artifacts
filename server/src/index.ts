import Fastify from "fastify";
import { config } from "./config.ts";
import { runMigrations } from "./db/migrate.ts";
import { listRoute } from "./routes/list.ts";
import { htmlRoute } from "./routes/html.ts";
import { queryRoute } from "./routes/query.ts";
import { syncRoute } from "./routes/sync.ts";

const fastify = Fastify({
  logger: {
    level: config.NODE_ENV === "production" ? "info" : "debug",
    transport:
      config.NODE_ENV === "production"
        ? undefined
        : { target: "pino-pretty", options: { colorize: true } },
  },
  bodyLimit: 10 * 1024 * 1024,
});

fastify.get("/healthz", async () => ({ ok: true, ts: Date.now() }));

await fastify.register(listRoute);
await fastify.register(htmlRoute);
await fastify.register(queryRoute);
await fastify.register(syncRoute);

async function main() {
  await runMigrations();
  await fastify.listen({ host: "0.0.0.0", port: config.PORT });
}

main().catch((e) => {
  fastify.log.error(e);
  process.exit(1);
});
