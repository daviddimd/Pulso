import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import "./App.css";
import { Icon } from "./components/Icon";
import { setInstitutionTimezone } from "./institution";
import { createSessionLoader } from "./session";

import { PulsoMark } from "./components/PulsoMark";
import { ThemeToggle } from "./components/ThemeToggle";
import { DriverDashboard } from "./components/DriverDashboard";
import { AdminDashboard } from "./components/AdminDashboard";

type BaseUser = {
  id: string;
  username: string;
  fullName: string;
  establishmentName?: string;
  establishmentTimezone: string;
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
  "";

const loadSession = createSessionLoader<{ user: AuthenticatedUser | null }>(`${API_URL}/api/auth/session`);

function App() {
  const [claveUnicaEnabled, setClaveUnicaEnabled] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/api/auth/options`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => setClaveUnicaEnabled(data?.claveUnicaEnabled === true))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  async function loginClaveUnica() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/auth/clave-unica`, { credentials: 'include' });
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      const destination = new URL(data.url);
      if (destination.origin !== 'https://accounts.claveunica.gob.cl' || destination.pathname !== '/openid/authorize/') throw new Error('Invalid redirect');
      window.location.assign(destination.href);
    } catch {
      setError('ClaveÚnica no está disponible. Intenta nuevamente o utiliza tu usuario de Pulso.');
      setLoading(false);
    }
  }
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
    let active = true;
    async function restoreSession() {
      try {
        const data = await loadSession();
        if (active && data.user) {
          setInstitutionTimezone(data.user.establishmentTimezone);
          setUser(data.user);
        }
      } catch {
        // Si el backend no está disponible,
        // se muestra el login.
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    void restoreSession();
    return () => { active = false; };
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

      setInstitutionTimezone(data.user.establishmentTimezone);
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
      <section className="login-panel" aria-labelledby="login-title">
        <header className="login-header"><div className="brand"><PulsoMark size="small" /><strong>Pulso<span>Oficina de Movilización</span></strong></div><ThemeToggle /></header>
        <div className="login-content">
          <div className="login-heading"><h1 id="login-title">Acceso al sistema</h1><p>Ingresa con las credenciales asignadas por administración.</p></div>
          <form className="login-form" onSubmit={handleSubmit}>
            <label>Usuario<input type="text" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Tu nombre de usuario" value={username} onChange={event=>setUsername(event.target.value)} disabled={loading} required /></label>
            <label>Contraseña<input type="password" name="password" autoComplete="current-password" placeholder="Tu contraseña" value={password} onChange={event=>setPassword(event.target.value)} disabled={loading} required /></label>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button type="submit" disabled={loading}>{loading ? "Ingresando…" : "Ingresar"}</button>
            {claveUnicaEnabled && <button className="login-clave" type="button" onClick={()=>void loginClaveUnica()} disabled={loading}>Iniciar sesión con ClaveÚnica<Icon name="shield" /></button>}
          </form>
        </div>
        <footer className="login-footer d-flex align-items-center justify-content-center gap-2"><span>Acceso restringido</span><span aria-hidden="true">·</span><span>Personal autorizado</span></footer>
      </section>
      <section className="login-visual" aria-label="Oficina de Movilización">
        <svg className="login-pulse" viewBox="0 0 900 240" aria-hidden="true"><path d="M0 125H190C210 125 218 101 232 101C246 101 254 125 272 125H310L334 158L369 48L402 145L424 125H470C490 125 499 94 518 94C537 94 545 125 568 125H900" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <div className="login-institution"><PulsoMark size="small" /><div><strong>Oficina de Movilización</strong><span>Sistema de gestión de vehículos de apoyo</span></div></div>
      </section>
    </main>
  );
}

export default App;
