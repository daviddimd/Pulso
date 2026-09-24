import test from "node:test";
import assert from "node:assert/strict";

import {
  startBitacoraSchema,
  finalizeBitacoraSchema,
  finalizeBitacoraParamsSchema,
} from "./bitacoras.schemas";

test("acepta una bitácora válida", () => {
  const result = startBitacoraSchema.safeParse({
    vehicleId: "46a679b0-740d-4e23-9ae0-69f2a0733ac9",
    serviceAddress: "3 Norte 1200, Talca",
    actionPerformed: "Traslado de paciente",
  });

  assert.equal(result.success, true);
});

test("rechaza una dirección vacía", () => {
  const result = startBitacoraSchema.safeParse({
    vehicleId: "46a679b0-740d-4e23-9ae0-69f2a0733ac9",
    serviceAddress: "   ",
    actionPerformed: "Traslado de paciente",
  });

  assert.equal(result.success, false);
});

test("rechaza campos inesperados", () => {
  const result = startBitacoraSchema.safeParse({
    vehicleId: "46a679b0-740d-4e23-9ae0-69f2a0733ac9",
    serviceAddress: "3 Norte 1200, Talca",
    actionPerformed: "Traslado de paciente",
    campoInventado: true,
  });

  assert.equal(result.success, false);
});

test("rechaza kilometraje decimal", () => {
  const result = finalizeBitacoraSchema.safeParse({
    odometerKm: 201451.5,
  });

  assert.equal(result.success, false);
});

test("acepta kilometraje entero", () => {
  const result = finalizeBitacoraSchema.safeParse({
    odometerKm: 201451,
  });

  assert.equal(result.success, true);
});

test("rechaza un id de bitácora inválido", () => {
  const result =
    finalizeBitacoraParamsSchema.safeParse({
      id: "id-inventado",
    });

  assert.equal(result.success, false);
});