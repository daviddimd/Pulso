import { useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { type Vehicle } from "../operations";
import { type OpenProfile, type Mutation, values, text, vehicleLabel } from "./dashboardShared";

export function VehiclePanel({
  vehicles,
  mutate,
  onProfile,
}: {
  vehicles: Vehicle[];
  mutate: Mutation;
  onProfile: OpenProfile;
}) {
  async function create(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const f = values(event);
    if (
      await mutate("/api/vehicles", {
        roleCode: text(f, "role"),
        licensePlate: text(f, "plate"),
        vehicleType: text(f, "type") || null,
        model: text(f, "model") || null,
        make: text(f, "make") || null,
        year: text(f, "year") ? Number(text(f, "year")) : null,
        currentOdometerKm: Number(text(f, "km")),
      })
    )
      form.reset();
  }
  return (
    <>
      <details className="ops-card">
        <summary className="ops-disclosure-heading">
          <span>
            <Icon name="plus" />
            Registrar nuevo vehículo
          </span>
          <Icon name="chevron" />
        </summary>
        <p>Revisa los datos antes de registrar: después solo se podrá ajustar el kilometraje.</p>
        <form className="ops-form" onSubmit={(e) => void create(e)}>
          <label>
            Código de móvil
            <input name="role" maxLength={30} required />
          </label>
          <label>
            Patente
            <input name="plate" minLength={3} maxLength={20} required />
          </label>
          <label>
            Tipo
            <input name="type" minLength={2} maxLength={60} list="ops-vehicle-types" />
          </label>
          <label>
            Marca
            <input name="make" maxLength={120} list="ops-vehicle-makes" />
          </label>
          <label>
            Modelo
            <input name="model" maxLength={120} list="ops-vehicle-models" />
          </label>
          <datalist id="ops-vehicle-types">
            {[...new Set(vehicles.flatMap((v) => (v.vehicleType ? [v.vehicleType] : [])))].map(
              (v) => (
                <option key={v} value={v} />
              ),
            )}
          </datalist>
          <datalist id="ops-vehicle-makes">
            {[...new Set(vehicles.flatMap((v) => (v.make ? [v.make] : [])))].map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <datalist id="ops-vehicle-models">
            {[...new Set(vehicles.flatMap((v) => (v.model ? [v.model] : [])))].map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <label>
            Año
            <input name="year" type="number" min="1900" max="2100" />
          </label>
          <label>
            Kilometraje inicial
            <input name="km" type="number" min="0" max="5000000" required />
          </label>
          <button>Registrar</button>
        </form>
      </details>
      <div className="ops-services ops-vehicle-grid">
        {vehicles.map((v) => (
          <VehicleCard key={v.id} vehicle={v} mutate={mutate} onProfile={onProfile} />
        ))}
      </div>
    </>
  );
}
function VehicleCard({
  vehicle: v,
  mutate,
  onProfile,
}: {
  vehicle: Vehicle;
  mutate: Mutation;
  onProfile: OpenProfile;
}) {
  const [snapshot, setSnapshot] = useState<Vehicle | null>(null);
  async function save(event: FormEvent<HTMLFormElement>) {
    const f = values(event);
    if (!snapshot) return;
    const body = {
      expectedUpdatedAt: snapshot.updatedAt,
      currentOdometerKm: Number(text(f, "km")),
      reason: text(f, "reason"),
    };
    if (await mutate("/api/vehicles/" + v.id, body, "PATCH")) setSnapshot(null);
  }
  return (
    <article className="ops-card ops-vehicle-card">
      <div className="ops-vehicle-top">
        <span className="ops-vehicle-symbol">
          <Icon name="car" />
        </span>
        <span
          className="ops-badge"
          data-state={!v.active ? "CANCELLED" : v.inService ? "IN_PROGRESS" : "COMPLETED"}
        >
          <span className="ops-state-dot" />
          {!v.active ? "Inactivo" : v.inService ? "En servicio" : "Disponible"}
        </span>
      </div>
      <h2>
        <button
          className="ops-entity-link"
          onClick={() => onProfile({ kind: "vehicle", id: v.id, name: vehicleLabel(v) })}
        >
          {vehicleLabel(v)}
        </button>
      </h2>
      <p>
        {[v.make, v.vehicleType, v.year, "Patente " + v.licensePlate].filter(Boolean).join(" · ")}
      </p>
      <div className="ops-vehicle-odometer">
        <span>Odómetro</span>
        <strong>
          {v.currentOdometerKm === null
            ? "Sin registro"
            : new Intl.NumberFormat("es-CL").format(v.currentOdometerKm)}
          <small> km</small>
        </strong>
      </div>
      <div className="ops-actions">
        <button disabled={v.inService} onClick={() => setSnapshot(v)}>
          Ajustar kilometraje
        </button>
      </div>
      {snapshot && (
        <form className="ops-form ops-edit" onSubmit={(e) => void save(e)}>
          {snapshot.updatedAt !== v.updatedAt && (
            <p role="alert">El vehículo cambió. Cierra y vuelve a abrir el formulario.</p>
          )}
          <label>
            Nueva lectura de kilometraje
            <input name="km" type="number" min="0" max="5000000" required disabled={v.inService} />
          </label>
          <label>
            Motivo del ajuste
            <input name="reason" minLength={3} maxLength={500} required disabled={v.inService} />
          </label>
          {v.inService && <p>El ajuste de odómetro estará disponible al cerrar el viaje activo.</p>}
          <div className="ops-actions">
            <button disabled={v.inService || snapshot.updatedAt !== v.updatedAt}>
              Guardar kilometraje
            </button>
            <button type="button" onClick={() => setSnapshot(null)}>
              Cerrar formulario
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
