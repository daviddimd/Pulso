import ExcelJS from "exceljs";
import { DateTime } from "luxon";

import { prisma } from "../../lib/prisma";
import { BitacoraStatus } from "../../generated/prisma/client";

export async function buildDailyBitacoraWorkbook(
  date: string,
) {
  const startOfDay = DateTime.fromISO(
    date,
    {
      zone: "America/Santiago",
    },
  ).startOf("day");

  if (!startOfDay.isValid) {
    throw new Error("INVALID_DATE");
  }

  const endOfDay =
    startOfDay.plus({ days: 1 });

  const entries =
    await prisma.bitacoraEntry.findMany({
      where: {
        status: BitacoraStatus.COMPLETED,

        startedAt: {
          gte: startOfDay.toUTC().toJSDate(),
          lt: endOfDay.toUTC().toJSDate(),
        },
      },

      include: {
        driver: {
          select: {
            fullName: true,
          },
        },

        vehicle: {
          select: {
            roleCode: true,
            licensePlate: true,
          },
        },
      },

      orderBy: [
        {
          driver: {
            fullName: "asc",
          },
        },
        {
          startedAt: "asc",
        },
      ],
    });

  const workbook =
    new ExcelJS.Workbook();

  workbook.creator = "Pulso";
  workbook.created = new Date();

  const worksheet =
    workbook.addWorksheet("Bitácora");

  worksheet.columns = [
    {
      header: "Fecha",
      key: "date",
      width: 14,
    },
    {
      header: "Chofer",
      key: "driver",
      width: 28,
    },
    {
      header: "Rol",
      key: "roleCode",
      width: 12,
    },
    {
      header: "Patente",
      key: "licensePlate",
      width: 16,
    },
    {
      header: "Hora salida",
      key: "startTime",
      width: 15,
    },
    {
      header: "Hora llegada",
      key: "endTime",
      width: 15,
    },
    {
      header: "Dirección / lugar",
      key: "serviceAddress",
      width: 40,
    },
    {
      header: "Acción realizada",
      key: "actionPerformed",
      width: 32,
    },
    {
      header: "Kilometraje",
      key: "odometerKm",
      width: 16,
    },
  ];

  for (const entry of entries) {
    const localStart =
      DateTime.fromJSDate(
        entry.startedAt,
        {
          zone: "utc",
        },
      ).setZone("America/Santiago");

    const localEnd =
      entry.endedAt
        ? DateTime.fromJSDate(
            entry.endedAt,
            {
              zone: "utc",
            },
          ).setZone("America/Santiago")
        : null;

    worksheet.addRow({
      date: localStart.toFormat("dd-MM-yyyy"),
      driver: entry.driver.fullName,
      roleCode: entry.vehicle.roleCode,
      licensePlate:
        entry.vehicle.licensePlate,
      startTime:
        localStart.toFormat("HH:mm"),
      endTime:
        localEnd
          ? localEnd.toFormat("HH:mm")
          : "",
      serviceAddress:
        entry.serviceAddress,
      actionPerformed:
        entry.actionPerformed,
      odometerKm:
        entry.odometerKm ?? "",
    });
  }

  worksheet.getRow(1).font = {
    bold: true,
  };

  worksheet.views = [
    {
      state: "frozen",
      ySplit: 1,
    },
  ];

  worksheet.autoFilter = {
    from: "A1",
    to: "I1",
  };

  return workbook;
}