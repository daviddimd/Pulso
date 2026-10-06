import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../lib/prisma";
import { seedDemoServices } from "../../../prisma/demo-services";
import { replaceSampleServices } from "../../../prisma/replace-sample-services";
import { serviceDestinations } from "../../../prisma/service-destinations";

test("semilla ficticia no pisa lecturas y conserva cambios al repetirse", async () => {
  try {
    // Previous catalog test intentionally left one established reading.
    await assert.rejects(seedDemoServices(prisma), /ya tiene datos/);
    assert.equal(await prisma.bitacoraEntry.count({ where: { origin: "DEMO" } }), 0);
    await prisma.vehicle.update({ where: { roleCode: "7-513" }, data: { currentOdometerKm: null, active: true } });
    assert.equal((await seedDemoServices(prisma)).created, 11);
    const completed = await prisma.bitacoraEntry.findMany({ where: { origin: "DEMO", status: "COMPLETED" }, include: { legs: true, vehicle: true } });
    assert.equal(completed.length, 8);
    for (const entry of completed) {
      assert.equal(entry.legs.length, 1);
      assert.equal(entry.odometerKm, entry.vehicle!.currentOdometerKm);
      assert.ok(entry.legs[0]!.arrivalOdometerKm! > entry.legs[0]!.departureOdometerKm!);
      assert.ok(serviceDestinations.some(d => d.address === entry.serviceAddress));
      assert.doesNotMatch(entry.actionPerformed, /demo|fictici/i);
    }
    await prisma.vehicle.update({ where: { roleCode: "7-513" }, data: { currentOdometerKm: 51000 } });
    assert.equal((await seedDemoServices(prisma)).created, 0);
    assert.equal((await prisma.vehicle.findUniqueOrThrow({ where: { roleCode: "7-513" } })).currentOdometerKm, 51000);
    const samples = await prisma.bitacoraEntry.findMany({ where: { origin: "DEMO" } });
    for (const sample of samples) await prisma.bitacoraEntry.update({ where: { id: sample.id }, data: { id: sample.id.replace("-4001-", "-4000-"), serviceAddress: "[DEMO] Dirección ficticia" } });
    assert.equal((await replaceSampleServices(prisma)).replaced, 11);
    assert.equal((await replaceSampleServices(prisma)).replaced, 0);
    assert.equal((await prisma.vehicle.findUniqueOrThrow({ where: { roleCode: "7-513" } })).currentOdometerKm, 51000);
    const replaced = await prisma.bitacoraEntry.findMany({ where: { origin: "DEMO" }, include: { addressRevisions: true, legs: true } });
    assert.equal(replaced.length, 11);
    assert.equal(replaced.flatMap(s => s.legs).length, 8);
    for (const entry of replaced) {
      assert.ok(entry.id.includes("-4001-"));
      assert.doesNotMatch([entry.serviceAddress, entry.actionPerformed, entry.voidReason, ...entry.addressRevisions.map(r => r.address)].join(" "), /demo|fictici/i);
    }
  } finally { await prisma.$disconnect(); }
});
