import { useCallback, useEffect, useState, type FormEvent } from "react";

import { api, ApiError, type Account } from "../operations";
import { Icon } from "./Icon";

const ROLE_LABEL: Record<Account["role"], string> = { DRIVER: "Chofer", ADMIN: "Administración" };

export function AccountsPanel({
  onChanged,
  onExpired,
}: {
  onChanged: () => void;
  onExpired: () => void;
}) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [created, setCreated] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<Account["role"]>("DRIVER");

  const load = useCallback(
    (signal?: AbortSignal) =>
      api<{ accounts: Account[] }>("/api/admin/accounts", undefined, "GET", signal)
        .then((data) => {
          setAccounts(data.accounts);
          setLoadError("");
        })
        .catch((e) => {
          if (signal?.aborted) return;
          if (e instanceof ApiError && e.status === 401) onExpired();
          setLoadError(e instanceof Error ? e.message : "No fue posible cargar las cuentas.");
        }),
    [onExpired],
  );

  useEffect(() => {
    const controller = new AbortController();
    api<{ accounts: Account[] }>("/api/admin/accounts", undefined, "GET", controller.signal)
      .then((data) => setAccounts(data.accounts))
      .catch((e) => {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.status === 401) onExpired();
        setLoadError(e instanceof Error ? e.message : "No fue posible cargar las cuentas.");
      });
    return () => controller.abort();
  }, [onExpired]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (name: string) => String(data.get(name) ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (password !== String(data.get("confirm") ?? "")) {
      setFormError("Las contraseñas no coinciden.");
      return;
    }
    setSaving(true);
    setFormError("");
    setCreated(null);
    try {
      const result = await api<{ account: Account }>("/api/admin/accounts", {
        fullName: value("fullName"),
        username: value("username"),
        role,
        rosterCode: value("rosterCode") || null,
        password,
      });
      form.reset();
      setRole("DRIVER");
      setCreated(result.account);
      await load();
      onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onExpired();
      setFormError(e instanceof Error ? e.message : "No fue posible crear la cuenta.");
    } finally {
      setSaving(false);
    }
  }

  const drivers = accounts?.filter((a) => a.role === "DRIVER") ?? [];
  const admins = accounts?.filter((a) => a.role === "ADMIN") ?? [];
  return (
    <>
      <details className="ops-card" open={accounts !== null && drivers.length === 0}>
        <summary className="ops-disclosure-heading">
          <span>
            <Icon name="plus" />
            Crear cuenta
          </span>
          <Icon name="chevron" />
        </summary>
        <p>
          La persona ingresa con este usuario y la contraseña inicial. Entrégasela por un canal
          seguro.
        </p>
        <form
          className="ops-form"
          onSubmit={(e) => void create(e)}
          onChange={() => setFormError("")}
        >
          <fieldset className="ops-account-role" disabled={saving}>
            <legend>Tipo de cuenta</legend>
            {(["DRIVER", "ADMIN"] as const).map((option) => (
              <label key={option}>
                <input
                  type="radio"
                  name="role"
                  value={option}
                  checked={role === option}
                  onChange={() => setRole(option)}
                />
                {ROLE_LABEL[option]}
              </label>
            ))}
          </fieldset>
          <label>
            Nombre completo
            <input
              name="fullName"
              minLength={2}
              maxLength={120}
              autoComplete="off"
              required
              disabled={saving}
            />
          </label>
          <label>
            Usuario
            <input
              name="username"
              pattern="[A-Za-z0-9._-]{3,50}"
              title="3 a 50 caracteres: letras, números, punto, guion o guion bajo"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              required
              disabled={saving}
            />
          </label>
          <label>
            Código de róster{role === "DRIVER" ? "" : " (opcional)"}
            <input
              name="rosterCode"
              maxLength={30}
              placeholder={role === "DRIVER" ? "Ej. MOV2026-10" : ""}
              disabled={saving}
            />
          </label>
          <label>
            Contraseña inicial
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={1024}
              placeholder="Mínimo 12 caracteres"
              required
              disabled={saving}
            />
          </label>
          <label>
            Confirmar contraseña
            <input
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={1024}
              required
              disabled={saving}
            />
          </label>
          {formError && (
            <p className="driver-error ops-form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="ops-actions">
            <button className="ops-primary-action" disabled={saving}>
              {saving ? "Creando…" : `Crear cuenta de ${ROLE_LABEL[role].toLowerCase()}`}
            </button>
          </div>
        </form>
      </details>
      {created && (
        <p className="ops-section-note" role="status">
          Cuenta creada: {created.fullName} ({created.username}) · {ROLE_LABEL[created.role]}.
        </p>
      )}
      {loadError && (
        <p className="driver-error" role="alert">
          {loadError}
        </p>
      )}
      {accounts === null && !loadError && <p className="ops-section-note">Cargando cuentas…</p>}
      {accounts &&
        [
          ["Choferes", drivers],
          ["Administración", admins],
        ].map(([title, list]) => (
          <section key={title as string} aria-label={title as string}>
            <h2 className="ops-section-heading">
              <Icon name="people" />
              {title as string}
              <span>{(list as Account[]).length}</span>
            </h2>
            {(list as Account[]).length === 0 ? (
              <p className="ops-section-note">Aún no hay cuentas de este tipo.</p>
            ) : (
              <ul className="ops-account-list">
                {(list as Account[]).map((a) => (
                  <li key={a.id} className="ops-card" data-inactive={!a.active}>
                    <strong>{a.fullName}</strong>
                    <span>
                      {a.username}
                      {a.rosterCode ? " · " + a.rosterCode : ""}
                      {a.active ? "" : " · Inactiva"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
    </>
  );
}
