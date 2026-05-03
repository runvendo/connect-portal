import React, { useMemo } from "react";
import { Vendo } from "@vendodev/sdk";
import {
  VendoProvider,
  ConnectPortal,
  ConnectionCard,
  ConnectButton,
} from "@vendodev/connect-portal";

const apiKey = import.meta.env.VITE_VENDO_API_KEY;
// Use the dev server's own origin as baseUrl. vite.config.ts proxies /api/* and
// /connect/* to the real Vendo backend (default https://vendo.run), so the SDK
// can fetch without hitting browser CORS. Override target via VITE_VENDO_BASE_URL.
const baseUrl =
  typeof window !== "undefined" ? window.location.origin : "http://localhost:5174";

export function App(): React.ReactElement {
  if (!apiKey || apiKey === "vendo_sk_replace_me") {
    return <SetupNotice />;
  }

  // Vendo class implements the ConnectPortalClient surface (apiKey, baseUrl,
  // connections.list/get, integrations.list/get, billing.balance/spendCaps,
  // connectUrl). Hot-reloads when src/ changes via the vite alias.
  // fetch.bind(window) — without it, the SDK's `this.fetch(...)` throws
  // "Illegal invocation" because fetch needs window as receiver.
  const client = useMemo(
    () => new Vendo({ apiKey, baseUrl, fetch: window.fetch.bind(window) }),
    [],
  );

  return (
    <VendoProvider client={client}>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.h1}>connect-portal — real auth playground</h1>
          <p style={styles.subtitle}>
            Live data from <code>{baseUrl}</code>. Edits in <code>../../src/</code>{" "}
            hot-reload here.
          </p>
        </header>

        <section style={styles.section}>
          <h2 style={styles.h2}>ConnectPortal</h2>
          <ConnectPortal returnTo={window.location.href} />
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>ConnectionCard — single integration</h2>
          <p style={styles.desc}>
            Slug from <code>?card=</code> query (defaults to <code>telegram</code>).
          </p>
          <ConnectionCard
            slug={getSlugParam("card") ?? "telegram"}
            returnTo={window.location.href}
          />
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>ConnectButton — bare CTA</h2>
          <ConnectButton
            slug={getSlugParam("button") ?? "telegram"}
            returnTo={window.location.href}
          >
            Connect
          </ConnectButton>
        </section>
      </div>
    </VendoProvider>
  );
}

function getSlugParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

function SetupNotice(): React.ReactElement {
  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>connect-portal — real auth playground</h1>
      <p>
        <strong>Setup required.</strong> Copy{" "}
        <code>.env.example</code> to <code>.env.local</code> and set{" "}
        <code>VITE_VENDO_API_KEY</code> to a real <code>vendo_sk_*</code> key.
      </p>
      <pre style={styles.pre}>
{`# in the vendo monorepo:
vendo dev --env

# then in this folder:
echo "VITE_VENDO_API_KEY=$(grep '^VENDO_API_KEY=' /path/to/vendo/.env.vendo-dev | cut -d= -f2)" > .env.local
npm run dev`}
      </pre>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: "960px",
    margin: "0 auto",
    padding: "2rem 1rem",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#1a1a1a",
  } satisfies React.CSSProperties,
  header: { marginBottom: "2rem" } satisfies React.CSSProperties,
  h1: { fontSize: "1.5rem", margin: 0, fontWeight: 700 } satisfies React.CSSProperties,
  subtitle: {
    color: "#666",
    fontSize: "0.875rem",
    marginTop: "0.25rem",
  } satisfies React.CSSProperties,
  section: {
    border: "1px solid #e5e5ea",
    borderRadius: "10px",
    padding: "1.25rem",
    marginBottom: "1.5rem",
    background: "#fff",
  } satisfies React.CSSProperties,
  h2: {
    fontSize: "1rem",
    fontWeight: 600,
    margin: "0 0 0.75rem",
  } satisfies React.CSSProperties,
  desc: {
    color: "#666",
    fontSize: "0.875rem",
    marginTop: 0,
  } satisfies React.CSSProperties,
  pre: {
    background: "#f5f5f7",
    border: "1px solid #e5e5ea",
    padding: "0.75rem",
    borderRadius: "6px",
    fontSize: "0.85rem",
    overflowX: "auto",
  } satisfies React.CSSProperties,
};
