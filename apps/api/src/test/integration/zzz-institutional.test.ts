import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { buildApp } from "../../app";
import { createService, commandService } from "../../modules/services/services.service";
import { costCenterSummary } from "../../modules/cost-centers/cost-centers.service";
import { costCenterWorkbook } from "../../modules/cost-centers/cost-centers.export";
import ExcelJS from "exceljs";
import { buildDailyBitacoraWorkbook } from "../../modules/exports/export.service";
import { importDrivers, importCostCenters } from "../../../prisma/import-institutional";
import { officialDrivers } from "../../../prisma/institutional-data";

test("centro obligatorio, permisos, corrección auditada y regreso hereda centro", async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  const driver = await prisma.user.create({ data: { username: "cc-" + randomUUID(), fullName: "Prueba centros", passwordHash: admin.passwordHash, role: "DRIVER" } });
  const vehicle = await prisma.vehicle.create({ data: { roleCode: "cc-" + randomUUID().slice(0, 8), licensePlate: randomUUID().slice(0, 8), currentOdometerKm: 100 } });
  const center = await prisma.costCenter.findUniqueOrThrow({ where: { code: "101" } });
  const other = await prisma.costCenter.findUniqueOrThrow({ where: { code: "102" } });
  const inactive = await prisma.costCenter.create({ data: { code: "inactive", name: "Inactivo", active: false } });
  const data = { serviceAddress: "Talca centro", actionPerformed: "Entrega", vehicleId: vehicle.id };
  await assert.rejects(createService(driver, data, "test"));
  await assert.rejects(createService(driver, { ...data, costCenterId: randomUUID() }, "test"), /COST_CENTER_UNAVAILABLE/);
  await assert.rejects(createService(driver, { ...data, costCenterId: inactive.id }, "test"), /COST_CENTER_UNAVAILABLE/);
  const entry = await createService(driver, { ...data, costCenterId: center.id, startNow: true }, "test");
  await assert.rejects(commandService(driver, entry.id, "cost-center", { version: 0, costCenterId: other.id }, "test"), /FORBIDDEN/);
  const updated = await commandService(admin, entry.id, "cost-center", { version: 0, costCenterId: other.id }, "test");
  assert.equal(updated.costCenterId, other.id);
  await assert.rejects(commandService(admin, entry.id, "cost-center", { version: 0, costCenterId: center.id }, "test"), /STALE_SERVICE/);
  await commandService(admin, entry.id, "cancel", { version: 1, reason: "Cambio de programación" }, "test");
  await commandService(driver, entry.id, "close-cancellation", { version: 2, odometerKm: 110 }, "test");
  const returned = await commandService(driver, entry.id, "return", { version: 3, serviceAddress: "Base Talca", actionPerformed: "Regreso" }, "test");
  assert.equal(returned.costCenterId, other.id);
  assert.equal(await prisma.auditLog.count({ where: { entityId: entry.id, action: "COST-CENTER" } }), 1);
  const app = buildApp();
  try {
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: driver.username, password: "admin" } });
    const cookies = login.headers["set-cookie"]!;
    const cookie = (Array.isArray(cookies) ? cookies[0]! : cookies).split(";")[0]!;
    assert.equal((await app.inject({ method: "GET", url: "/api/cost-centers", headers: { cookie } })).statusCode, 200);
    assert.equal((await app.inject({ method: "GET", url: "/api/cost-centers/summary?from=2040-01-01&to=2040-01-31", headers: { cookie } })).statusCode, 403);
  } finally { await app.close(); }
});

