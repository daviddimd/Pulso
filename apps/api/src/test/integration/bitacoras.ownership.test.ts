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

test("un chofer no puede finalizar la bitácora de otro chofer", async () => {
  const { buildApp } = await import("../../app.js");
  const { prisma } = await import("../../lib/prisma.js");

  const app = buildApp();

  const owner = await prisma.user.findUniqueOrThrow({
    where: {
      username: "chofer05",
    },
  });

  const otherDriver = await prisma.user.findUniqueOrThrow({
    where: {
      username: "chofer06",
    },
  });

  const vehicle = await prisma.vehicle.findUniqueOrThrow({
    where: {
      roleCode: "108",
    },
  });

  const initialOdometer = 183900;

  try {
    const oldEntries =
      await prisma.bitacoraEntry.findMany({
        where: {
          OR: [
            { driverId: owner.id },
            { driverId: otherDriver.id },
            { vehicleId: vehicle.id },
          ],
        },

        select: {
          id: true,
        },
      });

    const oldIds = oldEntries.map(
      (entry) => entry.id,
    );

    if (oldIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          entityType: "BITACORA",
          entityId: {
            in: oldIds,
          },
        },
      });

      await prisma.bitacoraEntry.deleteMany({
        where: {
          id: {
            in: oldIds,
          },
        },
      });
    }

    await prisma.session.deleteMany({
      where: {
        userId: {
          in: [
            owner.id,
            otherDriver.id,
          ],
        },
      },
    });

    await prisma.vehicle.update({
      where: {
        id: vehicle.id,
      },

      data: {
        currentOdometerKm: initialOdometer,
      },
    });

    const ownerLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",

      payload: {
        username: "chofer05",
        password: "PulsoChoferDemo#2026",
      },
    });

    const otherLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",

      payload: {
        username: "chofer06",
        password: "PulsoChoferDemo#2026",
      },
    });

    assert.equal(ownerLogin.statusCode, 200);
    assert.equal(otherLogin.statusCode, 200);

    const ownerCookie = extractCookie(
      ownerLogin.headers["set-cookie"],
    );

    const otherCookie = extractCookie(
      otherLogin.headers["set-cookie"],
    );

    const startResponse = await app.inject({
      method: "POST",
      url: "/api/bitacoras",

      headers: {
        cookie: ownerCookie,
      },

      payload: {
        vehicleId: vehicle.id,
        serviceAddress:
          "Prueba propiedad 100, Talca",
        actionPerformed:
          "Servicio de prueba",
      },
    });

    assert.equal(startResponse.statusCode, 201);

    const entry = startResponse.json().entry;

    const forbiddenFinalize = await app.inject({
      method: "PATCH",
      url:
        `/api/bitacoras/${entry.id}/finalize`,

      headers: {
        cookie: otherCookie,
      },

      payload: {
        odometerKm: initialOdometer + 1,
      },
    });

    assert.equal(
      forbiddenFinalize.statusCode,
      403,
    );

    assert.deepEqual(
      forbiddenFinalize.json(),
      {
        error: "FORBIDDEN",
      },
    );

    const storedEntry =
      await prisma.bitacoraEntry.findUniqueOrThrow({
        where: {
          id: entry.id,
        },
      });

    assert.equal(
      storedEntry.status,
      "OPEN",
    );

    assert.equal(
      storedEntry.driverId,
      owner.id,
    );

    assert.equal(
      storedEntry.odometerKm,
      null,
    );
  } finally {
    const entries =
      await prisma.bitacoraEntry.findMany({
        where: {
          OR: [
            { driverId: owner.id },
            { driverId: otherDriver.id },
            { vehicleId: vehicle.id },
          ],
        },

        select: {
          id: true,
        },
      });

    const entryIds = entries.map(
      (entry) => entry.id,
    );

    if (entryIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          entityType: "BITACORA",
          entityId: {
            in: entryIds,
          },
        },
      });

      await prisma.bitacoraEntry.deleteMany({
        where: {
          id: {
            in: entryIds,
          },
        },
      });
    }

    await prisma.session.deleteMany({
      where: {
        userId: {
          in: [
            owner.id,
            otherDriver.id,
          ],
        },
      },
    });

    await prisma.vehicle.update({
      where: {
        id: vehicle.id,
      },

      data: {
        currentOdometerKm: initialOdometer,
      },
    });

    await app.close();
    await prisma.$disconnect();
  }
});