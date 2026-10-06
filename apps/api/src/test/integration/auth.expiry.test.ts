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

test("una sesión expirada deja de autorizar al usuario", async () => {
  const { buildApp } = await import("../../app.js");
  const { prisma } = await import("../../lib/prisma.js");

  const app = buildApp();

  const user = await prisma.user.findUniqueOrThrow({
    where: {
      username: "chofer09",
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
        username: "chofer09",
        password: "chofer",
      },
    });

    assert.equal(loginResponse.statusCode, 200);

    const cookie = extractCookie(
      loginResponse.headers["set-cookie"],
    );

    const session =
      await prisma.session.findFirstOrThrow({
        where: {
          userId: user.id,
          revokedAt: null,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    await prisma.session.update({
      where: {
        id: session.id,
      },

      data: {
        expiresAt: new Date(
          Date.now() - 60_000,
        ),
      },
    });

    const meResponse = await app.inject({
      method: "GET",
      url: "/api/auth/me",

      headers: {
        cookie,
      },
    });

    assert.equal(
      meResponse.statusCode,
      401,
    );

    assert.deepEqual(
      meResponse.json(),
      {
        error: "UNAUTHENTICATED",
      },
    );
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