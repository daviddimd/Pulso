import { useEffect, useRef, useState } from "react";
import { VehicleOdometerHistory } from "./VehicleOdometerHistory";
import { api, type CostCenter, type Driver, type DriverDetails, type Vehicle } from "../operations";
import {
  type List,
  type Profile,
  type OpenProfile,
  type Mutation,
  driverVehicleLabel,
  vehicleDriverLabel,
} from "./dashboardShared";
import { StatusFilterBar } from "./StatusFilterBar";
import { ServiceDisclosure, ServiceCard } from "./ServiceCard";

export function ProfileHistory({
  profile,
  costCenters,
  vehicles,
  drivers,
  mutate,
  onProfile,
}: {
  profile: Profile;
  costCenters: CostCenter[];
  vehicles: Vehicle[];
  drivers: Driver[];
  mutate: Mutation;
  onProfile: OpenProfile;
}) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [section, setSection] = useState<"trips" | "corrections">("trips");
  const vehicle =
    profile.kind === "vehicle" ? vehicles.find((vehicle) => vehicle.id === profile.id) : null;
  const [result, setResult] = useState<List | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [driverDetails, setDriverDetails] = useState<DriverDetails | null>(null);
  const [driverError, setDriverError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    if (profile.kind !== "driver") return;
    const controller = new AbortController();
    api<{ driver: DriverDetails }>(
      `/api/admin/drivers/${profile.id}`,
      undefined,
      "GET",
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setDriverDetails(data.driver);
          setDriverError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setDriverError(
            e instanceof Error ? e.message : "No se pudieron cargar los datos del chofer.",
          );
      });
    return () => controller.abort();
  }, [profile.id, profile.kind, revision]);
  useEffect(() => {
    if (section !== "trips") return;
    const controller = new AbortController();
    let running = false;
    const refresh = async () => {
      if (running || controller.signal.aborted) return;
      running = true;
      try {
        const query = new URLSearchParams({
          [profile.kind === "driver" ? "driverId" : "vehicleId"]: profile.id,
          page: String(page),
          ...(status ? { status } : {}),
        });
        const data = await api<List>(`/api/services?${query}`, undefined, "GET", controller.signal);
        if (!controller.signal.aborted) {
          setResult(data);
          setError("");
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setResult(null);
          setError(e instanceof Error ? e.message : "No se pudo cargar el historial.");
        }
      } finally {
        running = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [profile.id, profile.kind, page, status, revision, section]);
  const historyMutate: Mutation = async (...args) => {
    const ok = await mutate(...args);
    setRevision((r) => r + 1);
    return ok;
  };
  return (
    <section className="ops-profile">
      <h2 ref={heading} tabIndex={-1}>
        {driverDetails?.fullName ?? profile.name}
      </h2>
      {profile.kind === "vehicle" ? (
        <>
          {vehicle && (
            <dl className="ops-vehicle-facts">
              <div>
                <dt>Patente</dt>
                <dd>{vehicle.licensePlate}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{vehicle.vehicleType ?? "Sin registro"}</dd>
              </div>
              <div>
                <dt>Año</dt>
                <dd>{vehicle.year ?? "Sin registro"}</dd>
              </div>
              <div>
                <dt>Kilometraje actual</dt>
                <dd>
                  {vehicle.currentOdometerKm === null
                    ? "Sin registro"
                    : `${new Intl.NumberFormat("es-CL").format(vehicle.currentOdometerKm)} km`}
                </dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  {!vehicle.active ? "Inactivo" : vehicle.inService ? "En servicio" : "Disponible"}
                </dd>
              </div>
            </dl>
          )}
          <nav className="ops-vehicle-sections" aria-label="Información del vehículo">
            <button
              type="button"
              aria-pressed={section === "trips"}
              onClick={() => setSection("trips")}
            >
              Viajes
            </button>
            <button
              type="button"
              aria-pressed={section === "corrections"}
              onClick={() => setSection("corrections")}
            >
              Correcciones de kilometraje
            </button>
          </nav>
        </>
      ) : (
        <>
          {driverError ? (
            <p className="driver-error" role="alert">
              {driverError} <button onClick={() => setRevision((r) => r + 1)}>Reintentar</button>
            </p>
          ) : !driverDetails ? (
            <p role="status">Cargando datos del chofer…</p>
          ) : (
            <dl className="ops-vehicle-facts">
              <div>
                <dt>Usuario</dt>
                <dd>{driverDetails.username}</dd>
              </div>
              <div>
                <dt>Código de dotación</dt>
                <dd>{driverDetails.rosterCode || "Sin registro"}</dd>
              </div>
              <div>
                <dt>Cargo</dt>
                <dd>Chofer</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  {!driverDetails.active
                    ? "Inactivo"
                    : (drivers.find((driver) => driver.id === profile.id)?.serviceLegs.length ??
                          (driverDetails.inService ? 1 : 0)) > 0
                      ? "En servicio"
                      : "Disponible"}
                </dd>
              </div>
              <div>
                <dt>Establecimiento</dt>
                <dd>{driverDetails.establishmentName}</dd>
              </div>
            </dl>
          )}
          <h3 className="ops-driver-history-title">Historial de viajes</h3>
        </>
      )}
      {profile.kind === "vehicle" && section === "corrections" ? (
        <VehicleOdometerHistory key={profile.id} vehicleId={profile.id} />
      ) : (
        <>
          <StatusFilterBar
            value={status}
            label="Filtrar historial por estado"
            onChange={(value) => {
              if (status === value) {
                return;
              }

              setResult(null);
              setStatus(value);
              setPage(1);
            }}
          />
          {error ? (
            <p className="driver-error" role="alert">
              {error}
              <button onClick={() => setRevision((r) => r + 1)}>Reintentar</button>
            </p>
          ) : !result ? (
            <p role="status">Cargando historial…</p>
          ) : (
            <>
              <p className="ops-history-count">
                {result.total} {result.total === 1 ? "viaje" : "viajes"}
              </p>
              {result.entries.map((entry) => (
                <ServiceDisclosure
                  key={entry.id}
                  entry={entry}
                  subtitle={
                    profile.kind === "driver"
                      ? driverVehicleLabel(entry, profile.id)
                      : vehicleDriverLabel(entry, vehicle)
                  }
                >
                  <ServiceCard
                    costCenters={costCenters}
                    entry={entry}
                    admin
                    vehicles={vehicles}
                    drivers={drivers}
                    mutate={historyMutate}
                    onProfile={onProfile}
                  />
                </ServiceDisclosure>
              ))}
              {!result.entries.length && <p>No hay servicios para este estado.</p>}
              {(result.total > 30 || page > 1) && (
                <div className="ops-pagination">
                  <button
                    disabled={page === 1}
                    onClick={() => {
                      setResult(null);
                      setPage((p) => p - 1);
                    }}
                  >
                    Anterior
                  </button>
                  <span>Página {page}</span>
                  <button
                    disabled={page * 30 >= result.total}
                    onClick={() => {
                      setResult(null);
                      setPage((p) => p + 1);
                    }}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
