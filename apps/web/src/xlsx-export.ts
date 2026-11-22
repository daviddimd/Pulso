import * as XLSX from 'xlsx';

export interface ExportServiceItem {
  id: string;
  driverName?: string | null;
  driverRosterCode?: string | null;
  licensePlate?: string | null;
  vehicleRoleCode?: string | null;
  costCenterCode?: string | null;
  costCenterName?: string | null;
  serviceAddress: string;
  actionPerformed: string;
  startedAt?: string | null;
  endedAt?: string | null;
  previousTripId?: string | null;
  departureOdometerKm?: number | null;
  odometerKm?: number | null;
  distanceKm?: number | null;
}

export interface ExportCostCenterItem {
  code: string;
  name: string;
  trips: number;
  km: number;
}

export interface DailyExportPayload {
  timezone: string;
  dateRange: { from: string; to: string };
  services: ExportServiceItem[];
  legs: { id: string; serviceId: string; driverName: string; licensePlate: string; startedAt: string;
    endedAt: string | null; departureOdometerKm: number | null; arrivalOdometerKm: number | null; traveledKm: number | null }[];
  costCenters: ExportCostCenterItem[];
}

/**
 * Genera y descarga un archivo Excel multi-hoja utilizando SheetJS (100% local, sin CDN).
 */
export function downloadDailyExcel(data: DailyExportPayload, filename?: string): void {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Servicios Finalizados
  const servicesRows = data.services.map(s => ({
    'Folio': s.id,
    'Chofer': s.driverName || 'Sin asignar',
    'Róster': s.driverRosterCode || '',
    'Patente': s.licensePlate || '',
    'Código de móvil': s.vehicleRoleCode || '',
    'Centro Costo Código': s.costCenterCode || 'S/C',
    'Centro Costo Nombre': s.costCenterName || 'Indefinido',
    'Destino': s.serviceAddress,
    'Cometido / Actividad': s.actionPerformed,
    'Inicio': s.startedAt ? new Date(s.startedAt).toLocaleString('es-CL', { timeZone: data.timezone }) : '',
    'Término': s.endedAt ? new Date(s.endedAt).toLocaleString('es-CL', { timeZone: data.timezone }) : '',
    'Km salida': s.departureOdometerKm ?? '',
    'Km llegada': s.odometerKm ?? '',
    'Km Recorridos': s.distanceKm ?? '',
  }));
  const wsServices = XLSX.utils.json_to_sheet(servicesRows);
  XLSX.utils.book_append_sheet(wb, wsServices, 'Viajes');

  const legs = data.legs.map(l => ({
    'Folio de viaje': l.serviceId, 'Tramo': l.id, 'Chofer': l.driverName, 'Patente': l.licensePlate,
    'Salida': new Date(l.startedAt).toLocaleString('es-CL', { timeZone: data.timezone }),
    'Llegada': l.endedAt ? new Date(l.endedAt).toLocaleString('es-CL', { timeZone: data.timezone }) : '',
    'Odómetro inicial': l.departureOdometerKm ?? '', 'Odómetro final': l.arrivalOdometerKm ?? '',
    'Km del tramo': l.traveledKm ?? '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(legs), 'Tramos');

  // Resumen Centros de Costos
  const ccRows = data.costCenters.map(cc => ({
    'Código': cc.code,
    'Centro de Costos': cc.name,
    'Viajes Realizados': cc.trips,
    'Kilómetros Totales': cc.km,
  }));
  const wsCC = XLSX.utils.json_to_sheet(ccRows);
  XLSX.utils.book_append_sheet(wb, wsCC, 'Centros de Costo');

  const actualFilename = filename || `pulso-servicios-${data.dateRange.from}-a-${data.dateRange.to}.xlsx`;
  XLSX.writeFile(wb, actualFilename);
}

export function downloadCostCentersExcel(rows: { code: string; name: string; completedTrips: number; completedKm: number; cancelledTrips: number; completedUnknownKm: number }[], filename: string): void {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows.map(row => ({
    'Código': row.code, 'Centro de costos': row.name, 'Completados': row.completedTrips,
    'Km completados': row.completedKm, 'Cancelados': row.cancelledTrips,
    'Sin km completos': row.completedUnknownKm,
  })));
  sheet['!cols'] = [{ wch: 14 }, { wch: 60 }, { wch: 18 }, { wch: 20 }, { wch: 28 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(workbook, sheet, 'Centros de costos');
  XLSX.writeFile(workbook, filename);
}
