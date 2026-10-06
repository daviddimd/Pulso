// Public institutional addresses checked on 2026-09-28. Activities are sample data.
export const serviceDestinations = [
  { address: "Hospital Regional de Talca, 1 Norte 1990, Talca", source: "https://www.isl.gob.cl/centros_medicos/hospital-regional-de-talca/" },
  { address: "Dirección de Obras Municipales, 1 Sur 949, Talca", source: "https://www.talca.cl/?page_id=9193" },
  { address: "DIDECO, 2 Sur 621, Talca", source: "https://www.talca.cl/dideco/direcciones.php" },
] as const;
const activities = [
  "Entrega de materiales de oficina", "Entrega de documentación administrativa",
  "Retiro de insumos", "Traslado de funcionarios a reunión de coordinación",
  "Retiro de documentación", "Entrega de equipamiento",
  "Traslado de funcionarios para gestión administrativa", "Retiro de materiales de oficina",
  "Entrega de correspondencia", "Retiro de equipamiento", "Entrega de insumos",
] as const;
export function serviceText(index: number) {
  return { serviceAddress: serviceDestinations[index % serviceDestinations.length]!.address, actionPerformed: activities[index % activities.length]! };
}
