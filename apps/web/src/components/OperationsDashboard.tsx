import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { ThemeToggle } from "./ThemeToggle";
import { CostCenterField } from "./CostCenterField";
import { AddressField } from "./AddressField";
import { AddressChangeAlerts } from "./AddressChangeAlerts";
import { CostCenterReport } from "./CostCenterReport";
import { PulsoMark } from "./PulsoMark";
import { API_URL, ApiError, api, labels, time, today, type CostCenter, type Driver, type Service, type Vehicle } from "../operations";
import "./OperationsDashboard.css";

type Props = { user: { id: string; fullName: string; role: "ADMIN" | "DRIVER" }; onLogout: () => Promise<void>; logoutLoading: boolean };
type List = { entries: Service[]; active: Service[]; upcoming: Service[]; total: number };
type Profile = { kind: "driver" | "vehicle"; id: string; name: string };
type OpenProfile = (profile: Profile) => void;
const values = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); return new FormData(event.currentTarget); };
const text = (f: FormData, key: string) => String(f.get(key) ?? "");
const vehicleLabel = (v: { model: string | null; roleCode: string }) => `${v.model || "Modelo no registrado"} · Rol ${v.roleCode}`;
const vehicleOptions = (vehicles: Vehicle[]) => vehicles.filter(v => v.active).map(v => <option key={v.id} value={v.id}>{vehicleLabel(v)}{v.inService ? " · En servicio" : ""}</option>);
const driverOptions = (drivers: Driver[]) => drivers.map(d => <option key={d.id} value={d.id}>{d.fullName}{d.serviceLegs.length ? " · En servicio" : ""}</option>);
const statusFilters = [
  ["", "Todos"], ["IN_PROGRESS", "Activos (en servicio)"], ["COMPLETED", "Completados"],
  ["ASSIGNED", "Asignados"], ["PENDING", "Pendientes"], ["CANCELLED", "Cancelados"],
] as const;
type StatusFilterBarProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
};

function StatusFilterBar({
  value,
  onChange,
  label,
}: StatusFilterBarProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const [indicator, setIndicator] =
    useState({
      x: 0,
      y: 0,
      width: 0,
      visible: false,
    });

  const updateIndicator =
    useCallback(() => {
      const container =
        containerRef.current;

      if (!container) {
        return;
      }

      const active =
        container.querySelector<HTMLButtonElement>(
          '[aria-pressed="true"]',
        );

      if (!active) {
        return;
      }

      setIndicator({
        x: active.offsetLeft + 18,
        y:
          active.offsetTop +
          active.offsetHeight -
          8,
        width: Math.max(
          active.offsetWidth - 36,
          12,
        ),
        visible: true,
      });
    }, []);

  useLayoutEffect(() => {
    updateIndicator();

    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    const observer =
      new ResizeObserver(
        updateIndicator,
      );

    observer.observe(container);

    container
      .querySelectorAll("button")
      .forEach((button) =>
        observer.observe(button),
      );

    return () => {
      observer.disconnect();
    };
  }, [value, updateIndicator]);

  const style = {
    "--filter-slider-x":
      `${indicator.x}px`,
    "--filter-slider-y":
      `${indicator.y}px`,
    "--filter-slider-width":
      `${indicator.width}px`,
  } as CSSProperties;

  return (
    <div
      ref={containerRef}
      className="ops-status-filters"
      role="group"
      aria-label={label}
      data-active-state={
        value || "ALL"
      }
      style={style}
    >
      <span
        className="ops-status-slider"
        data-visible={
          indicator.visible
        }
        aria-hidden="true"
      />

      {statusFilters.map(
        ([filterValue, filterLabel]) => (
          <button
            key={filterValue}
            type="button"
            className="ops-status-filter"
            data-state={filterValue}
            aria-pressed={
              value === filterValue
            }
            onClick={() =>
              onChange(filterValue)
            }
          >
            {filterLabel}
          </button>
        ),
      )}
    </div>
  );
}

