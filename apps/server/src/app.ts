import cors from "@fastify/cors";
import Fastify from "fastify";
import type { Bucket, ErrorResponse } from "@ai-water-usage/shared";
import { DashboardService } from "./service.js";
import { registerStaticRoutes } from "./static.js";

function isBucket(value: string): value is Bucket {
  return value === "day" || value === "week" || value === "month";
}

interface CreateAppOptions {
  service?: DashboardService;
  webDistDir?: string;
}

export function createApp(options: CreateAppOptions = {}) {
  const service = options.service ?? new DashboardService();
  const app = Fastify({ logger: false });
  void app.register(cors, { origin: true });

  app.get("/api/overview", async () => service.getOverview());

  app.get<{ Querystring: { bucket?: string; tz?: string } }>("/api/timeseries", async (request, reply) => {
    const bucket = request.query.bucket ?? "day";
    if (!isBucket(bucket)) {
      return reply.code(400).send({ error: "Invalid bucket. Expected day, week, or month." } satisfies ErrorResponse);
    }

    const timeZone = request.query.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    return service.getTimeseries(bucket, timeZone);
  });

  app.get("/api/methodology", async () => service.getMethodology());

  if (options.webDistDir) {
    registerStaticRoutes(app, options.webDistDir);
  }

  return app;
}
