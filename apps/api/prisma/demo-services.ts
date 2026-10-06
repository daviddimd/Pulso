import type { PrismaClient } from "../src/generated/prisma/client";
import { institutionalVehicles } from "./vehicle-catalog";
import { serviceText } from "./service-destinations";

const demoId = (n: number) => `d38d2026-0928-4001-8000-${String(n).padStart(12, "0")}`;

// Fixed IDs make repeated seeding preserve subsequent user changes.
export async function seedDemoServices(prisma: PrismaClient) {
  return prisma.$transaction(async tx => {
    const admin = await tx.user.findUniqueOrThrow({ where: { username: "admin" } });
    const costCenter = await tx.costCenter.findUniqueOrThrow({ where: { code: "1306" } });
    let created = 0;
    for (const [i, identity] of institutionalVehicles.entries()) {
      const id = demoId(i + 1);
      if (await tx.bitacoraEntry.findUnique({ where: { id } })) continue;
      const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { roleCode: identity.roleCode } });
      if (vehicle.licensePlate !== identity.licensePlate || vehicle.currentOdometerKm !== null ||
          await tx.serviceLeg.count({ where: { vehicleId: vehicle.id } })) {
        throw new Error(`No se inventarán lecturas sobre el vehículo ${identity.roleCode}: ya tiene datos. Importación revertida.`);
      }
      const driver = await tx.user.findUniqueOrThrow({ where: { username: `chofer${String(i + 1).padStart(2, "0")}` } });
      const startedAt = new Date(Date.UTC(2026, 8, 28, 11, i * 5));
      const endedAt = new Date(startedAt.getTime() + 30 * 60_000);
      const departure = 50000 + i * 10000;
      const arrival = departure + 12 + i * 3;
      const { serviceAddress: address, actionPerformed } = serviceText(i);
      await tx.bitacoraEntry.create({ data: {
        id, origin: "DEMO", costCenterId: costCenter.id, createdByUserId: admin.id, driverId: driver.id, vehicleId: vehicle.id,
        status: "COMPLETED", startedAt, endedAt, odometerKm: arrival,
        serviceAddress: address, actionPerformed,
        addressRevisions: { create: { revision: 1, address, source: "DEMO", createdAt: startedAt } },
        legs: { create: { driverId: driver.id, vehicleId: vehicle.id, startedAt, endedAt, departureOdometerKm: departure, arrivalOdometerKm: arrival } },
      } });
      await tx.vehicle.update({ where: { id: vehicle.id }, data: { currentOdometerKm: arrival } });
      await tx.auditLog.create({ data: { entityType: "VEHICLE", entityId: vehicle.id, action: "DEMO_ODOMETER",
        beforeData: { currentOdometerKm: null }, afterData: { currentOdometerKm: arrival, reason: "Lectura ficticia; sustituir antes del piloto real" } } });
      created++;
    }
    for (const [i, status] of (["PENDING", "ASSIGNED", "CANCELLED"] as const).entries()) {
      const id = demoId(20 + i);
      if (await tx.bitacoraEntry.findUnique({ where: { id } })) continue;
      const driver = await tx.user.findUniqueOrThrow({ where: { username: "chofer09" } });
      const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { roleCode: "7-513" } });
      const { serviceAddress: address, actionPerformed } = serviceText(8 + i);
      await tx.bitacoraEntry.create({ data: {
        id, origin: "DEMO", costCenterId: costCenter.id, createdByUserId: admin.id, status,
        driverId: status === "ASSIGNED" ? driver.id : null,
        vehicleId: status === "ASSIGNED" ? vehicle.id : null,
        serviceAddress: address, actionPerformed,
        ...(status === "CANCELLED" ? { cancelledAt: new Date("2026-09-28T14:00:00Z"), voidReason: "Solicitud cancelada antes de la salida por cambio de programación" } : {}),
        addressRevisions: { create: { revision: 1, address, source: "DEMO" } },
      } });
      created++;
    }
    if (created) await tx.auditLog.create({ data: { entityType: "DEMO", entityId: "demo-2026-09-28", action: "SEED", afterData: { created, fictional: true } } });
    return { created };
  }, { isolationLevel: "Serializable", timeout: 15000 });
}
