import type { PrismaClient } from "../src/generated/prisma/client";

export const institutionalVehicles = [
  { roleCode: "7-513", licensePlate: "DPKD.53-5", vehicleType: "CAMIÓN", year: 2012, model: "CANTER 7.5" },
  { roleCode: "7-454", licensePlate: "KW-5091-4", vehicleType: "CAMIONETA", year: 2007, model: "TERRANO PICK UP 2.5" },
  { roleCode: "7-489", licensePlate: "CJFJ.23-5", vehicleType: "CAMIONETA", year: 2010, model: "D-MAX TH CC 3.0D HR WT" },
  { roleCode: "7-490", licensePlate: "CRBX.38-4", vehicleType: "MINIBUS", year: 2010, model: "NEW H-1 MB GLS 2.5" },
  { roleCode: "7-491", licensePlate: "CRBX.46-5", vehicleType: "MINIBUS", year: 2010, model: "NEW H-1 MB GLS 2.5" },
  { roleCode: "7-533", licensePlate: "GZPF-26-9", vehicleType: "FURGON", year: 2015, model: "NEW H1" },
  { roleCode: "7-540", licensePlate: "GVXV-88-5", vehicleType: "CAMIONETA", year: 2015, model: "D-MAX 2.5" },
  { roleCode: "7-541", licensePlate: "GVXV-89-3", vehicleType: "CAMIONETA", year: 2015, model: "D-MAX 2.5" },
];

const demoIdentities = [
  { roleCode: "101", licensePlate: "LRXZ21" }, { roleCode: "102", licensePlate: "PKGH34" },
  { roleCode: "103", licensePlate: "JLTD67" }, { roleCode: "104", licensePlate: "RBFP82" },
  { roleCode: "105", licensePlate: "KXWP45" }, { roleCode: "106", licensePlate: "SGDY19" },
  { roleCode: "107", licensePlate: "HTLC73" }, { roleCode: "108", licensePlate: "FVNR56" },
];
const source = "IMG_3732.JPEG · filas 10–17";
const normalizedPlate = (plate: string) => plate.replace(/[^A-Z0-9]/gi, "").toUpperCase();

export async function importInstitutionalVehicles(prisma: PrismaClient) {
  return prisma.$transaction(async tx => {
    const existing = await tx.vehicle.findMany();
    const result = { created: 0, updated: 0, deactivated: 0, retainedInService: [] as string[] };
    for (const vehicle of institutionalVehicles) {
      const byRole = existing.find(v => v.roleCode === vehicle.roleCode);
      const byPlate = existing.find(v => normalizedPlate(v.licensePlate) === normalizedPlate(vehicle.licensePlate));
      if ((byRole && normalizedPlate(byRole.licensePlate) !== normalizedPlate(vehicle.licensePlate)) ||
          (byPlate && byPlate.roleCode !== vehicle.roleCode)) {
        throw new Error("Conflicto de identidad para el vehículo " + vehicle.roleCode + ". No se aplicó la importación.");
      }
      const before = byRole ?? null;
      if (before && before.vehicleType === vehicle.vehicleType && before.year === vehicle.year && before.model === vehicle.model) continue;
      const after = before
        ? await tx.vehicle.update({ where: { id: before.id }, data: { vehicleType: vehicle.vehicleType, year: vehicle.year, model: vehicle.model } })
        : await tx.vehicle.create({ data: { ...vehicle, currentOdometerKm: null } });
      await tx.auditLog.create({ data: {
        entityType: "VEHICLE", entityId: after.id, action: "CATALOG_IMPORT",
        beforeData: before ? JSON.parse(JSON.stringify(before)) : undefined,
        afterData: JSON.parse(JSON.stringify({ ...after, source })),
      } });
      if (before) result.updated++; else result.created++;
    }
    for (const before of existing.filter(v => v.active && demoIdentities.some(d => d.roleCode === v.roleCode && d.licensePlate === v.licensePlate))) {
      if (await tx.serviceLeg.findFirst({ where: { vehicleId: before.id, endedAt: null } })) {
        result.retainedInService.push(before.roleCode);
        continue;
      }
      const after = await tx.vehicle.update({ where: { id: before.id }, data: { active: false } });
      await tx.auditLog.create({ data: { entityType: "VEHICLE", entityId: before.id, action: "DEACTIVATE_DEMO", beforeData: JSON.parse(JSON.stringify(before)), afterData: JSON.parse(JSON.stringify({ ...after, source })) } });
      result.deactivated++;
    }
    return result;
  }, { isolationLevel: "Serializable" });
}
