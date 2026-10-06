import "dotenv/config";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { institutionalVehicles } from "./vehicle-catalog";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || new URL(connectionString).pathname !== "/pulso_dev" || process.env.NODE_ENV === "production" || process.env.PULSO_TEST_SCHEMA) {
  throw new Error("Esta limpieza autorizada se limita a pulso_dev/public.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
async function main() {
  const result = await prisma.$transaction(async tx => {
    const all = await tx.vehicle.findMany();
    const keep = institutionalVehicles.map(v => {
      const match = all.find(a => a.roleCode === v.roleCode && a.licensePlate === v.licensePlate);
      if (!match) throw new Error("Falta un vehículo del catálogo: " + v.roleCode);
      return match.id;
    });
    const vehicles = all.filter(v => !keep.includes(v.id));
    const ids = vehicles.map(v => v.id);
    if (!ids.length) return { deletedVehicles: 0, deletedServices: 0 };
    const services = await tx.bitacoraEntry.findMany({
      where: { OR: [{ vehicleId: { in: ids } }, { legs: { some: { vehicleId: { in: ids } } } }] },
      include: { legs: true, addressRevisions: true },
    });
    const serviceIds = services.map(s => s.id);
    // Do not extend the user's approval to new or unrelated records.
    if (vehicles.length !== 8 || services.length !== 15) throw new Error("Los datos cambiaron respecto a los 8 vehículos y 15 servicios autorizados. Revisar antes de borrar.");
    if (services.some(s => s.legs.some(l => l.endedAt === null || keep.includes(l.vehicleId)) || (s.vehicleId && keep.includes(s.vehicleId)))) {
      throw new Error("Hay un viaje activo o asociado al catálogo conservado; no se elimina.");
    }
    if (await tx.bitacoraEntry.count({ where: { id: { notIn: serviceIds }, returnOfId: { in: serviceIds } } })) {
      throw new Error("Hay regresos externos al conjunto autorizado; no se elimina.");
    }
    const auditLogs = await tx.auditLog.findMany({ where: { entityId: { in: [...ids, ...serviceIds] } } });
    const snapshot = JSON.stringify({ format: "pulso-vehicle-removal-v1", createdAt: new Date(), database: "pulso_dev", schema: "public", vehicles, services, auditLogs }, (_, value) => typeof value === "bigint" ? value.toString() : value, 2);
    const directory = path.resolve("backups");
    await mkdir(directory, { recursive: true });
    const backup = path.join(directory, `vehicles-before-removal-${Date.now()}.json`);
    await writeFile(backup, snapshot, { flag: "wx" });
    if (await readFile(backup, "utf8") !== snapshot) throw new Error("No se pudo verificar el respaldo.");
    const sha256 = createHash("sha256").update(snapshot).digest("hex");
    await tx.bitacoraEntry.updateMany({ where: { id: { in: serviceIds } }, data: { returnOfId: null } });
    await tx.bitacoraEntry.deleteMany({ where: { id: { in: serviceIds } } });
    await tx.vehicle.deleteMany({ where: { id: { in: ids } } });
    await tx.auditLog.create({ data: { entityType: "MAINTENANCE", entityId: "remove-old-vehicles", action: "BACKUP_AND_DELETE", afterData: { backup, sha256, vehicleIds: ids, serviceIds } } });
    return { deletedVehicles: ids.length, deletedServices: serviceIds.length, backup, sha256 };
  }, { isolationLevel: "Serializable", timeout: 15000 });
  console.log(result);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
