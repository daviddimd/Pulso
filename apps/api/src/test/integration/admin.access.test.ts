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

test("DRIVER no puede acceder a rutas administrativas y ADMIN sí", async () => {
  const { buildApp } = await import("../../app.js");
  const { prisma } = await import("../../lib/prisma.js");

  const app = buildApp();

  const driver = await prisma.user.findUniqueOrThrow({
    where: {
      username: "chofer04",
    },
  });

  const admin = await prisma.user.findUniqueOrThrow({
    where: {
      username: "admin",
    },
  });

  try {
    await prisma.session.deleteMany({
      where: {
        userId: {
          in: [
            driver.id,
            admin.id,
          ],
        },
      },
    });

    const driverLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "chofer04",
        password: "chofer",
      },
    });

    assert.equal(driverLogin.statusCode, 200);

    const driverCookie = extractCookie(
      driverLogin.headers["set-cookie"],
    );

    const forbiddenResponse = await app.inject({
      method: "GET",
      url: "/api/admin/drivers",
      headers: {
        cookie: driverCookie,
      },
    });

    assert.equal(
      forbiddenResponse.statusCode,
      403,
    );

    assert.deepEqual(
      forbiddenResponse.json(),
      {
        error: "FORBIDDEN",
      },
    );

    const adminLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "admin",
        password: "admin",
      },
    });

    assert.equal(adminLogin.statusCode, 200);

    const adminCookie = extractCookie(
      adminLogin.headers["set-cookie"],
    );

    const driversResponse = await app.inject({
      method: "GET",
      url: "/api/admin/drivers",
      headers: {
        cookie: adminCookie,
      },
    });

    assert.equal(
      driversResponse.statusCode,
      200,
    );

    const body = driversResponse.json();

    assert.equal(
      body.drivers.length,
      10,
    );
  } finally {
    await prisma.session.deleteMany({
      where: {
        userId: {
          in: [
            driver.id,
            admin.id,
          ],
        },
      },
    });

    await app.close();
    await prisma.$disconnect();
  }
});