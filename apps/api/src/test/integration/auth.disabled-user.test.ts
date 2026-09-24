import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";

dotenv.config({
  path: ".env.test",
  override: true,
  quiet: true,
});

function extractCookie(
  setCookie: string | string[] | undefined,
): string {
  assert.ok(setCookie);

  const rawCookie = Array.isArray(setCookie)
    ? setCookie[0]
    : setCookie;

  assert.ok(rawCookie);

  const cookie = rawCookie.split(";")[0];

  assert.ok(cookie);

  return cookie;
}

test("desactivar un usuario invalida inmediatamente su sesión", async () => {
  const { buildApp } = await import("../../app.js");
  const { prisma } = await import("../../lib/prisma.js");

  const app = buildApp();

  const user = await prisma.user.findUniqueOrThrow({
    where: {
      username: "chofer10",
    },
  });

  try {
    await prisma.session.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        active: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",

      payload: {
        username: "chofer10",
        password: "PulsoChoferDemo#2026",
      },
    });

    assert.equal(loginResponse.statusCode, 200);

    const cookie = extractCookie(
      loginResponse.headers["set-cookie"],
    );

    const beforeDisable = await app.inject({
      method: "GET",
      url: "/api/auth/me",

      headers: {
        cookie,
      },
    });

    assert.equal(beforeDisable.statusCode, 200);

    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        active: false,
      },
    });

    const afterDisable = await app.inject({
      method: "GET",
      url: "/api/auth/me",

      headers: {
        cookie,
      },
    });

    assert.equal(afterDisable.statusCode, 401);

    assert.deepEqual(afterDisable.json(), {
      error: "UNAUTHENTICATED",
    });
  } finally {
    await prisma.session.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        active: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await app.close();
    await prisma.$disconnect();
  }
});