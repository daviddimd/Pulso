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
  odometerKm?: number | null;
  distanceKm?: number | null;
}

export interface ExportLegItem {
  id: string;
  serviceId: string;
  driverName?: string | null;
  licensePlate?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  departureOdometerKm?: number | null;
  arrivalOdometerKm?: number | null;
  traveledKm?: number | null;
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
  legs: ExportLegItem[];
  costCenters: ExportCostCenterItem[];
}

/**
 * Genera y descarga un archivo Excel multi-hoja utilizando SheetJS (100% local, sin CDN).
 */
export function downloadDailyExcel(data: DailyExportPayload, filename?: string): void {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Servicios Finalizados
  const servicesRows = data.services.map(s => ({
    'Folio': s.id.substring(0, 8),
    'Chofer': s.driverName || 'Sin asignar',
    'Róster': s.driverRosterCode || '',
    'Patente': s.licensePlate || '',
    'Rol Móvil': s.vehicleRoleCode || '',
    'Centro Costo Código': s.costCenterCode || 'S/C',
    'Centro Costo Nombre': s.costCenterName || 'Indefinido',
    'Destino': s.serviceAddress,
    'Cometido / Actividad': s.actionPerformed,
    'Inicio': s.startedAt ? new Date(s.startedAt).toLocaleString('es-CL', { timeZone: data.timezone }) : '',
    'Término': s.endedAt ? new Date(s.endedAt).toLocaleString('es-CL', { timeZone: data.timezone }) : '',
    'Km Término': s.odometerKm ?? '',
    'Km Recorridos': s.distanceKm ?? '',
  }));
  const wsServices = XLSX.utils.json_to_sheet(servicesRows);
  XLSX.utils.book_append_sheet(wb, wsServices, 'Servicios');

  // Hoja 2: Tramos (Legs)
  const legsRows = data.legs.map(l => ({
    'ID Tramo': l.id.substring(0, 8),
    'ID Servicio': l.serviceId.substring(0, 8),
    'Chofer Tramo': l.driverName || '',
    'Patente Móvil': l.licensePlate || '',
    'Salida': l.startedAt ? new Date(l.startedAt).toLocaleString('es-CL', { timeZone: data.timezone }) : '',
    'Llegada': l.endedAt ? new Date(l.endedAt).toLocaleString('es-CL', { timeZone: data.timezone }) : '',
    'Km Salida': l.departureOdometerKm ?? '',
    'Km Llegada': l.arrivalOdometerKm ?? '',
    'Km Recorridos': l.traveledKm ?? '',
  }));
  const wsLegs = XLSX.utils.json_to_sheet(legsRows);
  XLSX.utils.book_append_sheet(wb, wsLegs, 'Tramos');

  // Hoja 3: Resumen Centros de Costos
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
