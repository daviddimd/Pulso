import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "bootstrap/dist/css/bootstrap-utilities.min.css";

import "./index.css";
import App from "./App.tsx";
import { initializeTheme } from "./theme";
import "./theme.css";

initializeTheme();

createRoot(
  document.getElementById("root")!,
).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
