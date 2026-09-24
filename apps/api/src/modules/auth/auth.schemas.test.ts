import test from "node:test";
import assert from "node:assert/strict";

import { loginSchema } from "./auth.schemas";

test("acepta credenciales de login válidas", () => {
  const result = loginSchema.safeParse({
    username: "chofer01",
    password: "PulsoChoferDemo#2026",
  });

  assert.equal(result.success, true);
});

test("rechaza campos inesperados en el login", () => {
  const result = loginSchema.safeParse({
    username: "chofer01",
    password: "PulsoChoferDemo#2026",
    admin: true,
  });

  assert.equal(result.success, false);
});

test("rechaza un username vacío", () => {
  const result = loginSchema.safeParse({
    username: "   ",
    password: "PulsoChoferDemo#2026",
  });

  assert.equal(result.success, false);
});