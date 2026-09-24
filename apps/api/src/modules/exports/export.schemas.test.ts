import test from "node:test";
import assert from "node:assert/strict";

import {
  dailyExportQuerySchema,
} from "./export.schemas";

test("acepta una fecha de exportación válida", () => {
  const result = dailyExportQuerySchema.safeParse({
    date: "2026-09-02",
  });

  assert.equal(result.success, true);
});

test("rechaza una fecha con formato incorrecto", () => {
  const result = dailyExportQuerySchema.safeParse({
    date: "02-09-2026",
  });

  assert.equal(result.success, false);
});

test("rechaza exportación sin fecha", () => {
  const result = dailyExportQuerySchema.safeParse({});

  assert.equal(result.success, false);
});

test("rechaza campos inesperados en exportación", () => {
  const result = dailyExportQuerySchema.safeParse({
    date: "2026-09-02",
    formato: "pdf",
  });

  assert.equal(result.success, false);
});