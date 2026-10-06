import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";

dotenv.config({
  path: ".env.test",
  override: true,
});

test("GET /api/auth/me rechaza una petición sin sesión", async () => {
  const { buildApp } = await import("../../app.js");
  const { prisma } = await import("../../lib/prisma.js");

  const app = buildApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/auth/me",
    });

    assert.equal(response.statusCode, 401);

    assert.deepEqual(response.json(), {
      error: "UNAUTHENTICATED",
    });
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
});

test("POST /api/auth/login rechaza un payload inválido", async () => {
  const { buildApp } = await import("../../app.js");
  const { prisma } = await import("../../lib/prisma.js");

  const app = buildApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "chofer01",
        password: "chofer",
        admin: true,
      },
    });

    assert.equal(response.statusCode, 400);

    assert.deepEqual(response.json(), {
      error: "INVALID_LOGIN_DATA",
    });
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
});