import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import ExcelJS from "exceljs";
import { DateTime } from "luxon";
import { buildApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { exportPeriod } from "../../modules/exports/export.service";

async function fixture() {
  const app = buildApp();
  const password = "TestOperational#2026";
  const passwordHash = await argon2.hash(password);
  const suffix = randomUUID().slice(0, 8);
  const driver = await prisma.user.create({ data: { username: "flow1-" + suffix, fullName: "Chofer prueba 1", role: "DRIVER", passwordHash } });
  const other = await prisma.user.create({ data: { username: "flow2-" + suffix, fullName: "Chofer prueba 2", role: "DRIVER", passwordHash } });
  const vehicle = await prisma.vehicle.create({ data: { roleCode: "V1-" + suffix, licensePlate: "P1-" + suffix, currentOdometerKm: 100 } });
  const vehicle2 = await prisma.vehicle.create({ data: { roleCode: "V2-" + suffix, licensePlate: "P2-" + suffix, currentOdometerKm: 1000 } });
  async function login(username: string, pass = password) {
    const response = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username, password: pass } });
    assert.equal(response.statusCode, 200, response.body);
    const cookie = response.headers["set-cookie"];
    return (Array.isArray(cookie) ? cookie[0]! : cookie!).split(";")[0]!;
  }
  const d = await login(driver.username);
  const d2 = await login(other.username);
  const admin = await login("admin", "admin");
  const request = (cookie: string, url: string, payload?: object, method: "POST" | "PATCH" | "GET" = payload ? "POST" : "GET") => app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) });
  async function create(cookie = d, extra: object = {}) {
    const response = await request(cookie, "/api/services", { costCenterId: "c0000000-0000-4000-8000-000000000101", serviceAddress: "Destino Talca", actionPerformed: "Entrega de insumos", vehicleId: vehicle.id, ...extra });
    assert.equal(response.statusCode, 201, response.body);
    return response.json().entry;
  }
  return { app, driver, other, vehicle, vehicle2, d, d2, admin, request, create };
}
test("admin crea pendiente, asigna; chofer guarda varios y solo inicia uno; roles y versiones", async () => {
  const f = await fixture();
  try {
    const pending = await f.create(f.admin, { vehicleId: null });
    assert.equal(pending.status, "PENDING"); assert.equal(pending.startedAt, null);
    const assignedResponse = await f.request(f.admin, `/api/services/${pending.id}/assignment`, { version: 0, driverId: f.driver.id, vehicleId: f.vehicle.id });
    assert.equal(assignedResponse.statusCode, 200, assignedResponse.body);
    const assigned = assignedResponse.json().entry;
    assert.equal((await f.request(f.d, `/api/services/${pending.id}/start`, { version: assigned.version, vehicleId: f.vehicle2.id })).statusCode, 403);
    const saved = await f.create(); const savedWithoutVehicle = await f.create(f.d, { vehicleId: null });
    await f.create(f.d2, { vehicleId: f.vehicle2.id });
    const upcoming = (await f.request(f.d, "/api/services/mine?status=COMPLETED&page=2")).json();
    assert.deepEqual(upcoming.upcoming.map((e: { id: string }) => e.id).sort(), [pending.id, saved.id, savedWithoutVehicle.id].sort());
    assert.equal(upcoming.entries.length, 0);
    assert.equal((await f.request(f.d2, `/api/services/${pending.id}`)).statusCode, 403);
    assert.equal((await f.request(f.d, `/api/services/${pending.id}/cancel`, { version: 1, reason: "Prueba" })).statusCode, 403);
    assert.equal((await f.request(f.d, `/api/services/${pending.id}/start`, { version: 0 })).statusCode, 409);
    const start = await f.request(f.d, `/api/services/${pending.id}/start`, { version: assigned.version });
    assert.equal(start.statusCode, 200, start.body);
    assert.equal(start.json().entry.legs[0].departureOdometerKm, 100);
    const blocked = await f.request(f.d, "/api/services", { costCenterId: "c0000000-0000-4000-8000-000000000101", serviceAddress: "Otro destino", actionPerformed: "Entrega", vehicleId: f.vehicle2.id, startNow: true });
    assert.equal(blocked.statusCode, 409);
    const me = (await f.request(f.d, "/api/services/mine?status=COMPLETED")).json();
    assert.equal(me.active[0].id, pending.id);
    assert.deepEqual(me.upcoming.map((e: { id: string }) => e.id).sort(), [saved.id, savedWithoutVehicle.id].sort());
  } finally { await f.app.close(); }
});
test("dirección conserva original, corrige vigente después de finalizar y audita", async () => {
  const f = await fixture();
  try {
    const entry = await f.create(f.d, { startNow: true });
    const done = await f.request(f.d, `/api/services/${entry.id}/complete`, { version: 0, odometerKm: 120 });
    assert.equal(done.statusCode, 200, done.body);
    const update = await f.request(f.admin, `/api/services/${entry.id}/address`, { version: 1, serviceAddress: "Dirección corregida Talca" });
    assert.equal(update.statusCode, 200, update.body);
    const updated = update.json().entry;
    assert.equal(updated.originalAddress, "Destino Talca");
    assert.equal(updated.serviceAddress, "Dirección corregida Talca");
    assert.equal(updated.addressRevisions.length, 2);
    assert.equal(updated.distanceKm, 20);
    assert.equal(updated.status, "COMPLETED");
    const mine = (await f.request(f.d, "/api/services/mine")).json();
    assert.equal(mine.entries.find((e: { id: string }) => e.id === entry.id).serviceAddress, updated.serviceAddress);
    assert.equal((await f.request(f.d, `/api/services/${entry.id}/address`, { version: 2, serviceAddress: "Otra dirección" })).statusCode, 403);
    assert.equal((await f.request(f.admin, `/api/services/${entry.id}/audit`)).json().logs.length, 4);
  } finally { await f.app.close(); }
});
test("reasigna en curso cerrando tramo y no mezcla kilometrajes", async () => {
  const f = await fixture();
  try {
    const entry = await f.create(f.d, { startNow: true });
    const reassignment = await f.request(f.admin, `/api/services/${entry.id}/assignment`, { version: 0, driverId: f.other.id, vehicleId: f.vehicle2.id, odometerKm: 110 });
    assert.equal(reassignment.statusCode, 200, reassignment.body);
    assert.equal(reassignment.json().entry.legs.length, 2);
    assert.equal((await f.request(f.d, `/api/services/${entry.id}/complete`, { version: 1, odometerKm: 1010 })).statusCode, 403);
    const done = await f.request(f.d2, `/api/services/${entry.id}/complete`, { version: 1, odometerKm: 1020 });
    assert.equal(done.statusCode, 200, done.body);
    assert.equal(done.json().entry.distanceKm, 30);
    for (const filter of [`driverId=${f.driver.id}`, `driverId=${f.other.id}`, `vehicleId=${f.vehicle.id}`, `vehicleId=${f.vehicle2.id}`]) {
      const history = await f.request(f.admin, `/api/services?status=COMPLETED&${filter}`);
      assert.equal(history.statusCode, 200);
      assert.equal(history.json().total, 1);
      assert.equal(history.json().entries[0].id, entry.id);
      assert.equal((await f.request(f.admin, `/api/services?status=ASSIGNED&${filter}`)).json().total, 0);
      assert.equal((await f.request(f.admin, `/api/services?page=2&${filter}`)).json().entries.length, 0);
    }
    assert.equal((await f.request(f.admin, `/api/services?vehicleId=${randomUUID()}`)).json().total, 0);
    assert.equal((await f.request(f.admin, "/api/services?driverId=invalid")).statusCode, 400);
    assert.equal((await f.request(f.d, `/api/services?driverId=${f.other.id}`)).statusCode, 403);
    assert.equal((await f.request(f.d, `/api/services/mine?driverId=${f.other.id}`)).statusCode, 403);
    assert.equal((await prisma.vehicle.findUniqueOrThrow({ where: { id: f.vehicle.id } })).currentOdometerKm, 110);
    assert.equal((await prisma.vehicle.findUniqueOrThrow({ where: { id: f.vehicle2.id } })).currentOdometerKm, 1020);
  } finally { await f.app.close(); }
});
test("reasignación a vehículo ocupado revierte cierre de tramo y odómetro", async () => {
  const f = await fixture();
  try {
    const entry = await f.create(f.d, { startNow: true });
    await f.create(f.d2, { startNow: true, vehicleId: f.vehicle2.id });
    const response = await f.request(f.admin, `/api/services/${entry.id}/assignment`, { version: 0, driverId: f.driver.id, vehicleId: f.vehicle2.id, odometerKm: 115 });
    assert.equal(response.statusCode, 409, response.body);
    assert.equal((await prisma.vehicle.findUniqueOrThrow({ where: { id: f.vehicle.id } })).currentOdometerKm, 100);
    assert.equal(await prisma.serviceLeg.count({ where: { serviceId: entry.id, endedAt: null } }), 1);
  } finally { await f.app.close(); }
});
test("cancelación retiene ocupación, cierre actualiza km, regreso vinculado no se duplica", async () => {
  const f = await fixture();
  try {
    const entry = await f.create(f.d, { startNow: true });
    const cancel = await f.request(f.admin, `/api/services/${entry.id}/cancel`, { version: 0, reason: "Servicio suspendido" });
    assert.equal(cancel.statusCode, 200, cancel.body); assert.equal(cancel.json().entry.closurePending, true);
    const ret = { serviceAddress: "Hospital Regional de Talca", actionPerformed: "Regreso a base", startNow: true };
    assert.equal((await f.request(f.d, `/api/services/${entry.id}/return`, { version: 1, ...ret })).statusCode, 409);
    assert.equal((await f.request(f.d2, "/api/services", { costCenterId: "c0000000-0000-4000-8000-000000000101", serviceAddress: "Otro destino", actionPerformed: "Entrega", vehicleId: f.vehicle.id, startNow: true })).statusCode, 409);
    const close = await f.request(f.d, `/api/services/${entry.id}/close-cancellation`, { version: 1, odometerKm: 108 });
    assert.equal(close.statusCode, 200, close.body);
    const response = await f.request(f.d, `/api/services/${entry.id}/return`, { version: 2, ...ret });
    assert.equal(response.statusCode, 200, response.body);
    const returned = response.json().entry;
    assert.equal(returned.returnOfId, entry.id); assert.equal(returned.legs[0].departureOdometerKm, 108);
    assert.equal((await f.request(f.d, `/api/services/${entry.id}/return`, { version: 3, ...ret })).statusCode, 409);
  } finally { await f.app.close(); }
});
test("inicios concurrentes por chofer y vehículo dejan un solo tramo activo", async () => {
  const f = await fixture();
  try {
    const a = await f.create();
    const b = await f.create(f.d, { vehicleId: f.vehicle2.id });
    const responses = await Promise.all([a,b].map(e => f.request(f.d, `/api/services/${e.id}/start`, { version: 0 })));
    assert.deepEqual(responses.map(r => r.statusCode).sort(), [200,409]);
    assert.equal(await prisma.serviceLeg.count({ where: { driverId: f.driver.id, endedAt: null } }), 1);
    const running = responses.find(r => r.statusCode === 200)!.json().entry;
    const other = await f.create(f.d2, { vehicleId: running.vehicleId });
    assert.equal((await f.request(f.d2, `/api/services/${other.id}/start`, { version: 0 })).statusCode, 409);
  } finally { await f.app.close(); }
});
test("finalizaciones concurrentes no sobrescriben odómetro ni duplican auditoría", async () => {
  const f = await fixture();
  try {
    const entry = await f.create(f.d, { startNow: true });
    const results = await Promise.all([110,120].map(odometerKm => f.request(f.d, `/api/services/${entry.id}/complete`, { version: 0, odometerKm })));
    assert.deepEqual(results.map(r => r.statusCode).sort(), [200,409]);
    const winner = results.find(r => r.statusCode === 200)!.json().entry;
    assert.equal((await prisma.vehicle.findUniqueOrThrow({ where: { id: f.vehicle.id } })).currentOdometerKm, winner.odometerKm);
    assert.equal(await prisma.auditLog.count({ where: { entityId: entry.id, action: "FINALIZE" } }), 1);
  } finally { await f.app.close(); }
});
test("ajuste de odómetro administrativo exige motivo, versión y vehículo sin tramo activo", async () => {
  const f = await fixture();
  try {
    const payload = { expectedUpdatedAt: f.vehicle.updatedAt.toISOString(), currentOdometerKm: 95, reason: "Corrección de lectura inicial" };
    assert.equal((await f.request(f.d, "/api/vehicles/" + f.vehicle.id, payload, "PATCH")).statusCode, 403);
    const response = await f.request(f.admin, "/api/vehicles/" + f.vehicle.id, payload, "PATCH");
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().vehicle.currentOdometerKm, 95);
    const entry = await f.create(f.d, { startNow: true });
    assert.equal(entry.legs[0].departureOdometerKm, 95);
    assert.equal((await f.request(f.admin, "/api/vehicles/" + f.vehicle.id, { ...payload, expectedUpdatedAt: response.json().vehicle.updatedAt }, "PATCH")).statusCode, 409);
    assert.equal(await prisma.auditLog.count({ where: { entityId: f.vehicle.id, action: "ODOMETER_ADJUSTMENT" } }), 1);
  } finally { await f.app.close(); }
});
test("Excel selecciona por finalización en Chile, excluye cancelados y contiene tramos", async () => {
  const f = await fixture();
  try {
    const entry = await f.create(f.d, { startNow: true });
    assert.equal((await f.request(f.d, `/api/services/${entry.id}/complete`, { version: 0, odometerKm: 110 })).statusCode, 200);
    const endedAt = DateTime.fromISO("2026-09-25T23:50", { zone: "America/Santiago" }).toJSDate();
    await prisma.bitacoraEntry.update({ where: { id: entry.id }, data: { startedAt: new Date("2026-09-24T10:00:00Z"), endedAt } });
    const cancel = await f.create();
    await f.request(f.admin, `/api/services/${cancel.id}/cancel`, { version: 0, reason: "No se realiza" });
    const response = await f.request(f.admin, "/api/exports/daily?from=2026-09-25&to=2026-09-25");
    assert.equal(response.statusCode, 200, response.body);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(response.rawPayload as unknown as ExcelJS.Buffer);
    const sheet = book.worksheets[0]!;
    const rows: unknown[] = []; sheet.eachRow((row, n) => { if (n > 1) rows.push(row.getCell(1).value); });
    assert.ok(rows.includes(entry.id)); assert.ok(!rows.includes(cancel.id));
    assert.equal(book.worksheets[1]!.getRow(2).getCell(9).value, 10);
    const out = await f.request(f.admin, "/api/exports/daily?from=2026-09-24&to=2026-09-24");
    const empty = new ExcelJS.Workbook(); await empty.xlsx.load(out.rawPayload as unknown as ExcelJS.Buffer);
    assert.equal(empty.worksheets[0]!.rowCount, 1);
    assert.throws(() => exportPeriod("2026-09-26", "2026-09-25"));
    assert.throws(() => exportPeriod("2026-02-30", "2026-03-01"));
  } finally { await f.app.close(); }
});
test("solo administración registra vehículos; identidad fija y rol editable sin perder historial", async () => {
  const f = await fixture();
  try {
    const suffix = randomUUID().slice(0, 8);
    const data = { roleCode: "NEW-" + suffix, licensePlate: "PL-" + suffix.toUpperCase(), vehicleType: "CAMIONETA", model: "Modelo prueba", year: 2020, currentOdometerKm: 100 };
    assert.equal((await f.request(f.d, "/api/vehicles", data)).statusCode, 403);
    const created = await f.request(f.admin, "/api/vehicles", data);
    assert.equal(created.statusCode, 201, created.body);
    const vehicle = created.json().vehicle;
    const service = await f.create(f.d, { vehicleId: vehicle.id, startNow: true });
    assert.equal((await f.request(f.d, `/api/services/${service.id}/complete`, { version: 0, odometerKm: 110 })).statusCode, 200);
    const current = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
    const expectedUpdatedAt = current.updatedAt.toISOString();
    for (const change of [{ licensePlate: "OTHER123" }, { model: "Otro modelo" }, { year: 2021 }, { vehicleType: "MINIBUS" }]) {
      assert.equal((await f.request(f.admin, `/api/vehicles/${vehicle.id}`, { expectedUpdatedAt, roleCode: "NO-CHANGE", ...change }, "PATCH")).statusCode, 400);
    }
    assert.equal((await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).roleCode, data.roleCode);
    assert.equal((await f.request(f.d, `/api/vehicles/${vehicle.id}`, { expectedUpdatedAt, roleCode: "DRIVER-CHANGE" }, "PATCH")).statusCode, 403);
    const updated = await f.request(f.admin, `/api/vehicles/${vehicle.id}`, { expectedUpdatedAt, roleCode: "UPDATED-" + suffix }, "PATCH");
    assert.equal(updated.statusCode, 200, updated.body);
    const saved = updated.json().vehicle;
    assert.equal(saved.id, vehicle.id);
    for (const key of ["licensePlate", "model", "year", "vehicleType"] as const) assert.equal(saved[key], data[key]);
    assert.equal(saved.currentOdometerKm, 110);
    assert.equal((await prisma.bitacoraEntry.findUniqueOrThrow({ where: { id: service.id } })).vehicleId, vehicle.id);
    assert.equal(await prisma.serviceLeg.count({ where: { serviceId: service.id, vehicleId: vehicle.id } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { entityType: "VEHICLE", entityId: vehicle.id, action: "CREATE" } }), 1);
    assert.equal((await f.request(f.admin, "/api/vehicles", { ...data, roleCode: "DUP-" + suffix })).statusCode, 409);
  } finally { await f.app.close(); }
});

test.after(async () => { await prisma.$disconnect(); });
