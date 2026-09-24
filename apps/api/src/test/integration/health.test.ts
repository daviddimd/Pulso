import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";

dotenv.config({
  path: ".env.test",
  override: true,
});

test("GET /health responde correctamente", async () => {
  const { buildApp } = await import("../../app.js");
  const { prisma } = await import("../../lib/prisma.js");

  const app = buildApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    assert.equal(response.statusCode, 200);

    assert.deepEqual(response.json(), {
      status: "ok",
      service: "Pulso API",
      database: "connected",
    });
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
});