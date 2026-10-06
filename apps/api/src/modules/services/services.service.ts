import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { createAuditLog } from "../audit/audit.service";
import { commands, createServiceSchema, distance, ServiceError, validateArrival, type ServiceCommand } from "./services.schemas";

type Tx = Prisma.TransactionClient;
export type Actor = { id: string; role: "DRIVER" | "ADMIN" };
export const serviceInclude = {
  costCenter: true,
  driver: { select: { id: true, fullName: true } },
  vehicle: { select: { id: true, roleCode: true, licensePlate: true, model: true, currentOdometerKm: true } },
  legs: { orderBy: { startedAt: "asc" }, include: {
    driver: { select: { id: true, fullName: true } },
    vehicle: { select: { id: true, roleCode: true, licensePlate: true, model: true } },
  } },
  addressRevisions: { orderBy: { revision: "desc" }, include: { actor: { select: { fullName: true } } } },
  returnService: { select: { id: true } },
} satisfies Prisma.BitacoraEntryInclude;
type Entry = Prisma.BitacoraEntryGetPayload<{ include: typeof serviceInclude }>;
export function presentService(entry: Entry) {
  return { ...entry, distanceKm: distance(entry.legs), originalAddress: entry.addressRevisions.at(-1)?.address ?? entry.serviceAddress };
}
export function atomic<T>(fn: (tx: Tx) => Promise<T>) {
  return prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
async function audit(tx: Tx, actor: Actor, id: string, action: string, beforeData: unknown, afterData: unknown, ip: string) {
  await createAuditLog({ actorUserId: actor.id, entityType: "BITACORA", entityId: id, action, beforeData, afterData, ipAddress: ip }, tx);
}
async function resources(tx: Tx, driverId: string | null, vehicleId: string | null) {
  if (driverId && !await tx.user.findFirst({ where: { id: driverId, active: true, role: "DRIVER" } })) throw new ServiceError("DRIVER_UNAVAILABLE");
  if (vehicleId && !await tx.vehicle.findFirst({ where: { id: vehicleId, active: true } })) throw new ServiceError("VEHICULO_NO_DISPONIBLE");
}
async function openLeg(tx: Tx, id: string, driverId: string | null, vehicleId: string | null) {
  if (!driverId || !vehicleId) throw new ServiceError("ASSIGNMENT_REQUIRED");
  await resources(tx, driverId, vehicleId);
  if (await tx.serviceLeg.findFirst({ where: { driverId, endedAt: null } })) throw new ServiceError("EL_CHOFER_YA_COMENZO_EL_SERVICIO");
  if (await tx.serviceLeg.findFirst({ where: { vehicleId, endedAt: null } })) throw new ServiceError("EL_VEHICULO_YA_ESTA_EN_USO");
  const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
  if (vehicle.currentOdometerKm === null) throw new ServiceError("INITIAL_ODOMETER_REQUIRED");
  return tx.serviceLeg.create({ data: { serviceId: id, driverId, vehicleId, startedAt: new Date(), departureOdometerKm: vehicle.currentOdometerKm } });
}
async function closeLeg(tx: Tx, entry: Entry, odometerKm: number) {
  const leg = entry.legs.find(l => l.endedAt === null);
  if (!leg) throw new ServiceError("NO_ACTIVE_LEG");
  const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: leg.vehicleId } });
  validateArrival(odometerKm, leg.departureOdometerKm, vehicle.currentOdometerKm);
  await tx.serviceLeg.update({ where: { id: leg.id }, data: { endedAt: new Date(), arrivalOdometerKm: odometerKm } });
  await tx.vehicle.update({ where: { id: leg.vehicleId }, data: { currentOdometerKm: odometerKm } });
}
async function create(tx: Tx, actor: Actor, input: unknown, ip: string, returnOfId?: string) {
  const body = createServiceSchema.parse(input);
  if (!await tx.costCenter.findFirst({ where: { id: body.costCenterId, active: true } })) throw new ServiceError("COST_CENTER_UNAVAILABLE", 400);
  if (actor.role === "DRIVER" && body.driverId && body.driverId !== actor.id) throw new ServiceError("FORBIDDEN", 403);
  const driverId = actor.role === "DRIVER" ? actor.id : body.driverId ?? null;
  const vehicleId = body.vehicleId ?? null;
  await resources(tx, driverId, vehicleId);
  if (body.startNow && actor.role !== "DRIVER") throw new ServiceError("ONLY_DRIVER_CAN_START", 403);
  const entry = await tx.bitacoraEntry.create({ data: {
    driverId, vehicleId, costCenterId: body.costCenterId, createdByUserId: actor.id, origin: actor.role,
    status: driverId ? "ASSIGNED" : "PENDING", serviceAddress: body.serviceAddress,
    actionPerformed: body.actionPerformed, ...(returnOfId ? { returnOfId } : {}),
    addressRevisions: { create: { revision: 1, address: body.serviceAddress, actorUserId: actor.id } },
  } });
  await audit(tx, actor, entry.id, "CREATE", undefined, entry, ip);
  if (body.startNow) {
    const leg = await openLeg(tx, entry.id, driverId, vehicleId);
    await tx.bitacoraEntry.update({ where: { id: entry.id }, data: { status: "IN_PROGRESS", startedAt: leg.startedAt } });
    await audit(tx, actor, entry.id, "START", undefined, leg, ip);
  }
  return presentService(await tx.bitacoraEntry.findUniqueOrThrow({ where: { id: entry.id }, include: serviceInclude }));
}
export function createService(actor: Actor, input: unknown, ip: string) { return atomic(tx => create(tx, actor, input, ip)); }

