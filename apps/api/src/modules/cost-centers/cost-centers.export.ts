import ExcelJS from "exceljs";
import type { costCenterSummary } from "./cost-centers.service";

export function costCenterWorkbook(report: Awaited<ReturnType<typeof costCenterSummary>>, includeInactive = false) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Centros de costos", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Código", key: "code", width: 16 }, { header: "Centro de costos", key: "name", width: 48 },
    { header: "Completados", key: "completedTrips", width: 18 }, { header: "Km completados", key: "completedKm", width: 20 },
    { header: "Cancelados con salida", key: "cancelledTrips", width: 25 }, { header: "Km cancelados", key: "cancelledKm", width: 20 },
    { header: "Completados sin km completos", key: "completedUnknownKm", width: 32 },
    { header: "Cancelados sin km completos", key: "cancelledUnknownKm", width: 32 },
  ];
  const rows = report.rows.filter(row => includeInactive || row.completedTrips + row.cancelledTrips > 0);
  rows.forEach(row => sheet.addRow(row));
  sheet.autoFilter = { from: "A1", to: `H${rows.length + 1}` };
  const totals: Record<string, string | number> = { name: "Total" };
  for (const key of ["completedTrips", "completedKm", "cancelledTrips", "cancelledKm", "completedUnknownKm", "cancelledUnknownKm"] as const) {
    totals[key] = rows.reduce((sum, row) => sum + row[key], 0);
  }
  sheet.addRow(totals).font = { bold: true };
  sheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF194D59" } };
  });
  for (let column = 3; column <= 8; column++) sheet.getColumn(column).numFmt = "#,##0";
  const info = book.addWorksheet("Período y criterios");
  info.columns = [{ width: 28 }, { width: 100 }];
  info.addRows([
    ["Desde", report.from], ["Hasta", report.to], ["Criterio", "Fecha de cierre, hora de Chile"],
    ["Centros incluidos", includeInactive ? "Todos" : "Con actividad en el período"],
    ["Cancelados", "Con salida y recorrido registrado o pendiente de determinar; separados de los completados."],
    ["Kilómetros", "Solo lecturas completas. Los viajes sin kilómetros completos se cuentan por separado."],
    ["Regresos", "Cada regreso cuenta como otro viaje."],
  ]);
  return book;
}
