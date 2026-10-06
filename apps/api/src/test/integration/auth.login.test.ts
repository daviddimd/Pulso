import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";

dotenv.config({
  path: ".env.test",
  override: true,
});

test("login correcto crea sesión y permite consultar /me", async () => {
  const { buildApp } = await import("../../app.js");
  const { prisma } = await import("../../lib/prisma.js");

  const app = buildApp();

  const user = await prisma.user.findUniqueOrThrow({
    where: {
      username: "chofer01",
    },
  });

  try {
    // Dejamos al usuario limpio antes de la prueba.
    await prisma.session.deleteMany({
      where: {
        userId: user.id,
      },
    });

    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "chofer01",
        password: "chofer",
      },
    });

    assert.equal(loginResponse.statusCode, 200);

    const setCookie = loginResponse.headers["set-cookie"];

    assert.ok(setCookie);

    const rawCookie = Array.isArray(setCookie)
    ? setCookie[0]
    : setCookie;

    assert.ok(rawCookie);

    const cookie = rawCookie.split(";")[0];

    assert.ok(cookie);

    const meResponse = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        cookie,
      },
    });

    assert.equal(meResponse.statusCode, 200);

    const body = meResponse.json();

    assert.equal(body.user.username, "chofer01");
    assert.equal(body.user.role, "DRIVER");

    const sessions = await prisma.session.count({
      where: {
        userId: user.id,
        revokedAt: null,
      },
    });

    assert.equal(sessions, 1);
  } finally {

    await prisma.session.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await app.close();
    await prisma.$disconnect();
  }
});