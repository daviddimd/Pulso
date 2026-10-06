import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthenticatedUser } from "../../common/auth";
import { prisma } from "../../lib/prisma";
import { atomic } from "../services/services.service";
import { km, ServiceError } from "../services/services.schemas";
import { serviceErrors } from "../services/services.routes";
import { createAuditLog } from "../audit/audit.service";
function defined<T extends object>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as { [K in keyof T]: Exclude<T[K], undefined> };
}

const fields = { roleCode: z.string().trim().min(1).max(30), licensePlate: z.string().trim().min(3).max(20).transform(s => s.toUpperCase()), vehicleType: z.string().trim().min(2).max(60).nullable().optional(), model: z.string().trim().min(1).max(120).nullable().optional(), year: z.number().int().min(1900).max(2100).nullable().optional(), active: z.boolean().optional() };
export async function vehicleRoutes(app: FastifyInstance) {
  serviceErrors(app);
  app.get("/", async (req, reply) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const vehicles = await prisma.vehicle.findMany({ where: user.role === "ADMIN" ? {} : { active: true }, orderBy: { roleCode: "asc" },
      select: { id: true, roleCode: true, licensePlate: true, vehicleType: true, model: true, year: true, active: true, currentOdometerKm: true, updatedAt: true, serviceLegs: { where: { endedAt: null }, select: { serviceId: true } } } });
    return { vehicles: vehicles.map(({ serviceLegs, ...v }) => ({ ...v, inService: serviceLegs.length > 0 })) };
  });
  app.post("/", async (req, reply) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    if (user.role !== "ADMIN") throw new ServiceError("FORBIDDEN", 403);
    const body = z.object({ ...fields, currentOdometerKm: km }).strict().parse(req.body);
    const vehicle = await atomic(async tx => {
      const result = await tx.vehicle.create({ data: defined(body) });
      await createAuditLog({ actorUserId: user.id, entityType: "VEHICLE", entityId: result.id, action: "CREATE", afterData: result, ipAddress: req.ip }, tx);
      return result;
    });
    return reply.code(201).send({ vehicle });
  });
  app.patch("/:id", async (req, reply) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    if (user.role !== "ADMIN") throw new ServiceError("FORBIDDEN", 403);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    // Identity fields belong exclusively to registration, never to updates.
    const body = z.object({ roleCode: fields.roleCode.optional(), active: fields.active, expectedUpdatedAt: z.string().datetime(), currentOdometerKm: km.optional(), reason: z.string().trim().min(3).max(500).optional() }).strict().parse(req.body);
    return { vehicle: await atomic(async tx => {
      const before = await tx.vehicle.findUnique({ where: { id } });
      if (!before) throw new ServiceError("VEHICLE_NOT_FOUND", 404);
      if (before.updatedAt.toISOString() !== body.expectedUpdatedAt) throw new ServiceError("STALE_SERVICE");
      if ((body.active === false || body.currentOdometerKm !== undefined) && await tx.serviceLeg.findFirst({ where: { vehicleId: id, endedAt: null } })) throw new ServiceError("VEHICLE_IN_SERVICE");
      if (body.currentOdometerKm !== undefined && !body.reason) throw new ServiceError("ADJUSTMENT_REASON_REQUIRED", 400);
      const { expectedUpdatedAt, reason, ...data } = body;
      const vehicle = await tx.vehicle.update({ where: { id }, data: defined(data) });
      await createAuditLog({ actorUserId: user.id, entityType: "VEHICLE", entityId: id, action: body.currentOdometerKm !== undefined ? "ODOMETER_ADJUSTMENT" : "UPDATE", beforeData: before, afterData: { ...vehicle, reason }, ipAddress: req.ip }, tx);
      return vehicle;
    }) };
  });
}
