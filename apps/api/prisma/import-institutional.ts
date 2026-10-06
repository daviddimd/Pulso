import type { PrismaClient } from "../src/generated/prisma/client";
import argon2 from "argon2";
import { costCenterCatalog, officialDrivers } from "./institutional-data";

export async function importCostCenters(prisma: PrismaClient) {
  await prisma.$transaction(async tx => {
    for (const center of costCenterCatalog) await tx.costCenter.upsert({ where: { code: center.code }, update: { name: center.name }, create: { id: `c0000000-0000-4000-8000-${center.code.padStart(12, "0")}`, ...center } });
  }, { timeout: 20000 });
}
const fictionalNames = ["Mauricio Rojas", "Rodrigo González", "Cristian Muñoz", "Francisco Tapia", "Luis Contreras", "Jorge Valdés", "Patricio Morales", "Héctor Aravena", "Claudio Fuentes", "Sergio Bustamante"];
export async function importDrivers(prisma: PrismaClient) {
  const passwordHash = await argon2.hash("chofer", { type: argon2.argon2id });
  return prisma.$transaction(async tx => {
    let archived = 0, created = 0;
    for (const [i, fullName] of fictionalNames.entries()) {
      const username = `chofer${String(i + 1).padStart(2, "0")}`;
      const old = await tx.user.findUnique({ where: { username } });
      if (!old || old.rosterCode) continue;
      if (old.fullName !== fullName || old.role !== "DRIVER") throw new Error(`La cuenta ${username} no coincide con la semilla. Revisar identidad antes de importar.`);
      if (await tx.serviceLeg.count({ where: { driverId: old.id, endedAt: null } })) throw new Error(`Cerrar el viaje activo de ${username} antes de reemplazar la nómina.`);
      await tx.user.update({ where: { id: old.id }, data: { username: `archived-${old.id}`, active: false } });
      await tx.session.updateMany({ where: { userId: old.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { entityType: "USER", entityId: old.id, action: "ARCHIVE_FIXTURE", beforeData: { username, fullName, active: old.active }, afterData: { active: false, source: "PERSONAL MOVILIZACION 2026_xx.xlsx" } } });
      archived++;
    }
    for (const driver of officialDrivers) {
      const existing = await tx.user.findUnique({ where: { rosterCode: driver.rosterCode } });
      if (existing) continue;
      const user = await tx.user.create({ data: { ...driver, passwordHash, role: "DRIVER" } });
      await tx.auditLog.create({ data: { entityType: "USER", entityId: user.id, action: "ROSTER_IMPORT", afterData: { ...driver, source: "PERSONAL MOVILIZACION 2026_xx.xlsx" } } });
      created++;
    }
    return { created, archived };
  }, { isolationLevel: "Serializable", timeout: 20000 });
}
