import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import "./App.css";
import { Icon } from "./components/Icon";
import { setInstitutionTimezone } from "./institution";

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

        setInstitutionTimezone(data.user.establishmentTimezone);
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
        <header className="login-header"><div className="brand"><PulsoMark size="small" /><strong>Pulso<span>Movilización institucional</span></strong></div><ThemeToggle /></header>
        <div className="login-content">
          <div className="login-heading"><span className="login-eyebrow"><span />TU ESPACIO DE TRABAJO</span><h1 id="login-title">Bienvenido a Pulso.</h1><p>Ingresa para continuar con tu jornada.</p></div>
          <form className="login-form" onSubmit={handleSubmit}>
            <label>Usuario<input type="text" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Tu nombre de usuario" value={username} onChange={event=>setUsername(event.target.value)} disabled={loading} required /></label>
            <label>Contraseña<input type="password" name="password" autoComplete="current-password" placeholder="Tu contraseña" value={password} onChange={event=>setPassword(event.target.value)} disabled={loading} required /></label>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button type="submit" disabled={loading}>{loading ? "Ingresando…" : "Ingresar"}<Icon name="arrow" /></button>
            {claveUnicaEnabled && <button className="login-clave" type="button" onClick={()=>void loginClaveUnica()} disabled={loading}>Iniciar sesión con ClaveÚnica<Icon name="shield" /></button>}
          </form>
          <p className="login-access-note"><Icon name="shield" />Acceso para personal autorizado</p>
        </div>
        <footer className="login-footer d-flex align-items-center justify-content-between gap-2"><span>Pulso · Gestión de movilización</span><span>Una jornada más simple.</span></footer>
      </section>
      <section className="login-visual" aria-label="Gestión de movilización">
        <span className="login-visual-label">CADA TRAYECTO CUENTA</span>
        <h2>Movilización,<br />bien coordinada.</h2>
        <p>Personas, vehículos y recorridos.<br />En un solo lugar.</p>
        <div className="login-route-art" aria-hidden="true">
          <svg className="login-route-line" viewBox="0 0 640 400" fill="none"><path d="M60 310h170c95 0 20-220 145-220h190" stroke="currentColor" strokeWidth="2" strokeDasharray="5 7"/><circle cx="60" cy="310" r="9" fill="currentColor"/><circle cx="565" cy="90" r="9" fill="currentColor"/><circle cx="565" cy="90" r="23" stroke="currentColor" opacity=".3"/></svg>
          <div className="login-art-stop login-art-start"><span className="login-art-icon"><Icon name="car" /></span><div><small>EL INICIO</small><strong>Todo listo para salir.</strong><span>Un vehículo. Un propósito.</span></div></div>
          <div className="login-art-stop login-art-end"><span className="login-art-icon"><Icon name="check" /></span><div><small>EL RECORRIDO</small><strong>Cada kilómetro, registrado.</strong><span>Información clara y ordenada.</span></div></div>
          <span className="login-art-coordinates">ORGANIZAR · ACOMPAÑAR · REGISTRAR</span>
        </div>
        <div className="login-visual-footer"><span className="login-visual-mark"><Icon name="activity" /></span><span>Una herramienta al servicio<br />de quienes están en movimiento.</span></div>
      </section>
    </main>
  );
}

export default App;
