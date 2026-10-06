import { prisma } from "../../lib/prisma";
import { distance } from "../services/services.schemas";
import { exportPeriod } from "../exports/export.service";

export async function costCenterSummary(from: string, to: string) {
  const period = exportPeriod(from, to);
  const [centers, entries] = await prisma.$transaction([
    prisma.costCenter.findMany({ orderBy: { code: "asc" } }),
    prisma.bitacoraEntry.findMany({ where: { status: { in: ["COMPLETED", "CANCELLED"] }, endedAt: period, closurePending: false }, include: { legs: true } }),
  ]);
  const empty = (id: string | null, code: string, name: string) => ({ id, code, name, completedTrips: 0, completedKm: 0, completedUnknownKm: 0, cancelledTrips: 0, cancelledKm: 0, cancelledUnknownKm: 0 });
  const rows = new Map(centers.map(c => [c.id as string | null, empty(c.id, c.code, c.name)]));
  rows.set(null, empty(null, "", "Sin centro asignado"));
  for (const entry of entries) {
    const row = rows.get(entry.costCenterId)!;
    const km = distance(entry.legs);
    if (entry.status === "COMPLETED") {
      row.completedTrips++;
      if (km === null) row.completedUnknownKm++; else row.completedKm += km;
    } else if (entry.legs.length && km !== 0) {
      row.cancelledTrips++;
      if (km === null) row.cancelledUnknownKm++; else row.cancelledKm += km;
    }
  }
  return { from, to, rows: [...rows.values()].sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true })) };
}
