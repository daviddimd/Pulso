import { useSyncExternalStore } from "react";
import { getTheme, setTheme, subscribeTheme } from "../theme";

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, getTheme) === "dark";
  const label = dark ? "Activar modo claro" : "Activar modo oscuro";
  return <button type="button" className="theme-toggle" aria-label={label} title={label} onClick={() => setTheme(dark ? "light" : "dark")}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></> : <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />}
    </svg>
  </button>;
}
