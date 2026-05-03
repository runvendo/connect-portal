import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@vendodev/connect-portal/styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("No #root element found in index.html");

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
