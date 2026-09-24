import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import "./App.css";

import { PulsoMark } from "./components/PulsoMark";
import { DriverDashboard } from "./components/DriverDashboard";
import { AdminDashboard } from "./components/AdminDashboard";

type BaseUser = {
  id: string;
  username: string;
  fullName: string;
};

type AuthenticatedUser =
  | (BaseUser & {
      role: "DRIVER";
    })
  | (BaseUser & {
      role: "ADMIN";
    });

const API_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000";

function App() {
  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [user, setUser] =
    useState<AuthenticatedUser | null>(
      null,
    );

  const [error, setError] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [
    checkingSession,
    setCheckingSession,
  ] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      try {
        const response = await fetch(
          `${API_URL}/api/auth/me`,
          {
            method: "GET",
            credentials: "include",
          },
        );

        if (!response.ok) {
          return;
        }

        const data =
          (await response.json()) as {
            user: AuthenticatedUser;
          };

        setUser(data.user);
      } catch {
        // Si el backend no está disponible,
        // se muestra el login.
      } finally {
        setCheckingSession(false);
      }
    }

    void restoreSession();
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/auth/login`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials: "include",

          body: JSON.stringify({
            username,
            password,
          }),
        },
      );

      if (!response.ok) {
        if (response.status === 423) {
          setError(
            "La cuenta está temporalmente bloqueada. Intenta nuevamente más tarde.",
          );

          return;
        }

        if (response.status === 401) {
          setError(
            "Usuario o contraseña incorrectos.",
          );

          return;
        }

        setError(
          "No fue posible iniciar sesión.",
        );

        return;
      }

      const data =
        (await response.json()) as {
          user: AuthenticatedUser;
        };

      setUser(data.user);
      setPassword("");
    } catch {
      setError(
        "No fue posible conectar con Pulso. Verifica que el servidor esté disponible.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);

    try {
      await fetch(
        `${API_URL}/api/auth/logout`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials: "include",

          body: JSON.stringify({}),
        },
      );
    } finally {
      setUser(null);
      setUsername("");
      setPassword("");
      setError(null);
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="session-loading">
        <PulsoMark size="large" />
        <p>Cargando Pulso...</p>
      </main>
    );
  }

  if (
    user &&
    user.role === "DRIVER"
  ) {
    return (
      <DriverDashboard
        user={user}
        onLogout={handleLogout}
        logoutLoading={loading}
      />
    );
  }

  if (
    user &&
    user.role === "ADMIN"
  ) {
    return (
      <AdminDashboard
        user={user}
        onLogout={handleLogout}
        logoutLoading={loading}
      />
    );
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-main">
          <div className="brand">
            <PulsoMark size="large" />

            <div>
              <h1>Pulso</h1>
              <p>Bitácora vehicular</p>
            </div>
          </div>

          <div className="login-content">
            <div className="login-heading">
              <span className="login-eyebrow">
                Acceso al sistema
              </span>

              <h2>Bienvenido</h2>

              <p>
                Ingresa con las credenciales
                asignadas por administración.
              </p>
            </div>

            <form
              className="login-form"
              onSubmit={handleSubmit}
            >
              <label>
                Usuario

                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  placeholder="Ej. chofer01"
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      event.target.value,
                    )
                  }
                  disabled={loading}
                  required
                />
              </label>

              <label>
                Contraseña

                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                  disabled={loading}
                  required
                />
              </label>

              {error && (
                <div
                  className="login-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Ingresando..."
                  : "Ingresar a Pulso"}
              </button>
            </form>
          </div>
        </div>

        <div className="login-footer">
          <span>
            Acceso restringido
          </span>

          <span aria-hidden="true">
            ·
          </span>

          <span>
            Personal autorizado
          </span>
        </div>
      </section>

      <section className="visual-panel">
        <svg
          className="visual-pulse"
          viewBox="0 0 900 240"
          aria-hidden="true"
        >
          <path
            d="
              M0 125
              H190
              C210 125 218 101 232 101
              C246 101 254 125 272 125
              H310
              L334 158
              L369 48
              L402 145
              L424 125
              H470
              C490 125 499 94 518 94
              C537 94 545 125 568 125
              H900
            "
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="institutional-signature">
          <PulsoMark size="small" />

          <div>
            <strong>
              Hospital Regional de Talca
            </strong>

            <span>
              Sistema interno de la Oficina
              de Movilización
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;