test("resumen suma tramos una vez y separa cancelados, faltantes y límites de fecha", async () => {
  const driver = await prisma.user.findUniqueOrThrow({ where: { username: "chofer01" } });
  const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { roleCode: "7-513" } });
  const center = await prisma.costCenter.create({ data: { code: "summary", name: "Centro resumen" } });
  async function closed(status: "COMPLETED" | "CANCELLED", readings: Array<[number | null, number | null]>, costCenterId: string | null = center.id, endedAt = new Date("2040-01-02T12:00:00Z")) {
    return prisma.bitacoraEntry.create({ data: { driverId: driver.id, vehicleId: vehicle.id, costCenterId, status, origin: "LEGACY", serviceAddress: "Talca", actionPerformed: "Traslado", startedAt: new Date("2040-01-01T12:00:00Z"), endedAt, ...(status === "CANCELLED" ? { cancelledAt: endedAt } : {}), legs: { create: readings.map(([departureOdometerKm, arrivalOdometerKm]) => ({ driverId: driver.id, vehicleId: vehicle.id, startedAt: new Date("2040-01-01T12:00:00Z"), endedAt, departureOdometerKm, arrivalOdometerKm })) } } });
  }
  await closed("COMPLETED", [[100, 110], [1000, 1020]]);
  await closed("COMPLETED", [[null, 40]]);
  await closed("CANCELLED", [[10, 17]]);
  await closed("CANCELLED", [[10, 10]]);
  await closed("CANCELLED", [[null, 10]]);
  await closed("COMPLETED", [[20, 23]], null);
  await closed("COMPLETED", [[30, 99]], center.id, new Date("2040-01-02T02:59:59Z"));
  const report = await costCenterSummary("2040-01-02", "2040-01-02");
  const row = report.rows.find(r => r.id === center.id)!;
  assert.equal(row.completedTrips, 2); assert.equal(row.completedKm, 30); assert.equal(row.completedUnknownKm, 1);
  assert.equal(row.cancelledTrips, 2); assert.equal(row.cancelledKm, 7); assert.equal(row.cancelledUnknownKm, 1);
  assert.equal(report.rows.find(r => r.id === null)!.completedKm, 3);
  const exported = new ExcelJS.Workbook();
  await exported.xlsx.load(await costCenterWorkbook(report).xlsx.writeBuffer());
  const exportedSheet = exported.getWorksheet("Centros de costos")!;
  assert.equal(exportedSheet.rowCount, 4); // Header, two active centers, total.
  const centerRow = exportedSheet.getRows(2, 2)!.find(r => r.getCell(1).value === "summary")!;
  assert.equal(centerRow.getCell(3).value, 2);
  assert.equal(centerRow.getCell(4).value, 30);
  assert.equal(centerRow.getCell(5).value, 2);
  assert.equal(centerRow.getCell(6).value, 7);
  assert.equal(centerRow.getCell(7).value, 1);
  assert.equal(centerRow.getCell(8).value, 1);
  assert.equal(exportedSheet.getRow(4).getCell(4).value, 33);
  assert.equal(costCenterWorkbook(report, true).worksheets[0]!.rowCount, report.rows.length + 2);
  const book = await buildDailyBitacoraWorkbook("2040-01-02");
  assert.equal(book.worksheets[0]!.rowCount, 4);
  const summary = book.getWorksheet("Centros de costos")!;
  const values: unknown[][] = [];
  summary.eachRow((r, i) => { if (i > 1) values.push([r.getCell(1).value, r.getCell(3).value, r.getCell(4).value, r.getCell(5).value]); });
  assert.ok(values.some(r => r[0] === "summary" && r[1] === 2 && r[2] === 30 && r[3] === 1));
});

test("importación de nómina preserva identidades, viajes, sesiones e idempotencia", async () => {
  const before = await prisma.user.findMany({ where: { username: { in: Array.from({ length: 10 }, (_, i) => `chofer${String(i + 1).padStart(2, "0")}`) } } });
  const trip = await prisma.bitacoraEntry.findFirstOrThrow({ where: { driverId: before[0]!.id } });
  const imported = await importDrivers(prisma);
  assert.equal(imported.created, 9); assert.equal(imported.archived, 10);
  assert.equal((await prisma.bitacoraEntry.findUniqueOrThrow({ where: { id: trip.id } })).driverId, before[0]!.id);
  for (const old of before) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: old.id } });
    assert.equal(user.active, false); assert.equal(user.fullName, old.fullName);
    assert.equal(await prisma.session.count({ where: { userId: old.id, revokedAt: null } }), 0);
  }
  for (const row of officialDrivers) assert.equal((await prisma.user.findUniqueOrThrow({ where: { username: row.username } })).fullName, row.fullName);
  assert.deepEqual(await importDrivers(prisma), { created: 0, archived: 0 });
  await importCostCenters(prisma);
  assert.equal(await prisma.costCenter.count({ where: { code: "101" } }), 1);
});
test.after(async () => { await prisma.$disconnect(); });
