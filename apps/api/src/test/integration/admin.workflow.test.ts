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

test("ADMIN puede consultar overview y exportar Excel diario", async () => {
  const { buildApp } = await import("../../app.js");
  const { prisma } = await import("../../lib/prisma.js");

  const app = buildApp();

  const admin = await prisma.user.findUniqueOrThrow({
    where: {
      username: "admin",
    },
  });

  try {
    await prisma.session.deleteMany({
      where: {
        userId: admin.id,
      },
    });

    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",

      payload: {
        username: "admin",
        password: "admin",
      },
    });

    assert.equal(loginResponse.statusCode, 200);

    const cookie = extractCookie(
      loginResponse.headers["set-cookie"],
    );

    const overviewResponse = await app.inject({
      method: "GET",
      url: "/api/admin/overview?date=2026-09-02",

      headers: {
        cookie,
      },
    });

    assert.equal(
      overviewResponse.statusCode,
      200,
    );

    const overview = overviewResponse.json();

    assert.equal(
      overview.date,
      "2026-09-02",
    );

    assert.equal(
      overview.drivers.length,
      10,
    );

    const exportResponse = await app.inject({
      method: "GET",
      url: "/api/exports/daily?date=2026-09-02",

      headers: {
        cookie,
      },
    });

    assert.equal(
      exportResponse.statusCode,
      200,
    );

    assert.match(
      exportResponse.headers["content-type"] ?? "",
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
    );

    const disposition =
      exportResponse.headers["content-disposition"];

    assert.ok(disposition);

    assert.match(
      disposition,
      /pulso-bitacora-2026-09-02\.xlsx/,
    );

    // Un archivo XLSX es internamente un ZIP y comienza con "PK".
    assert.equal(
      exportResponse.rawPayload.subarray(0, 2).toString(),
      "PK",
    );
  } finally {
    await prisma.session.deleteMany({
      where: {
        userId: admin.id,
      },
    });

    await app.close();
    await prisma.$disconnect();
  }
});