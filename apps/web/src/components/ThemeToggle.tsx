import { useSyncExternalStore } from "react";
import { getTheme, setTheme, subscribeTheme } from "../theme";

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, getTheme) === "dark";
  return <button type="button" className="theme-toggle" role="switch" aria-label="Modo oscuro" aria-checked={dark} onClick={() => setTheme(dark ? "light" : "dark")}>
    <span className="theme-toggle-icon" aria-hidden="true">☀</span>
    <span className="theme-toggle-track" aria-hidden="true"><span className="theme-toggle-thumb" /></span>
    <span className="theme-toggle-icon" aria-hidden="true">☾</span>
  </button>;
}
