import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { reportWebVitals } from "report-web-vitals";
import App from "./app.tsx";
import "virtual:uno.css";
import "./index.css";

const root = createRoot(document.querySelector("#root"));
// #v-ifdef PROD
reportWebVitals();
// #v-endif
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
