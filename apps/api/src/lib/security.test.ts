import test from "node:test";
import assert from "node:assert/strict";

import {
  createSessionToken,
  hashSessionToken,
} from "./security";

test("genera tokens de sesión distintos", () => {
  const token1 = createSessionToken();
  const token2 = createSessionToken();

  assert.notEqual(token1, token2);
});

test("genera tokens de sesión no vacíos", () => {
  const token = createSessionToken();

  assert.ok(token.length > 0);
});

test("el hash de sesión es SHA-256 hexadecimal", () => {
  const token = createSessionToken();
  const hash = hashSessionToken(token);

  assert.match(hash, /^[a-f0-9]{64}$/);
});

test("el mismo token siempre produce el mismo hash", () => {
  const token = "token-de-prueba";

  assert.equal(
    hashSessionToken(token),
    hashSessionToken(token),
  );
});

test("tokens diferentes producen hashes diferentes", () => {
  const hash1 = hashSessionToken("token-1");
  const hash2 = hashSessionToken("token-2");

  assert.notEqual(hash1, hash2);
});