import { useEffect, useId, useRef, useState } from "react";

type Props = {
  name: string;
  role: string;
  onLogout: () => Promise<void>;
  logoutLoading: boolean;
};

export function ProfileMenu({ name, role, onLogout, logoutLoading }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className="ops-profile" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button type="button" className="ops-profile-trigger" ref={trigger} aria-label="Mi perfil" title="Mi perfil" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="9" r="3" /><path d="M5.8 18.5a6.5 6.5 0 0 1 12.4 0" /></svg>
    </button>
    {open && <div className="ops-profile-panel" id={id}>
      <strong>{name}</strong><span>{role}</span>
      <button type="button" className="ops-profile-logout" disabled={logoutLoading} onClick={() => void onLogout()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4H4v16h5M14 8l4 4-4 4M8 12h10" /></svg>
        {logoutLoading ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
    </div>}
  </div>;
}
