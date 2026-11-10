import { institutionTimezone } from './institution';
export const API_URL = import.meta.env.VITE_API_URL ?? "";
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
const messages: Record<string, string> = {
  CANCEL_ONLY_BEFORE_START: "Solo se pueden cancelar servicios que aún no han comenzado.",
  COST_CENTER_REQUIRED: "Administración debe asignar un centro de costos a este servicio.",
  COST_CENTER_UNAVAILABLE: "Selecciona un centro de costos disponible.",
  UNAUTHENTICATED: "Tu sesión venció. Vuelve a ingresar.",
  FORBIDDEN: "No tienes permiso para esta operación.",
  STALE_SERVICE: "La información cambió. Actualiza y revisa antes de repetir la operación.",
  SERVICE_CONFLICT: "Otro usuario actualizó estos recursos. Actualiza y vuelve a intentar.",
  ODOMETER_BELOW_CURRENT: "La lectura no puede ser menor al kilometraje de salida o al actual del vehículo.",
  EL_CHOFER_YA_COMENZO_EL_SERVICIO: "El chofer ya tiene un viaje o cierre pendiente.",
  EL_VEHICULO_YA_ESTA_EN_USO: "El vehículo ya está en servicio.",
  INITIAL_ODOMETER_REQUIRED: "Administración debe registrar el kilometraje inicial del vehículo.",
  ASSIGNMENT_REQUIRED: "Selecciona un vehículo antes de iniciar.",
  ADMIN_REASSIGNMENT_REQUIRED: "Solo administración puede cambiar un vehículo ya asignado.",
  DRIVER_UNAVAILABLE: "El chofer seleccionado no está activo.",
  VEHICULO_NO_DISPONIBLE: "El vehículo seleccionado no está activo.",
  VEHICLE_IN_SERVICE: "Finaliza el viaje antes de ajustar el kilometraje del vehículo.",
  IMMUTABLE_VEHICLE_DATA: "Los datos del vehículo son fijos. Solo puedes ajustar su kilometraje.",
  ASSIGNMENT_UNCHANGED: "Selecciona un chofer o vehículo diferente.",
  HANDOVER_ODOMETER_REQUIRED: "Registra el kilometraje del vehículo que termina el viaje.",
  INVALID_TRANSITION: "Esta operación ya no corresponde al estado del servicio.",
  ENTRY_NOT_OPEN: "El servicio ya no está en curso.",
  INVALID_SERVICE_DATA: "Revisa los datos obligatorios y sus formatos.",
};
export async function api<T>(path: string, body?: unknown, method = "POST", signal?: AbortSignal): Promise<T> {
  const response = await fetch(API_URL + path, { credentials: "include", ...(signal ? { signal } : {}), ...(body === undefined ? {} : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, messages[data.error] ?? "No fue posible completar la operación.");
  return data as T;
}
export type Vehicle = { id: string; roleCode: string; licensePlate: string; currentOdometerKm: number | null; vehicleType: string | null; make: string | null; model: string | null; year: number | null; active: boolean; inService: boolean; updatedAt: string };
export type Driver = { id: string; fullName: string; serviceLegs: { serviceId: string }[] };
export type DriverDetails = { id: string; fullName: string; username: string; rosterCode: string | null; active: boolean; establishmentName: string; inService: boolean };
export type Service = {
  costCenterId: string | null; costCenter: CostCenter | null;
  id: string; version: number; status: string; serviceAddress: string; originalAddress: string; actionPerformed: string;
  driverId: string | null; vehicleId: string | null; driver: { fullName: string } | null; vehicle: { roleCode: string; licensePlate: string; model: string | null } | null;
  startedAt: string | null; endedAt: string | null; voidReason: string | null; distanceKm: number | null;
  previousTripId: string | null;
  legs: { id: string; startedAt: string; endedAt: string | null; departureOdometerKm: number | null; arrivalOdometerKm: number | null; driver: { id: string; fullName: string }; vehicle: { roleCode: string; licensePlate: string; model: string | null } }[];
  addressRevisions: { id: string; revision: number; address: string; createdAt: string; source: string; actor: { fullName: string } | null }[];
};
export type CostCenter = { id: string; code: string; name: string; active: boolean };
export const labels: Record<string,string> = { PENDING: "Pendiente", ASSIGNED: "Asignado", IN_PROGRESS: "En servicio", COMPLETED: "Completado", CANCELLED: "Cancelado" };
export const time = (s: string | null) => s ? new Intl.DateTimeFormat("es-CL", { timeZone: institutionTimezone(), dateStyle: "short", timeStyle: "short" }).format(new Date(s)) : "—";
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: institutionTimezone(), year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
