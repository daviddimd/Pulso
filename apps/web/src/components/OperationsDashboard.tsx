import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Icon, type IconName } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";
import { ProfileMenu } from "./ProfileMenu";
import { CostCenterField, UNDEFINED_COST_CENTER } from "./CostCenterField";
import { AddressField } from "./AddressField";
import { AddressChangeAlerts } from "./AddressChangeAlerts";
import { CostCenterReport } from "./CostCenterReport";
import { PulsoMark } from "./PulsoMark";
import { AccountsPanel } from "./AccountsPanel";
import {
  API_URL,
  ApiError,
  api,
  time,
  today,
  type CostCenter,
  type Driver,
  type Service,
  type Vehicle,
} from "../operations";
import {
  type List,
  type Profile,
  type OpenProfile,
  values,
  text,
  serviceSubtitle,
  vehicleOptions,
  driverOptions,
} from "./dashboardShared";
import { StatusFilterBar } from "./StatusFilterBar";
import { ServiceDisclosure, ServiceCard } from "./ServiceCard";
import { ProfileHistory } from "./ProfileHistory";
import { VehiclePanel } from "./VehiclePanel";
import "./OperationsDashboard.css";

type Props = {
  user: { id: string; fullName: string; role: "ADMIN" | "DRIVER"; establishmentName?: string };
  onLogout: () => Promise<void>;
  logoutLoading: boolean;
};
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
  const [tab, setTab] = useState<
    "start" | "services" | "vehicles" | "history" | "costs" | "accounts"
  >(admin ? "services" : "start");
  const [profile, setProfile] = useState<Profile | null>(null);
  const markExpired = useCallback(() => setExpired(true), []);
  const openProfile: OpenProfile = (profile) => {
    setProfile(profile);
    setTab("history");
    window.scrollTo({ top: 0 });
  };
  const [createError, setCreateError] = useState("");
  const [createRevision, setCreateRevision] = useState(0);
  const sequence = useRef(0);
  const catalogLoaded = useRef(false);
  const queryKey = `${status}:${page}`;
  const [settledQuery, setSettledQuery] = useState<string | null>(null);
  const [displayedQuery, setDisplayedQuery] = useState<string | null>(null);
  const [filterMotion, setFilterMotion] = useState(true);
  const filtering = settledQuery !== queryKey;
  const currentResults = displayedQuery === queryKey;

  const reload = useCallback(
    async (signal?: AbortSignal, includeCatalog = true) => {
      const request = ++sequence.current;
      try {
        const servicesRequest = api<List>(
          `/api/services${admin ? "" : "/mine"}?page=${page}${status ? "&status=" + status : ""}`,
          undefined,
          "GET",
          signal,
        ).then((services) => {
          if (signal?.aborted || request !== sequence.current) return;
          setEntries(
            admin
              ? services.entries
              : [
                  ...new Map(
                    [...services.active, ...services.entries].map((e) => [e.id, e]),
                  ).values(),
                ],
          );
          setActiveServices(services.active);
          setUpcomingServices(services.upcoming);
          setTotal(services.total);
          setDisplayedQuery(queryKey);
          setSettledQuery(queryKey);
        });
        const [, catalog, centers, team] = await Promise.all([
          servicesRequest,
          includeCatalog
            ? api<{ vehicles: Vehicle[] }>("/api/vehicles", undefined, "GET", signal)
            : null,
          includeCatalog
            ? api<{ costCenters: CostCenter[] }>("/api/cost-centers", undefined, "GET", signal)
            : null,
          includeCatalog && admin
            ? api<{ drivers: Driver[] }>("/api/admin/drivers", undefined, "GET", signal)
            : null,
        ]);
        if (signal?.aborted || request !== sequence.current) return;
        if (catalog && centers) {
          setVehicles(catalog.vehicles);
          setCostCenters(centers.costCenters);
          catalogLoaded.current = true;
        }
        if (team) setDrivers(team.drivers);
        setUpdated(new Date().toISOString());
        setPollError("");
      } catch (e) {
        if (signal?.aborted || request !== sequence.current) return;
        if (e instanceof ApiError && e.status === 401) setExpired(true);
        setPollError(e instanceof Error ? e.message : "Sin conexión.");
      } finally {
        if (!signal?.aborted && request === sequence.current) setSettledQuery(queryKey);
      }
    },
    [admin, page, status, queryKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    const refresh = async (includeCatalog = true) => {
      if (running || controller.signal.aborted || document.hidden) return;
      running = true;
      try {
        await reload(controller.signal, includeCatalog);
      } finally {
        running = false;
      }
    };
    void refresh(!catalogLoaded.current);
    const refreshAll = () => void refresh();
    const timer = window.setInterval(refreshAll, 15000);
    window.addEventListener("focus", refreshAll);
    window.addEventListener("online", refreshAll);
    document.addEventListener("visibilitychange", refreshAll);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshAll);
      window.removeEventListener("online", refreshAll);
      document.removeEventListener("visibilitychange", refreshAll);
    };
  }, [reload]);

  async function mutate(
    path: string,
    body: unknown,
    method = "POST",
    onError: (message: string) => void = setError,
  ) {
    setBusy(true);
    setError("");
    try {
      await api(path, body, method);
      await reload();
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setExpired(true);
      await reload();
      onError(e instanceof Error ? e.message : "No fue posible guardar.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const f = values(event);
    const started = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "start";
    setCreateError("");
    if (
      await mutate(
        "/api/services",
        {
          costCenterId:
            text(f, "costCenter") === UNDEFINED_COST_CENTER ? null : text(f, "costCenter"),
          serviceAddress: text(f, "address"),
          actionPerformed: text(f, "activity"),
          vehicleId: text(f, "vehicle") || null,
          ...(admin ? { driverId: text(f, "driver") || null } : {}),
          startNow: started,
        },
        "POST",
        setCreateError,
      )
    ) {
      form.reset();
      setCreateRevision((r) => r + 1);
      if (!started) {
        setStatus("");
        setPage(1);
        setTab("services");
      }
    }
  }
  async function exportFile(event: FormEvent<HTMLFormElement>) {
    const f = values(event);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        API_URL + `/api/exports/daily?from=${text(f, "from")}&to=${text(f, "to")}`,
        { credentials: "include" },
      );
      if (!response.ok) {
        if (response.status === 401) setExpired(true);
        throw new Error(
          "No fue posible exportar. Revisa el período (máximo 366 días) y tu sesión.",
        );
      }
      const { downloadDailyExcel } = await import("../xlsx-export");
      downloadDailyExcel(await response.json(), `pulso-${text(f, "from")}-${text(f, "to")}.xlsx`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al exportar.");
    } finally {
      setBusy(false);
    }
  }

  const navigation: { key: typeof tab; label: string; short: string; icon: IconName }[] = admin
    ? [
        { key: "services", label: "Servicios", short: "Servicios", icon: "route" },
        { key: "start", label: "Nuevo servicio", short: "Nuevo", icon: "plus" },
        { key: "vehicles", label: "Vehículos", short: "Flota", icon: "car" },
        { key: "costs", label: "Centros de costos", short: "Costos", icon: "chart" },
        { key: "accounts", label: "Cuentas", short: "Cuentas", icon: "people" },
      ]
    : [
        { key: "start", label: "Iniciar servicio", short: "Iniciar servicio", icon: "plus" },
        { key: "services", label: "Mis servicios", short: "Mis servicios", icon: "route" },
      ];
  const pageTitle =
    tab === "history"
      ? profile?.kind === "vehicle"
        ? "Ficha del vehículo"
        : "Ficha del chofer"
      : tab === "start"
        ? !admin && activeServices.length
          ? "Tu viaje en curso"
          : "Nuevo servicio"
        : tab === "services"
          ? admin
            ? "Servicios"
            : "Mis servicios"
          : tab === "vehicles"
            ? "Vehículos"
            : tab === "accounts"
              ? "Cuentas"
              : "Centros de costos";
  const availableVehicles = vehicles.filter((v) => v.active && !v.inService).length;
  const availableDrivers = drivers.filter((d) => !d.serviceLegs.length).length;
  return (
    <main className={"driver-page ops-dashboard " + (admin ? "ops-admin" : "ops-driver")}>
      <a className="ops-skip-link" href="#workspace-content">
        Ir al contenido
      </a>
      {!admin && (
        <AddressChangeAlerts
          key={user.id}
          userId={user.id}
          services={[...activeServices, ...upcomingServices, ...entries]}
        />
      )}
      <header className="driver-header">
        <div className="driver-header-inner">
          <div className="driver-brand">
            <PulsoMark size="small" />
            <div>
              <strong>Pulso</strong>
              <span>Movilización institucional</span>
            </div>
          </div>
          <span className="ops-header-institution">{user.establishmentName ?? "Movilización"}</span>
          <div className="ops-header-controls">
            <button
              className="ops-icon-button ops-refresh"
              onClick={() => void reload()}
              disabled={busy}
              aria-label="Actualizar"
              title={updated ? "Última actualización: " + time(updated) : "Actualizar"}
            >
              <Icon name="refresh" />
            </button>
            <ThemeToggle />
            <ProfileMenu
              name={user.fullName}
              role={admin ? "Administración" : "Chofer"}
              onLogout={onLogout}
              logoutLoading={logoutLoading}
            />
          </div>
        </div>
      </header>
      <aside
        className="ops-navigation-row"
        aria-label={admin ? "Navegación administrativa" : "Navegación del chofer"}
      >
        {admin && <p className="ops-nav-eyebrow">ESPACIO DE TRABAJO</p>}
        <fieldset
          className="ops-workspace ops-navigation-sections"
          disabled={busy || expired || !updated}
        >
          <nav className="ops-tabs ops-main-nav" aria-label="Secciones del panel">
            {navigation.map((item) => (
              <button
                key={item.key}
                aria-pressed={
                  tab === item.key ||
                  (tab === "history" &&
                    item.key === (profile?.kind === "vehicle" ? "vehicles" : "services"))
                }
                onClick={() => {
                  setTab(item.key);
                  window.scrollTo({ top: 0 });
                }}
              >
                <Icon name={item.icon} />
                <span className="ops-nav-label">{item.label}</span>
                <span className="ops-nav-short">{item.short}</span>
                {item.key === "services" && activeServices.length > 0 && (
                  <span className="ops-nav-count" aria-label={activeServices.length + " en curso"}>
                    {activeServices.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </fieldset>
        {admin && (
          <div className="ops-sidebar-footer">
            <span className="ops-sidebar-symbol">
              <Icon name="activity" />
            </span>
            <p>
              Al servicio de
              <br />
              <strong>cada recorrido.</strong>
            </p>
          </div>
        )}
      </aside>
      <section className="ops-content" id="workspace-content" tabIndex={-1}>
        <div className="ops-page-heading">
          <div>
            <p className="ops-eyebrow">
              {admin ? "CONTROL DE MOVILIZACIÓN" : (user.establishmentName ?? "MOVILIZACIÓN")}
            </p>
            <h1>
              {pageTitle}
              <span>.</span>
            </h1>
          </div>
          <div className="ops-heading-actions">
            <span className="ops-connection" data-offline={!!pollError}>
              <i />
              {!updated ? "Conectando" : pollError ? "Sin conexión" : "Al día"}
            </span>
            {admin && tab === "services" && (
              <button className="ops-primary-action" onClick={() => setTab("start")}>
                <Icon name="plus" />
                Nuevo servicio
              </button>
            )}
          </div>
        </div>
        {!updated && (
          <p className="ops-sync" role="status">
            Cargando tu espacio de trabajo…
          </p>
        )}
        {(error || pollError) && (
          <div className="driver-error" role="alert">
            {error || pollError}
            {pollError && " Los datos pueden estar desactualizados."}
          </div>
        )}
        {expired && (
          <div className="driver-error" role="alert">
            Tu sesión terminó. <button onClick={() => void onLogout()}>Volver al acceso</button>
          </div>
        )}
        {admin && updated && (tab === "services" || tab === "start") && (
          <div className="ops-overview" aria-label="Disponibilidad actual">
            <div>
              <span>
                <Icon name="activity" />
                En curso
              </span>
              <strong>
                {activeServices.length}
                <small>servicios</small>
              </strong>
            </div>
            <div>
              <span>
                <Icon name="car" />
                Vehículos disponibles
              </span>
              <strong>
                {availableVehicles}
                <small>de {vehicles.filter((v) => v.active).length}</small>
              </strong>
            </div>
            <div>
              <span>
                <Icon name="people" />
                Choferes disponibles
              </span>
              <strong>
                {availableDrivers}
                <small>de {drivers.length}</small>
              </strong>
            </div>
          </div>
        )}
        {admin &&
          updated &&
          tab === "services" &&
          (drivers.length === 0 || vehicles.length === 0) && (
            <section className="ops-card ops-onboarding" aria-label="Primeros pasos">
              <h2>Primeros pasos</h2>
              <p>Para coordinar servicios, la institución necesita choferes y vehículos.</p>
              <div className="ops-actions">
                {drivers.length === 0 && (
                  <button
                    className="ops-primary-action"
                    onClick={() => {
                      setTab("accounts");
                      window.scrollTo({ top: 0 });
                    }}
                  >
                    <Icon name="people" />
                    Crear cuentas de choferes
                  </button>
                )}
                {vehicles.length === 0 && (
                  <button
                    onClick={() => {
                      setTab("vehicles");
                      window.scrollTo({ top: 0 });
                    }}
                  >
                    <Icon name="car" />
                    Registrar vehículos
                  </button>
                )}
              </div>
            </section>
          )}
        <fieldset className="ops-workspace" disabled={busy || expired || !updated}>
          {admin && profile && tab === "history" && (
            <button
              className="ops-profile-back"
              onClick={() => {
                setProfile(null);
                setTab(profile.kind === "vehicle" ? "vehicles" : "services");
              }}
            >
              ← Volver a {profile.kind === "vehicle" ? "vehículos" : "servicios"}
            </button>
          )}
          {tab === "accounts" && admin ? (
            <AccountsPanel onChanged={() => void reload()} onExpired={markExpired} />
          ) : tab === "costs" && admin ? (
            <CostCenterReport />
          ) : tab === "history" && admin && profile ? (
            <ProfileHistory
              costCenters={costCenters}
              key={profile.kind + profile.id}
              profile={profile}
              vehicles={vehicles}
              drivers={drivers}
              mutate={mutate}
              onProfile={openProfile}
            />
          ) : tab === "vehicles" && admin ? (
            <VehiclePanel vehicles={vehicles} mutate={mutate} onProfile={openProfile} />
          ) : (
            <>
              <section hidden={tab !== "start"} className="ops-start-workspace">
                {!admin && activeServices.length > 0 && (
                  <>
                    <p className="ops-section-note">Registra los kilómetros al llegar.</p>
                    {activeServices.map((entry) => (
                      <ServiceCard
                        costCenters={costCenters}
                        key={entry.id}
                        entry={entry}
                        admin={false}
                        viewerId={user.id}
                        vehicles={vehicles}
                        drivers={drivers}
                        mutate={mutate}
                      />
                    ))}
                  </>
                )}
                {!admin && upcomingServices.length > 0 && (
                  <section aria-label="Viajes pendientes">
                    <h2 className="ops-section-heading">
                      <Icon name="clock" />
                      Por iniciar<span>{upcomingServices.length}</span>
                    </h2>
                    <div className="ops-services">
                      {upcomingServices.map((entry) => (
                        <ServiceCard
                          costCenters={costCenters}
                          key={entry.id}
                          entry={entry}
                          admin={false}
                          viewerId={user.id}
                          vehicles={vehicles}
                          drivers={drivers}
                          mutate={mutate}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {(admin || activeServices.length === 0) && (
                  <section className="ops-card ops-start-card">
                    <div className="ops-form-heading">
                      <span className="ops-form-symbol">
                        <Icon name="route" />
                      </span>
                      <div>
                        <h2>Datos del traslado</h2>
                        <p>
                          {admin
                            ? "Asigna los recursos para coordinar el servicio."
                            : "Ingresa los datos del nuevo servicio."}
                        </p>
                      </div>
                    </div>
                    <form
                      onSubmit={(e) => void create(e)}
                      onChange={() => setCreateError("")}
                      className="ops-form"
                    >
                      <AddressField key={`address-${createRevision}`} wide />
                      {admin && (
                        <label>
                          Chofer
                          <select name="driver">
                            <option value="">Sin asignar</option>
                            {driverOptions(drivers)}
                          </select>
                        </label>
                      )}
                      <label>
                        Vehículo
                        <select name="vehicle">
                          <option value="">Seleccionar vehículo</option>
                          {vehicleOptions(vehicles)}
                        </select>
                      </label>
                      <CostCenterField key={createRevision} centers={costCenters} />
                      <label className="ops-field-wide">
                        Actividad
                        <textarea
                          name="activity"
                          placeholder="¿Qué se realizará en este servicio?"
                          minLength={2}
                          maxLength={250}
                          required
                        />
                      </label>
                      {createError && (
                        <p className="driver-error" role="alert">
                          {createError}
                        </p>
                      )}
                      <div className="ops-actions">
                        {!admin && (
                          <button type="submit" className="ops-start-button" value="start">
                            Iniciar viaje
                            <Icon name="arrow" />
                          </button>
                        )}
                        <button
                          type="submit"
                          value="save"
                          className={admin ? "ops-primary-action" : "ops-secondary-action"}
                        >
                          {admin ? "Guardar servicio" : "Guardar para después"}
                          {admin && <Icon name="check" />}
                        </button>
                      </div>
                    </form>
                  </section>
                )}
              </section>
              <section hidden={tab !== "services"}>
                <div className="ops-service-utilities">
                  {admin && (
                    <details className="ops-card">
                      <summary className="ops-disclosure-heading">
                        <span>
                          <Icon name="people" />
                          Disponibilidad de choferes
                        </span>
                        <Icon name="chevron" />
                      </summary>
                      <div className="ops-team">
                        {drivers.map((d) => (
                          <div key={d.id}>
                            <button
                              className="ops-entity-link"
                              onClick={() =>
                                openProfile({ kind: "driver", id: d.id, name: d.fullName })
                              }
                            >
                              {d.fullName}
                            </button>
                            <span
                              className={d.serviceLegs.length ? "ops-badge active" : "ops-badge"}
                            >
                              {d.serviceLegs.length ? "En servicio" : "Disponible"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  {admin && (
                    <details className="ops-card ops-export-disclosure">
                      <summary className="ops-disclosure-heading">
                        <span>
                          <Icon name="download" />
                          Descargar servicios finalizados
                        </span>
                        <Icon name="chevron" />
                      </summary>
                      <form className="ops-export" onSubmit={(e) => void exportFile(e)}>
                        <label>
                          Desde
                          <input type="date" name="from" defaultValue={today()} required />
                        </label>
                        <label>
                          Hasta
                          <input type="date" name="to" defaultValue={today()} required />
                        </label>
                        <button className="ops-primary-action">
                          <Icon name="download" />
                          Exportar Excel
                        </button>
                      </form>
                    </details>
                  )}
                </div>
                <div className="ops-filter">
                  <StatusFilterBar
                    value={status}
                    label="Filtrar servicios por estado"
                    onChange={(value, animate) => {
                      setFilterMotion(animate);
                      setStatus(value);
                      setPage(1);
                    }}
                  />
                  <span role="status" aria-live="polite">
                    {filtering ? (
                      "Actualizando servicios…"
                    ) : currentResults ? (
                      <>
                        {total} {total === 1 ? "servicio" : "servicios"}
                        {!admin && activeServices.length > 0 && " · Incluye tu viaje activo"}
                      </>
                    ) : (
                      "No se pudo actualizar"
                    )}
                  </span>
                </div>
                <div
                  className="ops-filter-results"
                  aria-busy={filtering}
                  data-loading={filtering}
                  data-instant={!filterMotion}
                  inert={filtering || !currentResults}
                >
                  <div className={admin ? "ops-services ops-services-compact" : "ops-services"}>
                    {entries.map((entry) =>
                      admin ? (
                        <ServiceDisclosure
                          key={entry.id}
                          entry={entry}
                          subtitle={serviceSubtitle(entry)}
                        >
                          <ServiceCard
                            costCenters={costCenters}
                            entry={entry}
                            admin
                            vehicles={vehicles}
                            drivers={drivers}
                            mutate={mutate}
                            onProfile={openProfile}
                          />
                        </ServiceDisclosure>
                      ) : (
                        <ServiceCard
                          costCenters={costCenters}
                          key={entry.id}
                          entry={entry}
                          admin={false}
                          viewerId={user.id}
                          vehicles={vehicles}
                          drivers={drivers}
                          mutate={mutate}
                          onProfile={openProfile}
                        />
                      ),
                    )}
                  </div>
                  {updated && currentResults && !entries.length && (
                    <div className="ops-empty">
                      <span className="ops-empty-symbol">
                        <Icon name="route" />
                      </span>
                      <h2>Todo despejado por aquí</h2>
                      <p>No hay servicios con este estado.</p>
                    </div>
                  )}
                  {(total > 30 || page > 1) && (
                    <div className="ops-pagination">
                      <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                        Anterior
                      </button>
                      <span>Página {page}</span>
                      <button disabled={page * 30 >= total} onClick={() => setPage((p) => p + 1)}>
                        Siguiente
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </fieldset>
      </section>
    </main>
  );
}
