import type { PrismaClient } from "../src/generated/prisma/client";
import { serviceText } from "./service-destinations";

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 20, 21, 22];
const oldIds = numbers.map(n => `d38d2026-0928-4000-8000-${String(n).padStart(12, "0")}`);

export async function replaceSampleServices(prisma: PrismaClient) {
  return prisma.$transaction(async tx => {
    const entries = await tx.bitacoraEntry.findMany({ where: { id: { in: oldIds } }, include: { legs: true, addressRevisions: true } });
    if (!entries.length) return { replaced: 0 };
    if (entries.length !== oldIds.length || entries.some(e => e.origin !== "DEMO" || e.version !== 0 || e.returnOfId || e.closurePending || e.legs.some(l => !l.endedAt))) {
      throw new Error("La semilla anterior fue modificada; se conserva sin cambios para evitar borrar viajes ajenos.");
    }
    if (await tx.bitacoraEntry.count({ where: { returnOfId: { in: oldIds } } })) throw new Error("Existen regresos asociados; no se reemplaza la semilla.");
    await tx.auditLog.create({ data: { entityType: "MAINTENANCE", entityId: "sample-addresses-20260928", action: "REPLACE_SAMPLE_SERVICES",
      beforeData: JSON.parse(JSON.stringify(entries)), afterData: { count: entries.length, addressSources: "prisma/service-destinations.ts", synthetic: true } } });
    await tx.bitacoraEntry.deleteMany({ where: { id: { in: oldIds } } });
    for (const entry of entries) {
      const { legs, addressRevisions: _revisions, id, ...data } = entry;
      const text = serviceText(oldIds.indexOf(id));
      await tx.bitacoraEntry.create({ data: {
        ...data, ...text, id: id.replace("-4000-", "-4001-"),
        voidReason: data.status === "CANCELLED" ? "Solicitud cancelada antes de la salida por cambio de programación" : null,
        addressRevisions: { create: { revision: 1, address: text.serviceAddress, source: "DEMO", createdAt: data.createdAt } },
        legs: { create: legs.map(({ id: _id, serviceId: _serviceId, ...leg }) => leg) },
      } });
    }
    return { replaced: entries.length };
  }, { isolationLevel: "Serializable", timeout: 15000 });
}
