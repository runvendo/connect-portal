import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@vendodev/connect-portal/styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("No #root element found in index.html");

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      const err = this.state.error;
      return (
        <pre
          style={{
            color: "#a40000",
            fontFamily: "monospace",
            padding: "1rem",
            whiteSpace: "pre-wrap",
            fontSize: "12px",
          }}
        >
          {err.message}
          {"\n\n"}
          {err.stack}
        </pre>
      );
    }
    return this.props.children;
  }
}

createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
