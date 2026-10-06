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

test("impide finalizar con kilometraje menor al actual", async () => {
  const { buildApp } = await import("../../app.js");
  const { prisma } = await import("../../lib/prisma.js");

  const app = buildApp();

  const driver = await prisma.user.findUniqueOrThrow({
    where: {
      username: "chofer07",
    },
  });

  const vehicle = await prisma.vehicle.findUniqueOrThrow({
    where: {
      roleCode: "107",
    },
  });

  const currentOdometer = 72310;

  try {
    const oldEntries =
      await prisma.bitacoraEntry.findMany({
        where: {
          OR: [
            { driverId: driver.id },
            { vehicleId: vehicle.id },
          ],
        },

        select: {
          id: true,
        },
      });

    const oldIds =
      oldEntries.map((entry) => entry.id);

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
        userId: driver.id,
      },
    });

    await prisma.vehicle.update({
      where: {
        id: vehicle.id,
      },

      data: {
        currentOdometerKm: currentOdometer,
      },
    });

    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",

      payload: {
        username: "chofer07",
        password: "chofer",
      },
    });

    assert.equal(loginResponse.statusCode, 200);

    const cookie = extractCookie(
      loginResponse.headers["set-cookie"],
    );

    const startResponse = await app.inject({
      method: "POST",
      url: "/api/bitacoras",

      headers: {
        cookie,
      },

      payload: {
        vehicleId: vehicle.id,
        costCenterId: "c0000000-0000-4000-8000-000000000101", serviceAddress:
          "Prueba kilometraje 100, Talca",
        actionPerformed:
          "Servicio de prueba",
      },
    });

    assert.equal(startResponse.statusCode, 201);

    const entry =
      startResponse.json().entry;

    const finalizeResponse = await app.inject({
      method: "PATCH",
      url:
        `/api/bitacoras/${entry.id}/finalize`,

      headers: {
        cookie,
      },

      payload: {
        odometerKm: currentOdometer - 1,
      },
    });

    assert.equal(
      finalizeResponse.statusCode,
      409,
    );

    assert.deepEqual(
      finalizeResponse.json(),
      {
        error: "ODOMETER_BELOW_CURRENT",
        currentOdometerKm: currentOdometer,
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
      "IN_PROGRESS",
    );

    assert.equal(
      storedEntry.odometerKm,
      null,
    );

    const storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          id: vehicle.id,
        },
      });

    assert.equal(
      storedVehicle.currentOdometerKm,
      currentOdometer,
    );
  } finally {
    const entries =
      await prisma.bitacoraEntry.findMany({
        where: {
          OR: [
            { driverId: driver.id },
            { vehicleId: vehicle.id },
          ],
        },

        select: {
          id: true,
        },
      });

    const entryIds =
      entries.map((entry) => entry.id);

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
        userId: driver.id,
      },
    });

    await prisma.vehicle.update({
      where: {
        id: vehicle.id,
      },

      data: {
        currentOdometerKm: currentOdometer,
      },
    });

    await app.close();
    await prisma.$disconnect();
  }
});
