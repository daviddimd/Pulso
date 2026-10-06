import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../lib/prisma";
import { importInstitutionalVehicles, institutionalVehicles } from "../../../prisma/vehicle-catalog";

test("catálogo de la foto conserva historial y lecturas al repetir la importación", async () => {
  const before = await prisma.vehicle.findMany();
  const historyCount = await prisma.bitacoraEntry.count();
  try {
    const result = await importInstitutionalVehicles(prisma);
    assert.equal(result.created, 8);
    for (const original of before) {
      const saved = await prisma.vehicle.findUniqueOrThrow({ where: { id: original.id } });
      assert.equal(saved.currentOdometerKm, original.currentOdometerKm);
      assert.equal(saved.licensePlate, original.licensePlate);
      if (await prisma.serviceLeg.findFirst({ where: { vehicleId: saved.id, endedAt: null } })) {
        assert.equal(saved.active, original.active);
      }
    }
    assert.equal(await prisma.bitacoraEntry.count(), historyCount);
    for (const expected of institutionalVehicles) {
      const saved = await prisma.vehicle.findUniqueOrThrow({ where: { roleCode: expected.roleCode } });
      for (const key of ["licensePlate", "vehicleType", "year", "model"] as const) assert.equal(saved[key], expected[key]);
      assert.equal(saved.currentOdometerKm, null);
    }
    await prisma.vehicle.update({ where: { roleCode: "7-513" }, data: { currentOdometerKm: 123456, active: false } });
    const auditCount = await prisma.auditLog.count();
    const repeated = await importInstitutionalVehicles(prisma);
    assert.equal(repeated.created, 0);
    assert.equal(repeated.updated, 0);
    assert.equal(repeated.deactivated, 0);
    assert.equal(await prisma.auditLog.count(), auditCount);
    const preserved = await prisma.vehicle.findUniqueOrThrow({ where: { roleCode: "7-513" } });
    assert.equal(preserved.currentOdometerKm, 123456);
    assert.equal(preserved.active, false);
  } finally {
    await prisma.$disconnect();
  }
});