export function commandService(actor: Actor, id: string, command: ServiceCommand, input: unknown, ip: string) {
  return atomic(async tx => {
    const parsed = commands[command].parse(input);
    const entry = await tx.bitacoraEntry.findUnique({ where: { id }, include: serviceInclude });
    if (!entry) throw new ServiceError("ENTRY_NOT_FOUND", 404);
    if (actor.role !== "ADMIN" && entry.driverId !== actor.id) throw new ServiceError("FORBIDDEN", 403);
    if (entry.version !== parsed.version) throw new ServiceError("STALE_SERVICE");
    let data: Prisma.BitacoraEntryUncheckedUpdateInput = { version: { increment: 1 } };
    switch (command) {
      case "cost-center": {
        if (actor.role !== "ADMIN") throw new ServiceError("FORBIDDEN", 403);
        const body = commands["cost-center"].parse(input);
        if (!await tx.costCenter.findFirst({ where: { id: body.costCenterId, active: true } })) throw new ServiceError("COST_CENTER_UNAVAILABLE", 400);
        data.costCenterId = body.costCenterId;
        break;
      }
      case "address": {
        if (actor.role !== "ADMIN") throw new ServiceError("FORBIDDEN", 403);
        const body = commands.address.parse(input);
        const revision = (entry.addressRevisions[0]?.revision ?? 0) + 1;
        await tx.serviceAddressRevision.create({ data: { serviceId: id, revision, address: body.serviceAddress, actorUserId: actor.id } });
        data.serviceAddress = body.serviceAddress;
        break;
      }
      case "assignment": {
        if (actor.role !== "ADMIN") throw new ServiceError("FORBIDDEN", 403);
        if (!["PENDING", "ASSIGNED", "IN_PROGRESS"].includes(entry.status)) throw new ServiceError("INVALID_TRANSITION");
        const body = commands.assignment.parse(input);
        if (body.driverId === entry.driverId && body.vehicleId === entry.vehicleId) throw new ServiceError("ASSIGNMENT_UNCHANGED");
        await resources(tx, body.driverId, body.vehicleId);
        if (entry.status === "IN_PROGRESS") {
          if (body.odometerKm === undefined || !body.vehicleId) throw new ServiceError("HANDOVER_ODOMETER_REQUIRED");
          await closeLeg(tx, entry, body.odometerKm);
          await openLeg(tx, id, body.driverId, body.vehicleId);
        }
        data = { ...data, driverId: body.driverId, vehicleId: body.vehicleId, status: entry.status === "IN_PROGRESS" ? "IN_PROGRESS" : "ASSIGNED" };
        break;
      }
      case "start": {
        if (!entry.costCenterId) throw new ServiceError("COST_CENTER_REQUIRED", 400);
        if (actor.role !== "DRIVER") throw new ServiceError("FORBIDDEN", 403);
        if (entry.status !== "ASSIGNED") throw new ServiceError("INVALID_TRANSITION");
        const body = commands.start.parse(input);
        if (entry.vehicleId && body.vehicleId && body.vehicleId !== entry.vehicleId) throw new ServiceError("ADMIN_REASSIGNMENT_REQUIRED", 403);
        const vehicleId = body.vehicleId ?? entry.vehicleId;
        const leg = await openLeg(tx, id, actor.id, vehicleId);
        data = { ...data, vehicleId, status: "IN_PROGRESS", startedAt: leg.startedAt };
        break;
      }
      case "complete":
      case "close-cancellation": {
        if (actor.role !== "DRIVER") throw new ServiceError("FORBIDDEN", 403);
        if (command === "complete" ? entry.status !== "IN_PROGRESS" : entry.status !== "CANCELLED" || !entry.closurePending) throw new ServiceError("ENTRY_NOT_OPEN");
        const body = commands[command].parse(input);
        await closeLeg(tx, entry, body.odometerKm);
        data = { ...data, status: command === "complete" ? "COMPLETED" : "CANCELLED", closurePending: false, endedAt: new Date(), odometerKm: body.odometerKm };
        break;
      }
      case "cancel": {
        if (actor.role !== "ADMIN") throw new ServiceError("FORBIDDEN", 403);
        if (!["PENDING", "ASSIGNED", "IN_PROGRESS"].includes(entry.status)) throw new ServiceError("INVALID_TRANSITION");
        data = { ...data, status: "CANCELLED", cancelledAt: new Date(), voidReason: commands.cancel.parse(input).reason, closurePending: entry.status === "IN_PROGRESS" };
        break;
      }
      case "return": {
        if (entry.status !== "CANCELLED" || entry.closurePending || !entry.legs.length || entry.returnService) throw new ServiceError("RETURN_NOT_AVAILABLE");
        const body = commands.return.parse(input);
        if (!entry.costCenterId) throw new ServiceError("COST_CENTER_REQUIRED", 400);
        const result = await create(tx, actor, { serviceAddress: body.serviceAddress, actionPerformed: body.actionPerformed, costCenterId: entry.costCenterId, driverId: entry.driverId, vehicleId: entry.vehicleId, startNow: body.startNow }, ip, id);
        await tx.bitacoraEntry.update({ where: { id }, data });
        await audit(tx, actor, id, "RETURN", undefined, { returnServiceId: result.id }, ip);
        return result;
      }
    }
    await tx.bitacoraEntry.update({ where: { id }, data });
    const updated = await tx.bitacoraEntry.findUniqueOrThrow({ where: { id }, include: serviceInclude });
    await audit(tx, actor, id, command === "complete" ? "FINALIZE" : command.toUpperCase(), entry, updated, ip);
    return presentService(updated);
  });
}