export function OperationsDashboard({ user, onLogout, logoutLoading }: Props) {
  const admin = user.role === "ADMIN";
  const [entries, setEntries] = useState<Service[]>([]);
  const [activeServices, setActiveServices] = useState<Service[]>([]);
  const [upcomingServices, setUpcomingServices] = useState<Service[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [pollError, setPollError] = useState("");
  const [updated, setUpdated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [tab, setTab] = useState<"start" | "services" | "vehicles" | "history" | "costs">("start");
  const [profile, setProfile] = useState<Profile | null>(null);
  const openProfile: OpenProfile = profile => { setProfile(profile); setTab("history"); window.scrollTo({ top: 0 }); };
  const [createError, setCreateError] = useState("");
  const [createRevision, setCreateRevision] = useState(0);
  const sequence = useRef(0);

  const reload = useCallback(async (signal?: AbortSignal) => {
    const request = ++sequence.current;
    try {
      const [services, catalog, centers, team] = await Promise.all([
        api<List>(`/api/services${admin ? "" : "/mine"}?page=${page}${status ? "&status=" + status : ""}`, undefined, "GET", signal),
        api<{ vehicles: Vehicle[] }>("/api/vehicles", undefined, "GET", signal),
        api<{ costCenters: CostCenter[] }>("/api/cost-centers", undefined, "GET", signal),
        admin ? api<{ drivers: Driver[] }>("/api/admin/drivers", undefined, "GET", signal) : Promise.resolve({ drivers: [] }),
      ]);
      if (signal?.aborted || request !== sequence.current) return;
      setEntries([...new Map([...services.active, ...services.entries].map(e => [e.id, e])).values()]);
      setActiveServices(services.active); setCostCenters(centers.costCenters);
      setUpcomingServices(services.upcoming);
      setTotal(services.total); setVehicles(catalog.vehicles); setDrivers(team.drivers);
      setUpdated(new Date().toISOString()); setPollError("");
    } catch (e) {
      if (signal?.aborted || request !== sequence.current) return;
      if (e instanceof ApiError && e.status === 401) setExpired(true);
      setPollError(e instanceof Error ? e.message : "Sin conexión.");
    }
  }, [admin, page, status]);

  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    const refresh = async () => {
      if (running || controller.signal.aborted || document.hidden) return;
      running = true;
      try { await reload(controller.signal); } finally { running = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [reload]);

  async function mutate(path: string, body: unknown, method = "POST", onError: (message: string) => void = setError) {
    setBusy(true); setError("");
    try { await api(path, body, method); await reload(); return true; }
    catch (e) { if (e instanceof ApiError && e.status === 401) setExpired(true); await reload(); onError(e instanceof Error ? e.message : "No fue posible guardar."); return false; }
    finally { setBusy(false); }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const f = values(event);
    const started = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "start";
    setCreateError("");
    if (await mutate("/api/services", { costCenterId: text(f, "costCenter"), serviceAddress: text(f, "address"), actionPerformed: text(f, "activity"), vehicleId: text(f, "vehicle") || null, ...(admin ? { driverId: text(f, "driver") || null } : {}), startNow: started }, "POST", setCreateError)) { form.reset(); setCreateRevision(r => r + 1); if (!started) { setStatus(""); setPage(1); setTab("services"); } }
  }
  async function exportFile(event: FormEvent<HTMLFormElement>) {
    const f = values(event); setBusy(true); setError("");
    try {
      const response = await fetch(API_URL + `/api/exports/daily?from=${text(f, "from")}&to=${text(f, "to")}`, { credentials: "include" });
      if (!response.ok) { if (response.status === 401) setExpired(true); throw new Error("No fue posible exportar. Revisa el período (máximo 366 días) y tu sesión."); }
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a");
      link.href = url; link.download = `pulso-${text(f, "from")}-${text(f, "to")}.xlsx`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "Error al exportar."); } finally { setBusy(false); }
  }

  return <main className="driver-page ops-dashboard">
    {!admin && <AddressChangeAlerts key={user.id} userId={user.id} services={[...activeServices, ...upcomingServices, ...entries]} />}
    <header className="driver-header"><div className="driver-header-inner">
      <div className="driver-brand"><PulsoMark size="small" /><div><strong>Pulso</strong><span>Oficina de Movilización del Hospital de Talca</span></div></div>
      <ThemeToggle /><div className="driver-user"><div><strong>{user.fullName}</strong><span>{admin ? "Administración" : "Chofer"}</span></div><button className="driver-logout-button ops-icon-button" onClick={() => void onLogout()} disabled={logoutLoading} aria-label="Cerrar sesión" title="Cerrar sesión"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4H4v16h5M14 8l4 4-4 4M8 12h10" /></svg></button></div>
    </div></header>
    <section className="ops-content">
      {admin && <div className="ops-title"><h1>Administración</h1></div>}
      {!updated && <p className="ops-sync" role="status">Cargando…</p>}
      {(error || pollError) && <div className="driver-error" role="alert">{error || pollError}{pollError && " Los datos pueden estar desactualizados."}</div>}
      {expired && <div className="driver-error" role="alert">Tu sesión terminó. <button onClick={() => void onLogout()}>Volver al acceso</button></div>}
      <div className="ops-navigation-row">
      <fieldset className="ops-workspace ops-navigation-sections" disabled={busy || expired || !updated}>
      <nav className="ops-tabs ops-main-nav" aria-label="Secciones del panel"><button aria-pressed={tab === "start"} onClick={() => setTab("start")}>{admin ? "Nuevo servicio" : "Iniciar servicio"}</button><button aria-pressed={tab === "services"} onClick={() => setTab("services")}>{admin ? "Ver servicios" : "Mis servicios"}</button>{admin && <button aria-pressed={tab === "vehicles"} onClick={() => setTab("vehicles")}>Vehículos</button>}{admin && <button aria-pressed={tab === "costs"} onClick={() => setTab("costs")}>Centros de costos</button>}</nav>
      </fieldset>
      <button className="ops-icon-button" onClick={() => void reload()} disabled={busy} aria-label="Actualizar" title={updated ? "Actualizar · Última actualización: " + time(updated) : "Actualizar"}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 1-2.34-5.66L20 8" /><path d="M20 3v5h-5" /></svg></button>
      </div>
      <fieldset className="ops-workspace" disabled={busy || expired || !updated}>
      {admin && profile && <nav className="ops-tabs" aria-label="Historial seleccionado"><button aria-pressed={tab === "history"} onClick={() => setTab("history")}>{profile.name}</button><button onClick={() => { setProfile(null); if (tab === "history") setTab("services"); }} aria-label="Cerrar pestaña de historial">Cerrar historial</button></nav>}
      {tab === "costs" && admin ? <CostCenterReport /> : tab === "history" && admin && profile ? <ProfileHistory costCenters={costCenters} key={profile.kind + profile.id} profile={profile} vehicles={vehicles} drivers={drivers} mutate={mutate} onProfile={openProfile} /> : tab === "vehicles" && admin ? <VehiclePanel vehicles={vehicles} mutate={mutate} onProfile={openProfile} /> : <>
        <section hidden={tab !== "start"}>
        {!admin && activeServices.length > 0 && <><h2>Tu viaje en curso</h2><p>Finaliza el viaje o registra los kilómetros de cancelación antes de iniciar otro.</p>{activeServices.map(entry => <ServiceCard costCenters={costCenters} key={entry.id} entry={entry} admin={false} vehicles={vehicles} drivers={drivers} mutate={mutate} />)}</>}
        {!admin && upcomingServices.length > 0 && <section aria-label="Viajes pendientes"><h2>Por iniciar</h2><div className="ops-services">{upcomingServices.map(entry => <ServiceCard costCenters={costCenters} key={entry.id} entry={entry} admin={false} vehicles={vehicles} drivers={drivers} mutate={mutate} />)}</div></section>}
        {(admin || activeServices.length === 0) && <section className="ops-card ops-start-card">
          {!admin && upcomingServices.length > 0 && <h2>Nuevo servicio</h2>}
          <form onSubmit={e => void create(e)} onChange={() => setCreateError("")} className="ops-form">
            <AddressField key={`address-${createRevision}`} wide={admin} />
            {admin && <label>Chofer<select name="driver"><option value="">Sin asignar</option>{driverOptions(drivers)}</select></label>}
            <label>Vehículo<select name="vehicle"><option value="">Seleccionar vehículo</option>{vehicleOptions(vehicles)}</select></label>
            <CostCenterField key={createRevision} centers={costCenters} />
            <label className="ops-field-wide">Actividad<textarea name="activity" minLength={2} maxLength={250} required /></label>
            {createError && <p className="driver-error" role="alert">{createError}</p>}
            <div className="ops-actions">{!admin && <button type="submit" className="ops-start-button" value="start">Iniciar viaje</button>}<button type="submit" value="save">{admin ? "Guardar servicio" : "Guardar para después"}</button></div>
          </form>
        </section>}
        </section>
        <section hidden={tab !== "services"}>
        {admin && <details className="ops-card"><summary>Ver disponibilidad de choferes</summary><div className="ops-team">{drivers.map(d => <div key={d.id}><button className="ops-entity-link" onClick={() => openProfile({ kind: "driver", id: d.id, name: d.fullName })}>{d.fullName}</button><span className={d.serviceLegs.length ? "ops-badge active" : "ops-badge"}>{d.serviceLegs.length ? "En servicio" : "Disponible"}</span></div>)}</div></details>}
        {admin && <form className="ops-card ops-export" onSubmit={e => void exportFile(e)}><div><h2>Exportar finalizados</h2><p>Período de finalización · Hora de Chile</p></div><label>Desde<input type="date" name="from" defaultValue={today()} required /></label><label>Hasta<input type="date" name="to" defaultValue={today()} required /></label><button>Exportar Excel</button></form>}
        <div className="ops-filter">
          <StatusFilterBar
            value={status}
            label="Filtrar servicios por estado"
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
          <span>{total} servicios{!admin && activeServices.length > 0 && " · Incluye tu viaje activo"}</span>
        </div>
        <div className="ops-services">{entries.map(entry => <ServiceCard costCenters={costCenters} key={entry.id} entry={entry} admin={admin} vehicles={vehicles} drivers={drivers} mutate={mutate} onProfile={openProfile} />)}</div>
        {updated && !entries.length && <p className="ops-empty">No hay servicios para este filtro.</p>}
        {(total > 30 || page > 1) && <div className="ops-pagination"><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</button><span>Página {page}</span><button disabled={page * 30 >= total} onClick={() => setPage(p => p + 1)}>Siguiente</button></div>}
        </section>
      </>}
      </fieldset>
    </section>
  </main>;
}

type Mutation = (path: string, body: unknown, method?: string, onError?: (message: string) => void) => Promise<boolean>;
function ProfileHistory({ profile, costCenters, vehicles, drivers, mutate, onProfile }: { profile: Profile; costCenters: CostCenter[]; vehicles: Vehicle[]; drivers: Driver[]; mutate: Mutation; onProfile: OpenProfile }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("COMPLETED");
  const [result, setResult] = useState<List | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    const refresh = async () => {
      if (running || controller.signal.aborted) return;
      running = true;
      try {
        const data = await api<List>(`/api/services?${profile.kind === "driver" ? "driverId" : "vehicleId"}=${profile.id}&page=${page}${status ? "&status=" + status : ""}`, undefined, "GET", controller.signal);
        if (!controller.signal.aborted) { setResult(data); setError(""); }
      } catch (e) { if (!controller.signal.aborted) { setResult(null); setError(e instanceof Error ? e.message : "No se pudo cargar el historial."); } }
      finally { running = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [profile.id, profile.kind, page, status, revision]);
  const historyMutate: Mutation = async (...args) => { const ok = await mutate(...args); setRevision(r => r + 1); return ok; };
  return <section className="ops-profile">
    <h2 ref={heading} tabIndex={-1}>{profile.name}</h2>
    <p>Servicios por {profile.kind === "driver" ? "chofer" : "vehículo"} · Incluye participación en tramos anteriores.</p>
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
    {error ? <p className="driver-error" role="alert">{error}<button onClick={() => setRevision(r => r + 1)}>Reintentar</button></p> : !result ? <p role="status">Cargando historial…</p> : <>
      <p>{result.total} servicios</p>
      {result.entries.map(entry => <ServiceCard costCenters={costCenters} key={entry.id} entry={entry} admin vehicles={vehicles} drivers={drivers} mutate={historyMutate} onProfile={onProfile} />)}
      {!result.entries.length && <p>No hay servicios para este estado.</p>}
      {(result.total > 30 || page > 1) && <div className="ops-pagination"><button disabled={page === 1} onClick={() => { setResult(null); setPage(p => p - 1); }}>Anterior</button><span>Página {page}</span><button disabled={page * 30 >= result.total} onClick={() => { setResult(null); setPage(p => p + 1); }}>Siguiente</button></div>}
    </>}
  </section>;
}
function ServiceCard({ entry: s, costCenters, admin, vehicles, drivers, mutate, onProfile }: { entry: Service; costCenters: CostCenter[]; admin: boolean; vehicles: Vehicle[]; drivers: Driver[]; mutate: Mutation; onProfile?: OpenProfile }) {
  const [edit, setEdit] = useState<{ command: string; snapshot: Service } | null>(null);
  const [logs, setLogs] = useState<{ id: string; action: string; createdAt: string; actor: { fullName: string } | null }[] | null>(null);
  const [auditError, setAuditError] = useState("");
  const [formError, setFormError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (formError) errorRef.current?.scrollIntoView({ block: "nearest" });
  }, [formError]);
  const open = (command: string) => { setFormError(""); setEdit({ command, snapshot: s }); };
  async function submit(event: FormEvent<HTMLFormElement>) {
    const f = values(event); if (!edit) return;
    setFormError("");
    const body: Record<string, unknown> = { version: edit.snapshot.version };
    if (["complete", "close-cancellation"].includes(edit.command)) body.odometerKm = Number(text(f, "km"));
    if (edit.command === "start") { if (text(f, "vehicle")) body.vehicleId = text(f, "vehicle"); }
    if (edit.command === "assignment") { body.driverId = text(f, "driver"); body.vehicleId = text(f, "vehicle") || null; if (text(f, "km")) body.odometerKm = Number(text(f, "km")); }
    if (edit.command === "address" || edit.command === "return") body.serviceAddress = text(f, "address");
    if (edit.command === "cost-center") body.costCenterId = text(f, "costCenter");
    if (edit.command === "cancel") body.reason = text(f, "reason");
    if (edit.command === "return") { body.actionPerformed = text(f, "activity"); body.startNow = !admin && f.get("startNow") === "on"; }
    if (await mutate(`/api/services/${s.id}/${edit.command}`, body, "POST", setFormError)) setEdit(null);
  }
  async function audit() { try { setLogs((await api<{ logs: NonNullable<typeof logs> }>(`/api/services/${s.id}/audit`)).logs); setAuditError(""); } catch { setAuditError("No fue posible cargar la trazabilidad."); } }
  const formatKm = (km: number | null) => km === null ? "Sin registro" : new Intl.NumberFormat("es-CL").format(km) + " km";
  return <article className="ops-card ops-service-card">
    <div className="ops-card-title"><span className="ops-badge" data-state={s.status}>{labels[s.status] ?? s.status}{s.closurePending ? " · Falta registrar kilómetros" : ""}</span>{s.returnOfId && <span>Viaje de regreso</span>}</div>
    <h2>{s.actionPerformed}</h2>
    {admin && s.addressRevisions.length > 1 && <p className="ops-change" role="status">Dirección corregida por {s.addressRevisions[0]?.actor?.fullName ?? "administración"} · {time(s.addressRevisions[0]?.createdAt ?? null)}</p>}
    <dl className="ops-service-summary">
      <div><dt>Vehículo</dt><dd>{s.vehicle && s.vehicleId ? admin && onProfile ? <button className="ops-entity-link" onClick={() => onProfile({ kind: "vehicle", id: s.vehicleId!, name: vehicleLabel(s.vehicle!) })}>{vehicleLabel(s.vehicle)}</button> : vehicleLabel(s.vehicle) : "Por asignar"}</dd></div>
      {admin && <div><dt>Chofer</dt><dd>{s.driver && s.driverId && onProfile ? <button className="ops-entity-link" onClick={() => onProfile({ kind: "driver", id: s.driverId!, name: s.driver!.fullName })}>{s.driver.fullName}</button> : s.driver?.fullName ?? "Por asignar"}</dd></div>}
      {s.status === "COMPLETED" && <div><dt>Recorrido total</dt><dd>{formatKm(s.distanceKm)}</dd></div>}
    </dl>
    <p className="ops-service-date">Centro de costos: {s.costCenter ? s.costCenter.code + " · " + s.costCenter.name : "Sin centro asignado"}</p>
    <div className="ops-service-destination"><span>Destino</span><p>{s.serviceAddress}</p><a className="ops-destination-link" href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(s.serviceAddress)} target="_blank" rel="noreferrer">Google Maps ↗</a></div>
    {(s.endedAt || s.startedAt) && <p className="ops-service-date">{s.endedAt ? "Finalizado: " + time(s.endedAt) : "Inicio: " + time(s.startedAt)}</p>}
    {s.voidReason && <p className="ops-change">Cancelación: {s.voidReason}</p>}
    <div className="ops-actions">
      {!admin && s.status === "ASSIGNED" && <button className="ops-primary-action" onClick={() => open("start")}>Iniciar viaje</button>}
      {!admin && s.status === "IN_PROGRESS" && <button className="ops-primary-action" onClick={() => open("complete")}>Finalizar viaje</button>}
      {!admin && s.closurePending && <button className="ops-primary-action" onClick={() => open("close-cancellation")}>Registrar kilómetros</button>}
      {admin && <button onClick={() => open("cost-center")}>Asignar centro de costos</button>}
      {admin && <button onClick={() => open("address")}>Corregir dirección</button>}
      {admin && ["PENDING", "ASSIGNED", "IN_PROGRESS"].includes(s.status) && <><button onClick={() => open("assignment")}>Asignar / reasignar</button><button onClick={() => open("cancel")}>Cancelar servicio</button></>}
      {s.status === "CANCELLED" && !s.closurePending && s.legs.length > 0 && !s.returnService && <button onClick={() => open("return")}>Crear viaje de regreso</button>}
    </div>
    {edit && <form className="ops-form ops-edit" onSubmit={e => void submit(e)} onChange={() => setFormError("")}>
      {edit.command === "cost-center" && <CostCenterField centers={costCenters} initial={edit.snapshot.costCenterId ?? ""} />}
      {edit.snapshot.version !== s.version && <p role="alert">El servicio cambió mientras editabas. Cierra este formulario y vuelve a abrirlo con los datos actualizados.</p>}
      {["address", "return"].includes(edit.command) && <AddressField key={edit.command} label={edit.command === "return" ? "Destino de regreso" : "Dirección corregida"} initial={edit.command === "address" ? edit.snapshot.serviceAddress : ""} />}
      {edit.command === "return" && <><label>Actividad a realizar<textarea name="activity" minLength={2} maxLength={250} required /></label>{!admin && <label className="ops-check"><input type="checkbox" name="startNow" />Iniciar el regreso ahora</label>}</>}
      {edit.command === "assignment" && <label>Chofer<select name="driver" defaultValue={edit.snapshot.driverId ?? ""} required><option value="">Seleccionar</option>{driverOptions(drivers)}</select></label>}
      {["assignment", "start"].includes(edit.command) && <label>Vehículo<select name="vehicle" defaultValue={edit.snapshot.vehicleId ?? ""} disabled={edit.command === "start" && !!edit.snapshot.vehicleId} required={edit.command === "start" || edit.snapshot.status === "IN_PROGRESS"}><option value="">Sin asignar</option>{vehicleOptions(vehicles)}</select>{edit.command === "start" && edit.snapshot.vehicleId && <small>Para cambiar el vehículo asignado, solicita la reasignación a administración.</small>}</label>}
      {(["complete", "close-cancellation"].includes(edit.command) || edit.command === "assignment" && edit.snapshot.status === "IN_PROGRESS") && <label>{edit.command === "assignment" ? "Kilometraje actual del vehículo que termina el tramo" : "Kilometraje de llegada"}<input name="km" type="number" min="0" max="5000000" step="1" required /></label>}
      {edit.command === "cancel" && <><label>Motivo de cancelación<textarea name="reason" minLength={3} maxLength={500} required /></label>{s.status === "IN_PROGRESS" && <p>El chofer deberá registrar el kilometraje antes de liberar el vehículo.</p>}</>}
      {formError && <p ref={errorRef} className="driver-error ops-form-error" role="alert">{formError}</p>}
      <div className="ops-actions"><button className="ops-primary-action" disabled={edit.snapshot.version !== s.version}>{({ "cost-center": "Guardar centro", start: "Confirmar inicio", complete: "Confirmar finalización", assignment: "Guardar asignación", address: "Guardar dirección", cancel: "Confirmar cancelación", "close-cancellation": "Guardar kilómetros", return: "Crear regreso" } as Record<string, string>)[edit.command] ?? "Confirmar"}</button><button type="button" onClick={() => { setFormError(""); setEdit(null); }}>Cerrar formulario</button></div>
    </form>}
    <details className="ops-history"><summary>Ver detalles del servicio</summary>
      <p>Referencia: {s.id}</p>
      <dl className="ops-facts"><div><dt>Inicio</dt><dd>{time(s.startedAt)}</dd></div><div><dt>Finalización</dt><dd>{time(s.endedAt)}</dd></div></dl>
      <h3>Direcciones registradas</h3>
      <ol>{s.addressRevisions.map(r => <li key={r.id}>{r.address} · {r.actor?.fullName ?? (r.source === "LEGACY" ? "Registro histórico" : "Sin autor disponible")} · {time(r.createdAt)}</li>)}</ol>
      {s.legs.length > 0 && <h3>Recorridos</h3>}
      {s.legs.map(l => <section className="ops-leg" key={l.id}><p><strong>{l.driver.fullName}</strong> · {vehicleLabel(l.vehicle)}</p><dl className="ops-facts"><div><dt>Salida</dt><dd>{time(l.startedAt)}</dd></div><div><dt>Llegada</dt><dd>{time(l.endedAt)}</dd></div><div><dt>Odómetro de salida</dt><dd>{formatKm(l.departureOdometerKm)}</dd></div><div><dt>Odómetro de llegada</dt><dd>{formatKm(l.arrivalOdometerKm)}</dd></div></dl></section>)}
      {admin && <><button onClick={() => void audit()}>Consultar trazabilidad</button>{auditError && <p role="alert">{auditError}</p>}{logs?.map(l => <p key={l.id}>{time(l.createdAt)} · {l.action} · {l.actor?.fullName ?? "Sin autor"}</p>)}</>}
    </details>
  </article>;
}

function VehiclePanel({ vehicles, mutate, onProfile }: { vehicles: Vehicle[]; mutate: Mutation; onProfile: OpenProfile }) {
  async function create(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget; const f = values(event);
    if (await mutate("/api/vehicles", { roleCode: text(f, "role"), licensePlate: text(f, "plate"), vehicleType: text(f, "type") || null, model: text(f, "model") || null, year: text(f, "year") ? Number(text(f, "year")) : null, currentOdometerKm: Number(text(f, "km")) })) form.reset();
  }
  return <><details className="ops-card"><summary>Registrar nuevo vehículo</summary><p>Revisa la patente, el tipo, el modelo y el año antes de registrar: esos datos quedarán fijos. El rol institucional se podrá cambiar.</p><form className="ops-form" onSubmit={e => void create(e)}>
    <label>Rol institucional<input name="role" maxLength={30} required /></label><label>Patente<input name="plate" minLength={3} maxLength={20} required /></label>
    <label>Tipo<input name="type" minLength={2} maxLength={60} /></label><label>Modelo<input name="model" maxLength={120} /></label><label>Año<input name="year" type="number" min="1900" max="2100" /></label>
    <label>Kilometraje inicial<input name="km" type="number" min="0" max="5000000" required /></label><button>Registrar</button>
  </form></details><div className="ops-services">{vehicles.map(v => <VehicleCard key={v.id} vehicle={v} mutate={mutate} onProfile={onProfile} />)}</div></>;
}
function VehicleCard({ vehicle: v, mutate, onProfile }: { vehicle: Vehicle; mutate: Mutation; onProfile: OpenProfile }) {
  const [snapshot, setSnapshot] = useState<Vehicle | null>(null);
  async function save(event: FormEvent<HTMLFormElement>) {
    const f = values(event); if (!snapshot) return;
    const body: Record<string, unknown> = { expectedUpdatedAt: snapshot.updatedAt, roleCode: text(f, "role") };
    if (text(f, "km")) { body.currentOdometerKm = Number(text(f, "km")); body.reason = text(f, "reason"); }
    if (await mutate("/api/vehicles/" + v.id, body, "PATCH")) setSnapshot(null);
  }
  return <article className="ops-card"><h2><button className="ops-entity-link" onClick={() => onProfile({ kind: "vehicle", id: v.id, name: vehicleLabel(v) })}>{vehicleLabel(v)}</button></h2><p>{[v.vehicleType, v.year, "Patente " + v.licensePlate].filter(Boolean).join(" · ")}</p><p>{v.currentOdometerKm ?? "Sin registro"} km · {!v.active ? "Inactivo" : v.inService ? "En servicio" : "Disponible"}</p>
    <div className="ops-actions"><button onClick={() => setSnapshot(v)}>Cambiar rol / ajustar kilometraje</button><button disabled={v.inService} onClick={() => void mutate("/api/vehicles/" + v.id, { active: !v.active, expectedUpdatedAt: v.updatedAt }, "PATCH")}>{v.active ? "Desactivar" : "Activar"}</button></div>
    {snapshot && <form className="ops-form ops-edit" onSubmit={e => void save(e)}>
      {snapshot.updatedAt !== v.updatedAt && <p role="alert">El vehículo cambió. Cierra y vuelve a abrir el formulario.</p>}
      <p>La patente, el tipo, el modelo y el año son datos fijos del vehículo.</p>
      <label>Rol institucional<input name="role" defaultValue={snapshot.roleCode} maxLength={30} required /></label>
      <label>Nueva lectura de kilometraje (opcional)<input name="km" type="number" min="0" max="5000000" disabled={v.inService} /></label><label>Motivo del ajuste de kilometraje<input name="reason" minLength={3} maxLength={500} disabled={v.inService} /></label>
      {v.inService && <p>El ajuste de odómetro estará disponible al cerrar el tramo activo.</p>}
      <div className="ops-actions"><button disabled={snapshot.updatedAt !== v.updatedAt}>Guardar</button><button type="button" onClick={() => setSnapshot(null)}>Cerrar formulario</button></div>
    </form>}
  </article>;
}
