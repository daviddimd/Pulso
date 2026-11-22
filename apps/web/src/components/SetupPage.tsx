import { useEffect, useState, type FormEvent } from "react";

import { PulsoMark } from "./PulsoMark";
import { ThemeToggle } from "./ThemeToggle";

type SetupStatus = { required: boolean; codeFile?: string; timezones?: string[] };

const API_URL = import.meta.env.VITE_API_URL ?? "";
const CHILE_ZONES = ["America/Santiago", "America/Punta_Arenas", "Pacific/Easter"];
const ERRORS: Record<string, string> = {
  INVALID_SETUP_CODE: "El código de configuración no es válido. Revísalo en el servidor.",
  SETUP_COMPLETED: "Pulso ya fue configurado. Ingresa con la cuenta de administración creada.",
  SETUP_BUSY: "Otra configuración está en curso. Intenta nuevamente en unos segundos.",
  INVALID_USERNAME: "El usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.",
  INVALID_ESTABLISHMENT: "El código de la institución solo admite letras, números, guion y guion bajo.",
  ADMIN_PASSWORD_TOO_SHORT: "La contraseña debe tener al menos 12 caracteres.",
  ESTABLISHMENT_OR_USERNAME_EXISTS: "El código de institución o el usuario ya existen.",
};

function orderZones(all: string[]): string[] {
  return [...CHILE_ZONES.filter(zone => all.includes(zone)), ...all.filter(zone => !CHILE_ZONES.includes(zone))];
}

/** First-run page: creates the institution and its administrator on a fresh installation. */
export function SetupPage({ onDone }: { onDone: (username: string) => void }) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/api/setup`, { signal: controller.signal })
      .then(response => response.ok ? response.json() as Promise<SetupStatus> : Promise.reject(new Error("status")))
      .then(setStatus)
      .catch(reason => { if (!controller.signal.aborted && reason) setError("No fue posible conectar con Pulso. Verifica el servidor y la base de datos configurada en .env."); });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "");
    if (value("password") !== value("confirm")) { setError("Las contraseñas no coinciden."); return; }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupCode: value("setupCode"), establishmentCode: value("establishmentCode"), establishmentName: value("establishmentName"),
          timezone: value("timezone"), username: value("username"), password: value("password"),
        }),
      });
      const data = await response.json().catch(() => ({})) as { username?: string; error?: string };
      if (!response.ok) { setError(ERRORS[data.error ?? ""] ?? "No fue posible completar la configuración."); return; }
      onDone(data.username ?? value("username"));
    } catch {
      setError("No fue posible conectar con Pulso. Verifica que el servidor esté disponible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="setup-title">
        <header className="login-header"><div className="brand"><PulsoMark size="small" /><strong>Pulso<span>Configuración inicial</span></strong></div><ThemeToggle /></header>
        <div className="login-content">
          <div className="login-heading">
            <h1 id="setup-title">Configurar Pulso</h1>
            <p>{status?.required === false ? "Esta instalación ya tiene una institución configurada." : "Crea la institución y la cuenta de administración de esta instalación."}</p>
          </div>
          {status === null && !error && <p>Comprobando la instalación…</p>}
          {status?.required === false && <a className="setup-link" href="/">Ir al acceso</a>}
          {status?.required && <form className="login-form" onSubmit={e => void submit(e)} onChange={() => setError(null)}>
            <label>Código de configuración<input name="setupCode" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX-XXXX-XXXX" required disabled={saving} />
              <small>Está en <code>{status.codeFile}</code> o se obtiene con <code>php spark pulso:codigo-configuracion</code>.</small></label>
            <label>Nombre de la institución<input name="establishmentName" maxLength={200} placeholder="Hospital Regional" required disabled={saving} /></label>
            <label>Código de la institución<input name="establishmentCode" maxLength={30} pattern="[A-Za-z0-9_-]+" title="Letras, números, guion o guion bajo" placeholder="HRT" required disabled={saving} /></label>
            <label>Zona horaria<select name="timezone" defaultValue="America/Santiago" required disabled={saving}>{orderZones(status.timezones ?? CHILE_ZONES).map(zone => <option key={zone} value={zone}>{zone}</option>)}</select></label>
            <label>Usuario de administración<input name="username" autoComplete="username" autoCapitalize="none" maxLength={50} pattern="[A-Za-z0-9._-]{3,50}" title="3 a 50 caracteres: letras, números, punto, guion o guion bajo" required disabled={saving} /></label>
            <label>Contraseña<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={1024} placeholder="Mínimo 12 caracteres" required disabled={saving} /></label>
            <label>Confirmar contraseña<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required disabled={saving} /></label>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button type="submit" disabled={saving}>{saving ? "Configurando…" : "Crear institución y administrador"}</button>
          </form>}
          {!status?.required && error && <div className="login-error" role="alert">{error}</div>}
        </div>
        <footer className="login-footer d-flex align-items-center justify-content-center gap-2"><span>Disponible solo en instalaciones nuevas</span></footer>
      </section>
      <section className="login-visual" aria-label="Oficina de Movilización">
        <svg className="login-pulse" viewBox="0 0 900 240" aria-hidden="true"><path d="M0 125H190C210 125 218 101 232 101C246 101 254 125 272 125H310L334 158L369 48L402 145L424 125H470C490 125 499 94 518 94C537 94 545 125 568 125H900" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <div className="login-institution"><PulsoMark size="small" /><div><strong>Oficina de Movilización</strong><span>Configuración inicial de la instalación</span></div></div>
      </section>
    </main>
  );
}
