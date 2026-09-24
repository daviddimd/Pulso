import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";

dotenv.config({
  path: ".env.test",
  override: true,
});

test("chofer puede iniciar y finalizar una bitácora completa", async () => {
  const { buildApp } = await import("../../app.js");
  const { prisma } = await import("../../lib/prisma.js");

  const app = buildApp();

  const user = await prisma.user.findUniqueOrThrow({
    where: {
      username: "chofer03",
    },
  });

  const vehicle = await prisma.vehicle.findUniqueOrThrow({
    where: {
      roleCode: "105",
    },
  });

  const initialOdometer = 98640;

  try {
    // Dejamos limpios los recursos reservados para esta prueba.
    const oldEntries = await prisma.bitacoraEntry.findMany({
      where: {
        OR: [
          {
            driverId: user.id,
          },
          {
            vehicleId: vehicle.id,
          },
        ],
      },

      select: {
        id: true,
      },
    });

    const oldEntryIds = oldEntries.map(
      (entry) => entry.id,
    );

    if (oldEntryIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          entityType: "BITACORA",
          entityId: {
            in: oldEntryIds,
          },
        },
      });

      await prisma.bitacoraEntry.deleteMany({
        where: {
          id: {
            in: oldEntryIds,
          },
        },
      });
    }

    await prisma.session.deleteMany({
      where: {
        userId: user.id,
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

    // Login real.
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",

      payload: {
        username: "chofer03",
        password: "PulsoChoferDemo#2026",
      },
    });

    assert.equal(loginResponse.statusCode, 200);

    const setCookie =
      loginResponse.headers["set-cookie"];

    assert.ok(setCookie);

    const rawCookie = Array.isArray(setCookie)
      ? setCookie[0]
      : setCookie;

    assert.ok(rawCookie);

    const cookie =
      rawCookie.split(";")[0];

    assert.ok(cookie);

    // Inicio de servicio.
    const startResponse = await app.inject({
      method: "POST",
      url: "/api/bitacoras",

      headers: {
        cookie,
      },

      payload: {
        vehicleId: vehicle.id,
        serviceAddress:
          "Prueba integración 100, Talca",
        actionPerformed:
          "Traslado de prueba",
      },
    });

    assert.equal(startResponse.statusCode, 201);

    const startedEntry =
      startResponse.json().entry;

    assert.equal(
      startedEntry.status,
      "OPEN",
    );

    assert.equal(
      startedEntry.vehicle.roleCode,
      "105",
    );

    // Finalización.
    const finalOdometer = initialOdometer + 1;

    const finalizeResponse = await app.inject({
      method: "PATCH",
      url:
        `/api/bitacoras/${startedEntry.id}/finalize`,

      headers: {
        cookie,
      },

      payload: {
        odometerKm: finalOdometer,
      },
    });

    assert.equal(
      finalizeResponse.statusCode,
      200,
    );

    const finalizedEntry =
      finalizeResponse.json().entry;

    assert.equal(
      finalizedEntry.status,
      "COMPLETED",
    );

    assert.equal(
      finalizedEntry.odometerKm,
      finalOdometer,
    );

    // El kilometraje del vehículo también debe cambiar.
    const updatedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          id: vehicle.id,
        },
      });

    assert.equal(
      updatedVehicle.currentOdometerKm,
      finalOdometer,
    );

    // Deben existir las dos trazas de auditoría.
    const auditLogs =
      await prisma.auditLog.findMany({
        where: {
          entityType: "BITACORA",
          entityId: startedEntry.id,
        },

        orderBy: {
          createdAt: "asc",
        },
      });

    assert.equal(auditLogs.length, 2);
    assert.equal(
      auditLogs[0]?.action,
      "CREATE",
    );
    assert.equal(
      auditLogs[1]?.action,
      "FINALIZE",
    );
  } finally {
    // Limpiamos todo lo creado por esta prueba.
    const entries = await prisma.bitacoraEntry.findMany({
      where: {
        OR: [
          {
            driverId: user.id,
          },
          {
            vehicleId: vehicle.id,
          },
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
        userId: user.id,
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