export type Theme = "light" | "dark";
const key = "pulso-theme";
const system = window.matchMedia("(prefers-color-scheme: dark)");
function readPreference(): Theme | null {
  try { const value = localStorage.getItem(key); return value === "dark" || value === "light" ? value : null; }
  catch { return null; }
}
let preference = readPreference();
export function initializeTheme() {
  document.documentElement.dataset.theme = preference ?? (system.matches ? "dark" : "light");
}
export const getTheme = (): Theme => document.documentElement.dataset.theme === "dark" ? "dark" : "light";
export function setTheme(theme: Theme) {
  preference = theme;
  try { localStorage.setItem(key, theme); } catch { /* Keep the choice for this visit. */ }
  initializeTheme();
  window.dispatchEvent(new Event("pulso-theme-change"));
}
export function subscribeTheme(notify: () => void) {
  const syncSystem = () => { initializeTheme(); notify(); };
  const syncStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) { preference = readPreference(); syncSystem(); } };
  system.addEventListener("change", syncSystem);
  window.addEventListener("storage", syncStorage);
  window.addEventListener("pulso-theme-change", notify);
  return () => {
    system.removeEventListener("change", syncSystem);
    window.removeEventListener("storage", syncStorage);
    window.removeEventListener("pulso-theme-change", notify);
  };
}
