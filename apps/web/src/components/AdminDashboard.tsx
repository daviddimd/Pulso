import {
  useEffect,
  useMemo,
  useState,
} from "react";

type User = {
  id: string;
  username: string;
  fullName: string;
  role: "ADMIN";
};

type AdminEntry = {
  id: string;
  status:
    | "OPEN"
    | "COMPLETED"
    | "VOIDED";

  startedAt: string;
  endedAt: string | null;
  serviceAddress: string;
  actionPerformed: string;
  odometerKm: number | null;

  vehicle: {
    roleCode: string;
    licensePlate: string;
  };
};

type DriverOverview = {
  id: string;
  username: string;
  fullName: string;
  bitacoras: AdminEntry[];
};

type Props = {
  user: User;
  onLogout: () => Promise<void>;
  logoutLoading: boolean;
};

const API_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000";

function getChileDate(): string {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "America/Santiago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(new Date());

  const year =
    parts.find(
      (part) =>
        part.type === "year",
    )?.value ?? "";

  const month =
    parts.find(
      (part) =>
        part.type === "month",
    )?.value ?? "";

  const day =
    parts.find(
      (part) =>
        part.type === "day",
    )?.value ?? "";

  return `${year}-${month}-${day}`;
}

function formatTime(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "es-CL",
    {
      timeZone:
        "America/Santiago",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(value));
}

export function AdminDashboard({
  user,
  onLogout,
  logoutLoading,
}: Props) {
  const [date, setDate] =
    useState(getChileDate());

  const [drivers, setDrivers] =
    useState<DriverOverview[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    exporting,
    setExporting,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function loadOverview() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/admin/overview?date=${encodeURIComponent(
          date,
        )}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error();
      }

      const data =
        (await response.json()) as {
          drivers?: DriverOverview[];
          overview?: DriverOverview[];
        };

      const receivedDrivers =
        data.drivers ??
        data.overview;

      if (!receivedDrivers) {
        throw new Error();
      }

      setDrivers(
        receivedDrivers,
      );
    } catch {
      setError(
        "No fue posible cargar el panel administrativo.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/exports/daily?date=${encodeURIComponent(
          date,
        )}`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      if (!response.ok) {
        if (
          response.status === 400
        ) {
          setError(
            "La fecha seleccionada no es válida para exportar.",
          );

          return;
        }

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          setError(
            "Tu sesión no tiene autorización para exportar.",
          );

          return;
        }

        setError(
          "No fue posible generar el archivo Excel.",
        );

        return;
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        `pulso-bitacora-${date}.xlsx`;

      document.body.appendChild(
        link,
      );

      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch {
      setError(
        "No fue posible conectar con Pulso para generar el Excel.",
      );
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, [date]);

  const totals = useMemo(() => {
    const entries =
      drivers.flatMap(
        (driver) =>
          driver.bitacoras,
      );

    return {
      drivers:
        drivers.length,

      total:
        entries.length,

      active:
        entries.filter(
          (entry) =>
            entry.status ===
            "OPEN",
        ).length,

      completed:
        entries.filter(
          (entry) =>
            entry.status ===
            "COMPLETED",
        ).length,
    };
  }, [drivers]);

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div className="driver-brand">
          <div className="brand-mark">
            P
          </div>

          <div>
            <strong>
              Pulso
            </strong>

            <span>
              Administración
            </span>
          </div>
        </div>

        <div className="driver-user">
          <div>
            <strong>
              {user.fullName}
            </strong>

            <span>
              Administrador
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              void onLogout()
            }
            disabled={
              logoutLoading
            }
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <section className="admin-content">
        <div className="admin-title-row">
          <div>
            <span className="section-eyebrow">
              Control operacional
            </span>

            <h1>
              Panel administrativo
            </h1>

            <p>
              Estado diario del equipo
              de transporte.
            </p>
          </div>

          <div className="admin-controls">
            <label>
              Fecha

              <input
                type="date"
                value={date}
                onChange={(
                  event,
                ) =>
                  setDate(
                    event.target
                      .value,
                  )
                }
                disabled={
                  exporting
                }
              />
            </label>

            <button
              type="button"
              onClick={() =>
                void loadOverview()
              }
              disabled={
                loading ||
                exporting
              }
            >
              {loading
                ? "Actualizando..."
                : "Actualizar"}
            </button>

            <button
              className="admin-export-button"
              type="button"
              onClick={() =>
                void handleExport()
              }
              disabled={
                exporting ||
                !date
              }
            >
              {exporting
                ? "Exportando..."
                : "Exportar Excel"}
            </button>
          </div>
        </div>

        {error && (
          <div
            className="driver-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <section className="admin-summary">
          <article>
            <span>
              Choferes
            </span>

            <strong>
              {totals.drivers}
            </strong>
          </article>

          <article>
            <span>
              Servicios del día
            </span>

            <strong>
              {totals.total}
            </strong>
          </article>

          <article>
            <span>
              En curso
            </span>

            <strong>
              {totals.active}
            </strong>
          </article>

          <article>
            <span>
              Finalizados
            </span>

            <strong>
              {totals.completed}
            </strong>
          </article>
        </section>

        <section className="admin-table-card">
          <div className="admin-table-heading">
            <div>
              <h2>
                Estado de choferes
              </h2>

              <p>
                Información
                correspondiente a la
                fecha seleccionada.
              </p>
            </div>

            {loading && (
              <span>
                Actualizando...
              </span>
            )}
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>
                    Chofer
                  </th>

                  <th>
                    Estado
                  </th>

                  <th>
                    Vehículo
                  </th>

                  <th>
                    Salida
                  </th>

                  <th>
                    Dirección / lugar
                  </th>

                  <th>
                    Acción
                  </th>

                  <th>
                    Km
                  </th>
                </tr>
              </thead>

              <tbody>
                {drivers.map(
                  (driver) => {
                    const openEntry =
                      driver.bitacoras.find(
                        (
                          entry,
                        ) =>
                          entry.status ===
                          "OPEN",
                      );

                    const latestEntry =
                      openEntry ??
                      driver
                        .bitacoras[0] ??
                      null;

                    return (
                      <tr
                        key={
                          driver.id
                        }
                      >
                        <td>
                          <div className="admin-driver">
                            <strong>
                              {
                                driver.fullName
                              }
                            </strong>

                            <span>
                              {
                                driver.username
                              }
                            </span>
                          </div>
                        </td>

                        <td>
                          {openEntry ? (
                            <span className="admin-status active">
                              <span />

                              En servicio
                            </span>
                          ) : (
                            <span className="admin-status available">
                              Disponible
                            </span>
                          )}
                        </td>

                        <td>
                          {latestEntry
                            ? `Rol ${latestEntry.vehicle.roleCode} · ${latestEntry.vehicle.licensePlate}`
                            : "—"}
                        </td>

                        <td>
                          {latestEntry
                            ? formatTime(
                                latestEntry.startedAt,
                              )
                            : "—"}
                        </td>

                        <td>
                          {latestEntry
                            ?.serviceAddress ??
                            "—"}
                        </td>

                        <td>
                          {latestEntry
                            ?.actionPerformed ??
                            "—"}
                        </td>

                        <td>
                          {latestEntry
                            ?.odometerKm !==
                              null &&
                          latestEntry
                            ?.odometerKm !==
                              undefined
                            ? latestEntry.odometerKm.toLocaleString(
                                "es-CL",
                              )
                            : "—"}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}