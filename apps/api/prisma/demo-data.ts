import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  BitacoraStatus,
  PrismaClient,
} from "../src/generated/prisma/client";

const connectionString =
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL no está definida",
  );
}

const databaseUrl =
  new URL(connectionString);

if (
  databaseUrl.pathname !==
  "/pulso_dev"
) {
  throw new Error(
    "Esta semilla solo puede ejecutarse sobre pulso_dev",
  );
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const driverUsernames = [
    "chofer02",
    "chofer03",
    "chofer04",
    "chofer05",
    "chofer06",
    "chofer07",
    "chofer08",
    "chofer09",
  ];

  const roleCodes = [
    "101",
    "102",
    "103",
    "104",
    "105",
    "106",
    "107",
    "108",
  ];

  const drivers =
    await prisma.user.findMany({
      where: {
        username: {
          in: driverUsernames,
        },
      },
    });

  const vehicles =
    await prisma.vehicle.findMany({
      where: {
        roleCode: {
          in: roleCodes,
        },
      },
    });

  const driverByUsername =
    new Map(
      drivers.map((driver) => [
        driver.username,
        driver,
      ]),
    );

  const vehicleByRole =
    new Map(
      vehicles.map((vehicle) => [
        vehicle.roleCode,
        vehicle,
      ]),
    );

  const demoEntries = [
    {
      id: "8c2f5d8e-7e31-4e53-9a01-000000000001",
      username: "chofer02",
      roleCode: "101",
      startedAt:
        "2026-09-21T07:45:00-03:00",
      endedAt:
        "2026-09-21T08:20:00-03:00",
      serviceAddress:
        "CESFAM Las Américas, Talca",
      actionPerformed:
        "Traslado de paciente a control médico",
      odometerKm: 124463,
    },
    {
      id: "8c2f5d8e-7e31-4e53-9a01-000000000002",
      username: "chofer03",
      roleCode: "102",
      startedAt:
        "2026-09-21T08:10:00-03:00",
      endedAt:
        "2026-09-21T08:55:00-03:00",
      serviceAddress:
        "Hospital de San Javier",
      actionPerformed:
        "Traslado interhospitalario",
      odometerKm: 87296,
    },
    {
      id: "8c2f5d8e-7e31-4e53-9a01-000000000003",
      username: "chofer04",
      roleCode: "103",
      startedAt:
        "2026-09-21T08:40:00-03:00",
      endedAt:
        "2026-09-21T10:05:00-03:00",
      serviceAddress:
        "Hospital de Constitución",
      actionPerformed:
        "Traslado interhospitalario",
      odometerKm: 201421,
    },
    {
      id: "8c2f5d8e-7e31-4e53-9a01-000000000004",
      username: "chofer05",
      roleCode: "104",
      startedAt:
        "2026-09-21T09:25:00-03:00",
      endedAt:
        "2026-09-21T10:00:00-03:00",
      serviceAddress:
        "CESFAM Carlos Trupp, Talca",
      actionPerformed:
        "Traslado de paciente para examen",
      odometerKm: 54082,
    },
    {
      id: "8c2f5d8e-7e31-4e53-9a01-000000000005",
      username: "chofer06",
      roleCode: "105",
      startedAt:
        "2026-09-21T10:15:00-03:00",
      endedAt:
        "2026-09-21T11:05:00-03:00",
      serviceAddress:
        "Hospital de Molina",
      actionPerformed:
        "Traslado interhospitalario",
      odometerKm: 98611,
    },
    {
      id: "8c2f5d8e-7e31-4e53-9a01-000000000006",
      username: "chofer07",
      roleCode: "106",
      startedAt:
        "2026-09-21T10:50:00-03:00",
      endedAt:
        "2026-09-21T11:25:00-03:00",
      serviceAddress:
        "2 Norte 1350, Talca",
      actionPerformed:
        "Traslado desde domicilio a centro asistencial",
      odometerKm: 156198,
    },
    {
      id: "8c2f5d8e-7e31-4e53-9a01-000000000007",
      username: "chofer08",
      roleCode: "107",
      startedAt:
        "2026-09-21T11:30:00-03:00",
      endedAt:
        "2026-09-21T12:10:00-03:00",
      serviceAddress:
        "Hospital Regional de Talca",
      actionPerformed:
        "Traslado de apoyo asistencial",
      odometerKm: 72296,
    },
    {
      id: "8c2f5d8e-7e31-4e53-9a01-000000000008",
      username: "chofer09",
      roleCode: "108",
      startedAt:
        "2026-09-21T12:20:00-03:00",
      endedAt:
        "2026-09-21T13:15:00-03:00",
      serviceAddress:
        "Hospital de Curepto",
      actionPerformed:
        "Traslado interhospitalario",
      odometerKm: 183874,
    },
  ];

  for (
    const entry of demoEntries
  ) {
    const driver =
      driverByUsername.get(
        entry.username,
      );

    const vehicle =
      vehicleByRole.get(
        entry.roleCode,
      );

    if (!driver) {
      throw new Error(
        `No existe ${entry.username}`,
      );
    }

    if (!vehicle) {
      throw new Error(
        `No existe el rol ${entry.roleCode}`,
      );
    }

    const data = {
      driverId: driver.id,
      vehicleId: vehicle.id,
      status:
        BitacoraStatus.COMPLETED,
      startedAt: new Date(
        entry.startedAt,
      ),
      endedAt: new Date(
        entry.endedAt,
      ),
      serviceAddress:
        entry.serviceAddress,
      actionPerformed:
        entry.actionPerformed,
      odometerKm:
        entry.odometerKm,
      voidReason: null,
    };

    await prisma.bitacoraEntry.upsert({
      where: {
        id: entry.id,
      },
      update: data,
      create: {
        id: entry.id,
        ...data,
      },
    });
  }

  console.log(
    `${demoEntries.length} servicios de demostración cargados.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });