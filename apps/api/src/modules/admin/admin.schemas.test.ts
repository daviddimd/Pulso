import test from "node:test";
import assert from "node:assert/strict";

import {
  adminBitacorasQuerySchema,
  adminOverviewQuerySchema,
} from "./admin.schemas";

test("acepta filtros administrativos válidos", () => {
  const result = adminBitacorasQuerySchema.safeParse({
    driverId: "7cf99ed9-2253-4666-9ef3-1d215baeb693",
    date: "2026-09-02",
  });

  assert.equal(result.success, true);
});

test("rechaza driverId inválido", () => {
  const result = adminBitacorasQuerySchema.safeParse({
    driverId: "no-es-un-uuid",
  });

  assert.equal(result.success, false);
});

test("rechaza formato de fecha inválido", () => {
  const result = adminBitacorasQuerySchema.safeParse({
    date: "02-09-2026",
  });

  assert.equal(result.success, false);
});

test("rechaza campos administrativos inesperados", () => {
  const result = adminBitacorasQuerySchema.safeParse({
    date: "2026-09-02",
    admin: true,
  });

  assert.equal(result.success, false);
});

test("overview exige una fecha", () => {
  const result = adminOverviewQuerySchema.safeParse({});

  assert.equal(result.success, false);
});

test("overview acepta una fecha con formato válido", () => {
  const result = adminOverviewQuerySchema.safeParse({
    date: "2026-09-02",
  });

  assert.equal(result.success, true);
});