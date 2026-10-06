import test from "node:test";
import assert from "node:assert/strict";
import { commands, createServiceSchema, distance, validateArrival } from "./services.schemas";

test("permite guardar sin vehículo pero exige dirección y actividad", () => {
  assert.equal(createServiceSchema.parse({ costCenterId: "c0000000-0000-4000-8000-000000000101", serviceAddress: "Talca centro", actionPerformed: "Entrega de insumos" }).startNow, false);
  assert.equal(createServiceSchema.safeParse({ serviceAddress: "Talca centro" }).success, false);
});
test("rechaza campos clínicos y requerimientos ajenos al contrato", () => {
  for (const field of ["patientName", "patientRut", "diagnosis", "requirement", "requestDescription"]) {
    assert.equal(createServiceSchema.safeParse({ costCenterId: "c0000000-0000-4000-8000-000000000101", serviceAddress: "Talca centro", actionPerformed: "Entrega de insumos", [field]: "dato" }).success, false);
  }
});
test("exige versión y lecturas enteras válidas al cerrar", () => {
  assert.equal(commands.complete.safeParse({ odometerKm: 100 }).success, false);
  for (const odometerKm of [-1, 1.5, 5_000_001]) assert.equal(commands.complete.safeParse({ version: 0, odometerKm }).success, false);
});
test("kilometraje no puede retroceder respecto a salida ni vehículo", () => {
  assert.throws(() => validateArrival(100, 101, 90));
  assert.throws(() => validateArrival(100, 90, 101));
  assert.doesNotThrow(() => validateArrival(101, 101, 101));
});
test("suma distancias por tramo sin mezclar odómetros y mantiene históricos desconocidos", () => {
  assert.equal(distance([{ departureOdometerKm: 100, arrivalOdometerKm: 110 }, { departureOdometerKm: 1000, arrivalOdometerKm: 1020 }]), 30);
  assert.equal(distance([{ departureOdometerKm: null, arrivalOdometerKm: 110 }]), null);
  assert.equal(distance([]), null);
});
