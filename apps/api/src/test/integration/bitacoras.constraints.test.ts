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

test("impide dos servicios abiertos para el mismo chofer o vehículo", async () => {
  const { buildApp } = await import("../../app.js");
  const { prisma } = await import("../../lib/prisma.js");

  const app = buildApp();

  const driver1 = await prisma.user.findUniqueOrThrow({
    where: {
      username: "chofer05",
    },
  });

  const driver2 = await prisma.user.findUniqueOrThrow({
    where: {
      username: "chofer06",
    },
  });

  const vehicle = await prisma.vehicle.findUniqueOrThrow({
    where: {
      roleCode: "106",
    },
  });

  try {
    const existingEntries =
      await prisma.bitacoraEntry.findMany({
        where: {
          OR: [
            { driverId: driver1.id },
            { driverId: driver2.id },
            { vehicleId: vehicle.id },
          ],
        },

        select: {
          id: true,
        },
      });

    const existingIds =
      existingEntries.map((entry) => entry.id);

    if (existingIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          entityType: "BITACORA",
          entityId: {
            in: existingIds,
          },
        },
      });

      await prisma.bitacoraEntry.deleteMany({
        where: {
          id: {
            in: existingIds,
          },
        },
      });
    }

    await prisma.session.deleteMany({
      where: {
        userId: {
          in: [
            driver1.id,
            driver2.id,
          ],
        },
      },
    });

    const login1 = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "chofer05",
        password: "PulsoChoferDemo#2026",
      },
    });

    const login2 = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "chofer06",
        password: "PulsoChoferDemo#2026",
      },
    });

    assert.equal(login1.statusCode, 200);
    assert.equal(login2.statusCode, 200);

    const cookie1 = extractCookie(
      login1.headers["set-cookie"],
    );

    const cookie2 = extractCookie(
      login2.headers["set-cookie"],
    );

    // Primer servicio: válido.
    const firstStart = await app.inject({
      method: "POST",
      url: "/api/bitacoras",
      headers: {
        cookie: cookie1,
      },
      payload: {
        vehicleId: vehicle.id,
        serviceAddress:
          "Prueba restricciones 100, Talca",
        actionPerformed:
          "Servicio de prueba",
      },
    });

    assert.equal(firstStart.statusCode, 201);

    // El mismo chofer intenta iniciar otro.
    const sameDriverStart = await app.inject({
      method: "POST",
      url: "/api/bitacoras",
      headers: {
        cookie: cookie1,
      },
      payload: {
        vehicleId: vehicle.id,
        serviceAddress:
          "Prueba restricciones 200, Talca",
        actionPerformed:
          "Segundo servicio",
      },
    });

    assert.equal(
      sameDriverStart.statusCode,
      409,
    );

    assert.deepEqual(
      sameDriverStart.json(),
      {
        error:
          "EL_CHOFER_YA_COMENZO_EL_SERVICIO",
      },
    );

    // Otro chofer intenta usar la misma ambulancia.
    const sameVehicleStart = await app.inject({
      method: "POST",
      url: "/api/bitacoras",
      headers: {
        cookie: cookie2,
      },
      payload: {
        vehicleId: vehicle.id,
        serviceAddress:
          "Prueba restricciones 300, Talca",
        actionPerformed:
          "Servicio de otro chofer",
      },
    });

    assert.equal(
      sameVehicleStart.statusCode,
      409,
    );

    assert.deepEqual(
      sameVehicleStart.json(),
      {
        error:
          "EL_VEHICULO_YA_ESTA_EN_USO",
      },
    );

    const openEntries =
      await prisma.bitacoraEntry.count({
        where: {
          vehicleId: vehicle.id,
          status: "OPEN",
        },
      });

    assert.equal(openEntries, 1);
  } finally {
    const entries =
      await prisma.bitacoraEntry.findMany({
        where: {
          OR: [
            { driverId: driver1.id },
            { driverId: driver2.id },
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
        userId: {
          in: [
            driver1.id,
            driver2.id,
          ],
        },
      },
    });

    await app.close();
    await prisma.$disconnect();
  }
});