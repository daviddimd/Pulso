import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { getAuthenticatedUser } from "../../common/auth";
import { prisma } from "../../lib/prisma";
import { commands, listSchema, ServiceError, type ServiceCommand } from "./services.schemas";
import { commandService, createService, presentService, serviceInclude } from "./services.service";

export function serviceErrors(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: "INVALID_SERVICE_DATA" });
    if (error instanceof ServiceError) return reply.code(error.statusCode).send({ error: error.code, ...error.details });
    if (typeof error === "object" && error && "code" in error && ["P2002", "P2034"].includes(String(error.code))) return reply.code(409).send({ error: "SERVICE_CONFLICT" });
    request.log.error(error);
    return reply.code(500).send({ error: "INTERNAL_ERROR" });
  });
}
export async function serviceRoutes(app: FastifyInstance) {
  serviceErrors(app);
  app.post("/", async (req, reply) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    return reply.code(201).send({ entry: await createService(user, req.body, req.ip) });
  });
  for (const route of ["/", "/mine"]) app.get(route, async (req, reply) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    if (route === "/" && user.role !== "ADMIN") return reply.code(403).send({ error: "FORBIDDEN" });
    const query = listSchema.parse(req.query);
    if ((query.driverId || query.vehicleId) && user.role !== "ADMIN") throw new ServiceError("FORBIDDEN", 403);
    const where = { ...(route === "/mine" ? { driverId: user.id } : {}), ...(query.status ? { status: query.status } : {}),
      AND: [
        ...(query.driverId ? [{ OR: [{ driverId: query.driverId }, { legs: { some: { driverId: query.driverId } } }] }] : []),
        ...(query.vehicleId ? [{ OR: [{ vehicleId: query.vehicleId }, { legs: { some: { vehicleId: query.vehicleId } } }] }] : []),
      ],
    };
    const [entries, total] = await prisma.$transaction([
      prisma.bitacoraEntry.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * 30, take: 30, include: serviceInclude }),
      prisma.bitacoraEntry.count({ where }),
    ]);
    const active = route === "/mine" ? await prisma.bitacoraEntry.findMany({ where: { driverId: user.id, OR: [{ status: "IN_PROGRESS" }, { closurePending: true }] }, include: serviceInclude }) : [];
    const upcoming = route === "/mine" ? await prisma.bitacoraEntry.findMany({ where: { driverId: user.id, status: { in: ["PENDING", "ASSIGNED"] } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: serviceInclude }) : [];
    return { entries: entries.map(presentService), active: active.map(presentService), upcoming: upcoming.map(presentService), total, page: query.page };
  });
  app.get("/:id", async (req, reply) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const entry = await prisma.bitacoraEntry.findUnique({ where: { id }, include: serviceInclude });
    if (!entry) throw new ServiceError("ENTRY_NOT_FOUND", 404);
    if (user.role !== "ADMIN" && entry.driverId !== user.id) throw new ServiceError("FORBIDDEN", 403);
    return { entry: presentService(entry) };
  });
  app.get("/:id/audit", async (req, reply) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    if (user.role !== "ADMIN") throw new ServiceError("FORBIDDEN", 403);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const logs = await prisma.auditLog.findMany({ where: { entityType: "BITACORA", entityId: id }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, action: true, createdAt: true, actor: { select: { fullName: true } } } });
    return { logs: logs.map(l => ({ ...l, id: String(l.id) })) };
  });
  for (const command of Object.keys(commands) as ServiceCommand[]) app.post(`/:id/${command}`, async (req, reply) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    return { entry: await commandService(user, id, command, req.body, req.ip) };
  });
}
