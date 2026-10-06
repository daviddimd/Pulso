import ExcelJS from "exceljs";
import { DateTime } from "luxon";
import { prisma } from "../../lib/prisma";
import { serviceInclude } from "../services/services.service";
import { distance } from "../services/services.schemas";

export function exportPeriod(from: string, to: string) {
  const start = DateTime.fromISO(from, { zone: "America/Santiago" }).startOf("day");
  const end = DateTime.fromISO(to, { zone: "America/Santiago" }).startOf("day");
  if (!start.isValid || !end.isValid || start > end || end.diff(start, "days").days > 366) throw new Error("INVALID_DATE");
  return { gte: start.toUTC().toJSDate(), lt: end.plus({ days: 1 }).toUTC().toJSDate() };
}
const local = (date: Date | null) => date ? DateTime.fromJSDate(date).setZone("America/Santiago").toFormat("dd-MM-yyyy HH:mm") : "";
export async function buildDailyBitacoraWorkbook(from: string, to = from) {
  const entries = await prisma.bitacoraEntry.findMany({ where: { status: "COMPLETED", endedAt: exportPeriod(from, to) }, include: serviceInclude, orderBy: [{ endedAt: "asc" }, { id: "asc" }] });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pulso";
  const sheet = workbook.addWorksheet("Servicios finalizados");
  sheet.columns = [
    { header: "Servicio", key: "id", width: 38 }, { header: "Finalización", key: "end", width: 22 },
    { header: "Dirección vigente", key: "address", width: 45 }, { header: "Actividad a realizar", key: "activity", width: 40 },
    { header: "Inicio", key: "start", width: 22 }, { header: "Choferes", key: "drivers", width: 35 },
    { header: "Vehículos", key: "vehicles", width: 30 }, { header: "Km recorridos", key: "distance", width: 18 },
    { header: "Código centro", key: "costCode", width: 18 }, { header: "Centro de costos", key: "costName", width: 50 },
  ];
  const legs = workbook.addWorksheet("Tramos");
  legs.columns = [
    { header: "Servicio", key: "id", width: 38 }, { header: "Chofer", key: "driver", width: 30 },
    { header: "Rol", key: "role", width: 14 }, { header: "Patente", key: "plate", width: 14 },
    { header: "Salida", key: "start", width: 22 }, { header: "Llegada", key: "end", width: 22 },
    { header: "Km salida", key: "departure", width: 16 }, { header: "Km llegada", key: "arrival", width: 16 },
    { header: "Km recorridos", key: "distance", width: 18 },
    { header: "Código centro", key: "costCode", width: 18 }, { header: "Centro de costos", key: "costName", width: 50 },
  ];
  for (const entry of entries) {
    sheet.addRow({ id: entry.id, end: local(entry.endedAt), address: entry.serviceAddress, activity: entry.actionPerformed, start: local(entry.startedAt),
      drivers: [...new Set(entry.legs.map(l => l.driver.fullName))].join(", ") || entry.driver?.fullName || "",
      vehicles: [...new Set(entry.legs.map(l => l.vehicle.licensePlate))].join(", ") || entry.vehicle?.licensePlate || "",
      costCode: entry.costCenter?.code ?? "", costName: entry.costCenter?.name ?? "Sin centro asignado", distance: distance(entry.legs) ?? "" });
    for (const leg of entry.legs) legs.addRow({ id: entry.id, driver: leg.driver.fullName, role: leg.vehicle.roleCode, plate: leg.vehicle.licensePlate, start: local(leg.startedAt), end: local(leg.endedAt), departure: leg.departureOdometerKm ?? "", arrival: leg.arrivalOdometerKm ?? "", distance: distance([leg]) ?? "", costCode: entry.costCenter?.code ?? "", costName: entry.costCenter?.name ?? "Sin centro asignado" });
  }
  for (const ws of [sheet, legs]) {
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: "A1", to: `${ws === sheet ? "J" : "K"}1` };
  }
  const summary = workbook.addWorksheet("Centros de costos");
  summary.columns = [{ header: "Código", key: "code", width: 16 }, { header: "Centro de costos", key: "name", width: 50 }, { header: "Viajes completados", key: "trips", width: 22 }, { header: "Km registrados", key: "km", width: 20 }, { header: "Viajes sin km completos", key: "unknown", width: 26 }];
  const groups = new Map<string, { code: string; name: string; trips: number; km: number; unknown: number }>();
  for (const entry of entries) {
    const key = entry.costCenterId ?? "";
    const row = groups.get(key) ?? { code: entry.costCenter?.code ?? "", name: entry.costCenter?.name ?? "Sin centro asignado", trips: 0, km: 0, unknown: 0 };
    row.trips++;
    const km = distance(entry.legs);
    if (km === null) row.unknown++; else row.km += km;
    groups.set(key, row);
  }
  for (const row of [...groups.values()].sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true }))) summary.addRow(row);
  summary.getRow(1).font = { bold: true };
  summary.views = [{ state: "frozen", ySplit: 1 }];
  summary.autoFilter = "A1:E1";
  return workbook;
}
