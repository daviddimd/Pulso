import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";

dotenv.config({
  path: ".env.test",
  override: true,
  quiet: true,
});

test("bloquea temporalmente una cuenta tras 5 intentos fallidos", async () => {
  const { buildApp } = await import("../../app.js");
  const { prisma } = await import("../../lib/prisma.js");

  const app = buildApp();

  const user = await prisma.user.findUniqueOrThrow({
    where: {
      username: "chofer08",
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
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    for (let attempt = 1; attempt <= 5; attempt++) {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          username: "chofer08",
          password: "ContraseñaIncorrecta",
        },
      });

      assert.equal(response.statusCode, 401);

      assert.deepEqual(response.json(), {
        error: "INVALID_CREDENTIALS",
      });
    }

    const lockedUser =
      await prisma.user.findUniqueOrThrow({
        where: {
          id: user.id,
        },
      });

    assert.ok(lockedUser.lockedUntil);
    assert.ok(
      lockedUser.lockedUntil.getTime() >
        Date.now(),
    );

    const correctLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "chofer08",
        password: "chofer",
      },
    });

    assert.equal(correctLogin.statusCode, 423);

    assert.deepEqual(correctLogin.json(), {
      error: "ACCOUNT_TEMPORARILY_LOCKED",
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
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await app.close();
    await prisma.$disconnect();
  }
});