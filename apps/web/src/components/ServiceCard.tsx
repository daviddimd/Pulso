import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "./Icon";
import { CostCenterField, UNDEFINED_COST_CENTER } from "./CostCenterField";
import { DestinationsField } from "./DestinationsField";
import {
  api,
  labels,
  time,
  type CostCenter,
  type Driver,
  type Service,
  type Vehicle,
} from "../operations";
import {
  type OpenProfile,
  type Mutation,
  values,
  text,
  vehicleLabel,
  vehicleOptions,
  driverOptions,
  routeLink,
} from "./dashboardShared";

export function ServiceDisclosure({
  entry,
  subtitle,
  children,
}: {
  entry: Service;
  subtitle: string;
  children: ReactNode;
}) {
  const date = entry.endedAt ?? entry.startedAt;
  return (
    <details className="ops-profile-trip">
      <summary>
        <span className="ops-badge" data-state={entry.status}>
          {labels[entry.status]}
        </span>
        <span className="ops-profile-trip-title">
          <strong>{entry.actionPerformed}</strong>
          <span>{subtitle}</span>
        </span>
        <span className="ops-profile-trip-date">
          {date ? <time dateTime={date}>{time(date)}</time> : "Sin iniciar"}
        </span>
        <Icon name="chevron" />
      </summary>
      <div className="ops-profile-trip-body">{children}</div>
    </details>
  );
}
export function ServiceCard({
  entry: s,
  costCenters,
  admin,
  vehicles,
  drivers,
  mutate,
  onProfile,
  viewerId,
}: {
  viewerId?: string;
  entry: Service;
  costCenters: CostCenter[];
  admin: boolean;
  vehicles: Vehicle[];
  drivers: Driver[];
  mutate: Mutation;
  onProfile?: OpenProfile;
}) {
  const [edit, setEdit] = useState<{ command: string; snapshot: Service } | null>(null);
  const [logs, setLogs] = useState<
    { id: string; action: string; createdAt: string; actor: { fullName: string } | null }[] | null
  >(null);
  const [auditError, setAuditError] = useState("");
  const [formError, setFormError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (formError) errorRef.current?.scrollIntoView({ block: "nearest" });
  }, [formError]);
  const open = (command: string) => {
    setFormError("");
    setEdit({ command, snapshot: s });
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    const f = values(event);
    if (!edit) return;
    setFormError("");
    const body: Record<string, unknown> = { version: edit.snapshot.version };
    if (edit.command === "complete") body.odometerKm = Number(text(f, "km"));
    if (edit.command === "start") {
      if (text(f, "vehicle")) body.vehicleId = text(f, "vehicle");
    }
    if (edit.command === "assignment") {
      body.driverId = text(f, "driver");
      body.vehicleId = text(f, "vehicle") || null;
      if (text(f, "km")) body.odometerKm = Number(text(f, "km"));
    }
    if (edit.command === "address") body.destinations = f.getAll("address").map(String);
    if (edit.command === "cost-center")
      body.costCenterId =
        text(f, "costCenter") === UNDEFINED_COST_CENTER ? null : text(f, "costCenter");
    if (edit.command === "cancel") body.reason = text(f, "reason");
    if (await mutate(`/api/services/${s.id}/${edit.command}`, body, "POST", setFormError))
      setEdit(null);
  }
  async function audit() {
    try {
      setLogs((await api<{ logs: NonNullable<typeof logs> }>(`/api/services/${s.id}/audit`)).logs);
      setAuditError("");
    } catch {
      setAuditError("No fue posible cargar la trazabilidad.");
    }
  }
  const formatKm = (km: number | null) =>
    km === null ? "Sin registro" : new Intl.NumberFormat("es-CL").format(km) + " km";
  return (
    <article className="ops-card ops-service-card" data-service-state={s.status}>
      <div className="ops-card-title">
        <span className="ops-badge" data-state={s.status}>
          <span className="ops-state-dot" />
          {labels[s.status] ?? s.status}
        </span>
        {admin && <span className="ops-service-reference">#{s.id}</span>}
      </div>
      <h2>{s.actionPerformed}</h2>
      {admin && s.addressRevisions.length > 1 && (
        <p className="ops-change" role="status">
          Dirección corregida por {s.addressRevisions[0]?.actor?.fullName ?? "administración"} ·{" "}
          {time(s.addressRevisions[0]?.createdAt ?? null)}
        </p>
      )}
      <dl className="ops-service-summary">
        <div>
          <dt>Vehículo</dt>
          <dd>
            {s.vehicle && s.vehicleId ? (
              admin && onProfile ? (
                <button
                  className="ops-entity-link"
                  onClick={() =>
                    onProfile({ kind: "vehicle", id: s.vehicleId!, name: vehicleLabel(s.vehicle!) })
                  }
                >
                  {vehicleLabel(s.vehicle)}
                </button>
              ) : (
                vehicleLabel(s.vehicle)
              )
            ) : (
              "Por asignar"
            )}
          </dd>
        </div>
        {admin && (
          <div>
            <dt>Chofer</dt>
            <dd>
              {s.driver && s.driverId && onProfile ? (
                <button
                  className="ops-entity-link"
                  onClick={() =>
                    onProfile({ kind: "driver", id: s.driverId!, name: s.driver!.fullName })
                  }
                >
                  {s.driver.fullName}
                </button>
              ) : (
                (s.driver?.fullName ?? "Por asignar")
              )}
            </dd>
          </div>
        )}
        {s.status === "COMPLETED" && (
          <div>
            <dt>Recorrido total</dt>
            <dd>{formatKm(s.distanceKm)}</dd>
          </div>
        )}
      </dl>
      <p className="ops-service-date">
        Centro de costos:{" "}
        {s.costCenter ? s.costCenter.code + " · " + s.costCenter.name : "Indefinido"}
      </p>
      <div className="ops-service-destination">
        <span>{s.destinations.length > 1 ? "Ruta" : "Destino"}</span>
        {s.destinations.length > 1 ? (
          <ol className="ops-route">
            {s.destinations.map((address, i) => (
              <li key={i}>{address}</li>
            ))}
          </ol>
        ) : (
          <p>{s.serviceAddress}</p>
        )}
        <a
          className="ops-destination-link"
          href={routeLink(s.destinations)}
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="pin" />
          {s.destinations.length > 1 ? "Ver ruta en Maps" : "Ver en Maps"}
          <Icon name="arrow" />
        </a>
      </div>
      {(s.endedAt || s.startedAt) && (
        <p className="ops-service-date">
          {s.endedAt ? "Finalizado: " + time(s.endedAt) : "Inicio: " + time(s.startedAt)}
        </p>
      )}
      {s.voidReason && <p className="ops-change">Cancelación: {s.voidReason}</p>}
      <div className="ops-actions ops-service-actions">
        {!admin && viewerId === s.driverId && s.status === "ASSIGNED" && (
          <button className="ops-primary-action" onClick={() => open("start")}>
            Iniciar viaje
          </button>
        )}
        {!admin && viewerId === s.driverId && s.status === "IN_PROGRESS" && (
          <button className="ops-primary-action" onClick={() => open("complete")}>
            Finalizar viaje
          </button>
        )}
        {admin && (
          <details className="ops-service-tools">
            <summary>
              Gestionar servicio
              <Icon name="chevron" />
            </summary>
            <div className="ops-actions">
              <button onClick={() => open("cost-center")}>Asignar centro de costos</button>
              {admin && <button onClick={() => open("address")}>Corregir dirección</button>}
              {admin && ["PENDING", "ASSIGNED", "IN_PROGRESS"].includes(s.status) && (
                <button onClick={() => open("assignment")}>
                  {s.status === "IN_PROGRESS" ? "Registrar relevo" : "Asignar / reasignar"}
                </button>
              )}
              {admin &&
                ["PENDING", "ASSIGNED"].includes(s.status) &&
                !s.startedAt &&
                !s.legs.length && (
                  <button className="ops-danger-action" onClick={() => open("cancel")}>
                    Cancelar servicio
                  </button>
                )}
            </div>
          </details>
        )}
      </div>
      {edit && (
        <form
          className="ops-form ops-edit"
          onSubmit={(e) => void submit(e)}
          onChange={() => setFormError("")}
        >
          {edit.command === "assignment" && edit.snapshot.status === "IN_PROGRESS" && (
            <p>
              Se cerrará el tramo actual y el viaje continuará con el chofer y el vehículo
              seleccionados.
            </p>
          )}
          {edit.command === "cost-center" && (
            <CostCenterField
              centers={costCenters}
              initial={edit.snapshot.costCenterId ?? UNDEFINED_COST_CENTER}
            />
          )}
          {edit.snapshot.version !== s.version && (
            <p role="alert">
              El servicio cambió mientras editabas. Cierra este formulario y vuelve a abrirlo con
              los datos actualizados.
            </p>
          )}
          {edit.command === "address" && (
            <DestinationsField label="Destinos corregidos" initial={edit.snapshot.destinations} />
          )}
          {edit.command === "assignment" && (
            <label>
              Chofer
              <select name="driver" defaultValue={edit.snapshot.driverId ?? ""} required>
                <option value="">Seleccionar</option>
                {driverOptions(drivers)}
              </select>
            </label>
          )}
          {["assignment", "start"].includes(edit.command) && (
            <label>
              Vehículo
              <select
                name="vehicle"
                defaultValue={edit.snapshot.vehicleId ?? ""}
                disabled={edit.command === "start" && !!edit.snapshot.vehicleId}
                required={edit.command === "start" || edit.snapshot.status === "IN_PROGRESS"}
              >
                <option value="">Sin asignar</option>
                {vehicleOptions(vehicles)}
              </select>
              {edit.command === "start" && edit.snapshot.vehicleId && (
                <small>
                  Para cambiar el vehículo asignado, solicita la reasignación a administración.
                </small>
              )}
            </label>
          )}
          {(edit.command === "complete" ||
            (edit.command === "assignment" && edit.snapshot.status === "IN_PROGRESS")) && (
            <label>
              {edit.command === "assignment"
                ? "Kilometraje actual del vehículo saliente"
                : "Kilometraje de llegada"}
              <input
                name="km"
                type="number"
                inputMode="numeric"
                min="0"
                max="5000000"
                step="1"
                placeholder="Ej. 52 480"
                required
              />
            </label>
          )}
          {edit.command === "cancel" && (
            <label>
              Motivo de cancelación
              <textarea name="reason" minLength={3} maxLength={500} required />
            </label>
          )}
          {formError && (
            <p ref={errorRef} className="driver-error ops-form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="ops-actions">
            <button className="ops-primary-action" disabled={edit.snapshot.version !== s.version}>
              {(
                {
                  "cost-center": "Guardar centro",
                  start: "Confirmar inicio",
                  complete: "Confirmar finalización",
                  assignment:
                    edit.snapshot.status === "IN_PROGRESS"
                      ? "Confirmar relevo"
                      : "Guardar asignación",
                  address: "Guardar dirección",
                  cancel: "Confirmar cancelación",
                } as Record<string, string>
              )[edit.command] ?? "Confirmar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError("");
                setEdit(null);
              }}
            >
              Cerrar formulario
            </button>
          </div>
        </form>
      )}
      <details className="ops-history">
        <summary>
          Detalles del servicio
          <Icon name="chevron" />
        </summary>
        <p>Referencia: {s.id}</p>
        <dl className="ops-facts">
          <div>
            <dt>Inicio</dt>
            <dd>{time(s.startedAt)}</dd>
          </div>
          <div>
            <dt>Finalización</dt>
            <dd>{time(s.endedAt)}</dd>
          </div>
        </dl>
        <h3>Direcciones registradas</h3>
        <ol>
          {s.addressRevisions.map((r) => (
            <li key={r.id}>
              {r.address} ·{" "}
              {r.actor?.fullName ??
                (r.source === "LEGACY" ? "Registro histórico" : "Sin autor disponible")}{" "}
              · {time(r.createdAt)}
            </li>
          ))}
        </ol>
        {s.legs.length > 0 && <h3>Tramos y lecturas</h3>}
        {s.legs.map((l) => (
          <section className="ops-leg" key={l.id}>
            <p>
              <strong>{l.driver.fullName}</strong> · {vehicleLabel(l.vehicle)}
            </p>
            <dl className="ops-facts">
              <div>
                <dt>Salida</dt>
                <dd>{time(l.startedAt)}</dd>
              </div>
              <div>
                <dt>Llegada</dt>
                <dd>{time(l.endedAt)}</dd>
              </div>
              <div>
                <dt>Odómetro de salida</dt>
                <dd>{formatKm(l.departureOdometerKm)}</dd>
              </div>
              <div>
                <dt>Odómetro de llegada</dt>
                <dd>{formatKm(l.arrivalOdometerKm)}</dd>
              </div>
            </dl>
          </section>
        ))}
        {admin && (
          <>
            <button onClick={() => void audit()}>Consultar trazabilidad</button>
            {auditError && <p role="alert">{auditError}</p>}
            {logs?.map((l) => (
              <p key={l.id}>
                {time(l.createdAt)} · {l.action} · {l.actor?.fullName ?? "Sin autor"}
              </p>
            ))}
          </>
        )}
      </details>
    </article>
  );
}
