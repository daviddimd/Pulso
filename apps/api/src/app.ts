import Fastify from "fastify";
import cookie from "@fastify/cookie";

import { prisma } from "./lib/prisma";
import { authRoutes } from "./modules/auth/auth.routes";
import { vehicleRoutes } from "./modules/vehicles/vehicles.routes";
import { adminRoutes } from "./modules/admin/admin.routes";
import { exportRoutes } from "./modules/exports/export.routes";
import { bitacoraRoutes } from "./modules/bitacoras/bitacoras.routes";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import { env } from "./config/env";
import rateLimit from "@fastify/rate-limit";

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  app.register(cookie);

  app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: [
      "GET",
      "HEAD",
      "POST",
      "PATCH",
      "OPTIONS",
    ],
  });

  app.register(helmet);

  app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  });

  app.get("/health", async () => {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "ok",
      service: "Pulso API",
      database: "connected",
    };
  });

  app.register(authRoutes, {
    prefix: "/api/auth",
  });

  app.register(adminRoutes, {
    prefix: "/api/admin",
  });

  app.register(vehicleRoutes, {
    prefix: "/api/vehicles",
  });
  app.register(bitacoraRoutes, {
    prefix: "/api/bitacoras",
  });
  app.register(exportRoutes, {
    prefix: "/api/exports",
  });

  return app;
}