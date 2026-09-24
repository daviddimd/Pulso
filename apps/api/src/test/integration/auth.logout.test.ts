import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";

dotenv.config({
  path: ".env.test",
  override: true,
});

test("logout revoca la sesión y /me deja de autorizar", async () => {
  const { buildApp } = await import("../../app.js");
  const { prisma } = await import("../../lib/prisma.js");

  const app = buildApp();

  const user = await prisma.user.findUniqueOrThrow({
    where: {
      username: "chofer02",
    },
  });

  try {
    await prisma.session.deleteMany({
      where: {
        userId: user.id,
      },
    });

    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "chofer02",
        password: "PulsoChoferDemo#2026",
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

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        cookie,
        "content-type": "application/json",
      },
      payload: {},
    });

    assert.equal(logoutResponse.statusCode, 204);

    const meResponse = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        cookie,
      },
    });

    assert.equal(meResponse.statusCode, 401);

    assert.deepEqual(meResponse.json(), {
      error: "UNAUTHENTICATED",
    });

    const activeSessions = await prisma.session.count({
      where: {
        userId: user.id,
        revokedAt: null,
      },
    });

    assert.equal(activeSessions, 0);
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