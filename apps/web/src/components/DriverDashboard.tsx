import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import { PulsoMark } from "./PulsoMark";

type User = {
  id: string;
  username: string;
  fullName: string;
  role: "DRIVER";
};

type Vehicle = {
  id: string;
  roleCode: string;
  licensePlate: string;
  currentOdometerKm: number | null;
};

type BitacoraEntry = {
  id: string;
  status: "OPEN" | "COMPLETED" | "VOIDED";
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

type Props = {
  user: User;
  onLogout: () => Promise<void>;
  logoutLoading: boolean;
};

const API_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000";

function formatTime(value: string) {
  return new Intl.DateTimeFormat(
    "es-CL",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(value));
}

export function DriverDashboard({
  user,
  onLogout,
  logoutLoading,
}: Props) {
  const [vehicles, setVehicles] =
    useState<Vehicle[]>([]);

  const [openEntry, setOpenEntry] =
    useState<BitacoraEntry | null>(null);

  const [vehicleId, setVehicleId] =
    useState("");

  const [
    serviceAddress,
    setServiceAddress,
  ] = useState("");

  const [
    actionPerformed,
    setActionPerformed,
  ] = useState("");

  const [odometerKm, setOdometerKm] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const selectedVehicle =
    vehicles.find(
      (vehicle) =>
        vehicle.id === vehicleId,
    ) ?? null;

  async function loadDriverData() {
    setError(null);

    try {
      const [
        vehiclesResponse,
        mineResponse,
      ] = await Promise.all([
        fetch(
          `${API_URL}/api/vehicles`,
          {
            credentials: "include",
          },
        ),

        fetch(
          `${API_URL}/api/bitacoras/mine`,
          {
            credentials: "include",
          },
        ),
      ]);

      if (
        !vehiclesResponse.ok ||
        !mineResponse.ok
      ) {
        throw new Error();
      }

      const vehiclesData =
        (await vehiclesResponse.json()) as {
          vehicles: Vehicle[];
        };

      const mineData =
        (await mineResponse.json()) as {
          entries: BitacoraEntry[];
        };

      setVehicles(
        vehiclesData.vehicles,
      );

      const currentOpen =
        mineData.entries.find(
          (entry) =>
            entry.status === "OPEN",
        ) ?? null;

      setOpenEntry(currentOpen);
    } catch {
      setError(
        "No fue posible cargar la información operacional.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDriverData();
  }, []);

  async function handleStart(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(
        `${API_URL}/api/bitacoras`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials: "include",

          body: JSON.stringify({
            vehicleId,
            serviceAddress,
            actionPerformed,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        if (
          data.error ===
          "EL_CHOFER_YA_COMENZO_EL_SERVICIO"
        ) {
          setError(
            "Ya tienes un servicio activo.",
          );

          await loadDriverData();
          return;
        }

        if (
          data.error ===
          "EL_VEHICULO_YA_ESTA_EN_USO"
        ) {
          setError(
            "La ambulancia seleccionada ya está en uso.",
          );

          await loadDriverData();
          return;
        }

        setError(
          "No fue posible iniciar el servicio.",
        );

        return;
      }

      setOpenEntry(
        data.entry as BitacoraEntry,
      );

      setVehicleId("");
      setServiceAddress("");
      setActionPerformed("");
    } catch {
      setError(
        "No fue posible conectar con Pulso.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinalize(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!openEntry) {
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const parsedOdometer =
        Number(odometerKm);

      const response = await fetch(
        `${API_URL}/api/bitacoras/${openEntry.id}/finalize`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials: "include",

          body: JSON.stringify({
            odometerKm:
              parsedOdometer,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        if (
          data.error ===
          "ODOMETER_BELOW_CURRENT"
        ) {
          setError(
            `El kilometraje no puede ser menor a ${data.currentOdometerKm} km.`,
          );

          return;
        }

        setError(
          "No fue posible finalizar el servicio.",
        );

        return;
      }

      setOpenEntry(null);
      setOdometerKm("");

      await loadDriverData();
    } catch {
      setError(
        "No fue posible conectar con Pulso.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="driver-page">
        <div className="driver-loading">
          <PulsoMark size="medium" />

          <span>
            Cargando información operacional...
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="driver-page">
      <header className="driver-header">
        <div className="driver-header-inner">
          <div className="driver-brand">
            <PulsoMark size="small" />

            <div>
              <strong>Pulso</strong>

              <span>
                Oficina de Movilización
              </span>
            </div>
          </div>

          <div className="driver-user">
            <div className="driver-user-copy">
              <strong>
                {user.fullName}
              </strong>

              <span>Chofer</span>
            </div>

            <button
              className="driver-logout-button"
              type="button"
              onClick={() =>
                void onLogout()
              }
              disabled={logoutLoading}
              aria-label="Cerrar sesión"
            >
              <span>
                Cerrar sesión
              </span>

              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M10 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />

                <path
                  d="M14.5 8.5 18 12l-3.5 3.5M9 12h8.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <section className="driver-content">
        <div className="driver-intro">
          <span className="section-eyebrow">
            Operación diaria
          </span>

          <h1>
            {openEntry
              ? "Servicio en curso"
              : "Nuevo servicio"}
          </h1>

          <p>
            {openEntry
              ? "Completa el servicio cuando regreses registrando el kilometraje final."
              : "Registra los datos esenciales antes de iniciar el traslado."}
          </p>
        </div>

        {error && (
          <div
            className="driver-error"
            role="alert"
          >
            <span>!</span>

            <p>{error}</p>
          </div>
        )}

        {openEntry ? (
          <section className="active-service-card">
            <div className="active-service-hero">
              <div className="service-status">
                <span className="status-dot" />

                Servicio activo
              </div>

              <div className="active-service-heading">
                <div>
                  <span>Ambulancia</span>

                  <h2>
                    Rol{" "}
                    {
                      openEntry.vehicle
                        .roleCode
                    }
                  </h2>

                  <p>
                    {
                      openEntry.vehicle
                        .licensePlate
                    }
                  </p>
                </div>

                <div className="service-start-time">
                  <span>Salida</span>

                  <strong>
                    {formatTime(
                      openEntry.startedAt,
                    )}
                  </strong>
                </div>
              </div>
            </div>

            <div className="service-details">
              <div className="service-detail">
                <span>
                  Dirección / lugar
                </span>

                <strong>
                  {
                    openEntry.serviceAddress
                  }
                </strong>
              </div>

              <div className="service-detail">
                <span>
                  Acción realizada
                </span>

                <strong>
                  {
                    openEntry.actionPerformed
                  }
                </strong>
              </div>
            </div>

            <form
              className="finalize-form"
              onSubmit={handleFinalize}
            >
              <div className="finalize-heading">
                <span>
                  Finalizar servicio
                </span>

                <h3>
                  Kilometraje de llegada
                </h3>

                <p>
                  Ingresa el valor actual
                  indicado por la ambulancia.
                </p>
              </div>

              <label>
                <span>
                  Kilometraje actual
                </span>

                <div className="odometer-input">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={odometerKm}
                    onChange={(event) =>
                      setOdometerKm(
                        event.target.value,
                      )
                    }
                    placeholder="Ej. 124538"
                    required
                    disabled={
                      submitting
                    }
                  />

                  <span>km</span>
                </div>
              </label>

              <button
                type="submit"
                disabled={submitting}
              >
                {submitting
                  ? "Finalizando..."
                  : "Finalizar servicio"}
              </button>
            </form>
          </section>
        ) : (
          <form
            className="start-service-card"
            onSubmit={handleStart}
          >
            <section className="service-form-section">
              <div className="service-form-heading">
                <span className="service-step">
                  1
                </span>

                <div>
                  <h2>
                    Selecciona la ambulancia
                  </h2>

                  <p>
                    Elige el vehículo que
                    utilizarás en este servicio.
                  </p>
                </div>
              </div>

              <label className="driver-field">
                <span>Ambulancia</span>

                <select
                  value={vehicleId}
                  onChange={(event) =>
                    setVehicleId(
                      event.target.value,
                    )
                  }
                  required
                  disabled={submitting}
                >
                  <option value="">
                    Selecciona un vehículo
                  </option>

                  {vehicles.map(
                    (vehicle) => (
                      <option
                        key={vehicle.id}
                        value={vehicle.id}
                      >
                        Rol{" "}
                        {
                          vehicle.roleCode
                        }{" "}
                        ·{" "}
                        {
                          vehicle.licensePlate
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              {selectedVehicle && (
                <div className="vehicle-preview">
                  <div>
                    <span>Rol</span>

                    <strong>
                      {
                        selectedVehicle.roleCode
                      }
                    </strong>
                  </div>

                  <div>
                    <span>Patente</span>

                    <strong>
                      {
                        selectedVehicle.licensePlate
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Kilometraje
                    </span>

                    <strong>
                      {selectedVehicle.currentOdometerKm !==
                      null
                        ? `${selectedVehicle.currentOdometerKm.toLocaleString(
                            "es-CL",
                          )} km`
                        : "Sin registro"}
                    </strong>
                  </div>
                </div>
              )}
            </section>

            <section className="service-form-section">
              <div className="service-form-heading">
                <span className="service-step">
                  2
                </span>

                <div>
                  <h2>
                    Datos del servicio
                  </h2>

                  <p>
                    Indica el destino y la
                    labor que realizarás.
                  </p>
                </div>
              </div>

              <div className="service-fields">
                <label className="driver-field">
                  <span>
                    Dirección / lugar del
                    servicio
                  </span>

                  <input
                    type="text"
                    value={
                      serviceAddress
                    }
                    onChange={(event) =>
                      setServiceAddress(
                        event.target.value,
                      )
                    }
                    placeholder="Ej. 2 Norte 1456, Talca"
                    maxLength={350}
                    required
                    disabled={
                      submitting
                    }
                  />
                </label>

                <label className="driver-field">
                  <span>
                    Acción realizada
                  </span>

                  <textarea
                    value={
                      actionPerformed
                    }
                    onChange={(event) =>
                      setActionPerformed(
                        event.target.value,
                      )
                    }
                    placeholder="Ej. Traslado de paciente"
                    maxLength={250}
                    required
                    disabled={
                      submitting
                    }
                  />
                </label>
              </div>
            </section>

            <div className="start-service-action">
              <button
                type="submit"
                disabled={submitting}
              >
                {submitting
                  ? "Iniciando..."
                  : "Iniciar servicio"}
              </button>

              <span>
                La hora de salida se
                registrará automáticamente.
              </span>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}