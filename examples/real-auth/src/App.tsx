import React, { useMemo, useState } from "react";
import { Vendo, connectUrl as buildConnectUrl } from "@vendodev/sdk";
import type { ConnectUrlOptions } from "@vendodev/sdk";
import {
  VendoProvider,
  ConnectPortal,
  ConnectionCard,
  ConnectButton,
  type Theme,
} from "@vendodev/connect-portal";

const apiKey = import.meta.env.VITE_VENDO_API_KEY;
// API calls use the dev server's own origin so vite's /api proxy picks them up
// (CORS bypass). The popup URL needs to point directly at the real Vendo host
// — opening the popup on localhost would mean the user's Supabase session
// cookies on vendo.run never apply, and the dashboard layout would redirect
// the popup to /login. Set the popup target via VITE_VENDO_BASE_URL.
const apiBaseUrl =
  typeof window !== "undefined" ? window.location.origin : "http://localhost:5174";
const popupHost = import.meta.env.VITE_VENDO_BASE_URL || "https://vendo.run";

export function App(): React.ReactElement {
  if (!apiKey || apiKey === "vendo_sk_replace_me") {
    return <SetupNotice />;
  }

  // Vendo class implements the ConnectPortalClient surface (apiKey, baseUrl,
  // connections.list/get, integrations.list/get, billing.balance/spendCaps,
  // connectUrl). Hot-reloads when src/ changes via the vite alias.
  // fetch.bind(window) — without it, the SDK's `this.fetch(...)` throws
  // "Illegal invocation" because fetch needs window as receiver.
  const client = useMemo(() => {
    const sdk = new Vendo({
      apiKey,
      baseUrl: apiBaseUrl,
      // Optional ?slow=N query param simulates a slow network so the loading
      // skeleton is visible during dev. No-op when not set.
      fetch: makeFetch(window.location.search),
    });
    // Override connectUrl so the popup opens at the real Vendo host (where
    // the user's Supabase session lives) while API calls still go through
    // the local /api proxy.
    sdk.connectUrl = (slug: string, opts?: Omit<ConnectUrlOptions, "apiKey" | "baseUrl">) =>
      buildConnectUrl(slug, { apiKey: sdk.apiKey, baseUrl: popupHost, ...(opts ?? {}) });
    return sdk;
  }, []);

  const [theme, setTheme] = useState<Theme>("light");

  return (
    <VendoProvider client={client}>
      <div style={{ ...styles.page, ...themePageStyle(theme) }}>
        <header style={styles.header}>
          <h1 style={{ ...styles.h1, color: themeText(theme) }}>
            connect-portal — real auth playground
          </h1>
          <p style={{ ...styles.subtitle, color: themeMuted(theme) }}>
            Live data from <code>{apiBaseUrl}</code> (popup → <code>{popupHost}</code>). Edits in <code>../../src/</code>{" "}
            hot-reload here.
          </p>
          <ThemeSwitcher value={theme} onChange={setTheme} />
        </header>

        <section style={{ ...styles.section, ...themeSectionStyle(theme) }}>
          <h2 style={{ ...styles.h2, color: themeText(theme) }}>ConnectPortal</h2>
          <ConnectPortal theme={theme} returnTo={window.location.href} />
        </section>

        <section style={{ ...styles.section, ...themeSectionStyle(theme) }}>
          <h2 style={{ ...styles.h2, color: themeText(theme) }}>
            ConnectionCard — single integration
          </h2>
          <p style={{ ...styles.desc, color: themeMuted(theme) }}>
            Slug from <code>?card=</code> query (defaults to <code>telegram</code>).
          </p>
          <ConnectionCard
            theme={theme}
            slug={getSlugParam("card") ?? "telegram"}
            returnTo={window.location.href}
          />
        </section>

        <section style={{ ...styles.section, ...themeSectionStyle(theme) }}>
          <h2 style={{ ...styles.h2, color: themeText(theme) }}>
            ConnectButton — bare CTA
          </h2>
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

function ThemeSwitcher({
  value,
  onChange,
}: {
  value: Theme;
  onChange: (t: Theme) => void;
}): React.ReactElement {
  const themes: { id: Theme; label: string }[] = [
    { id: "light", label: "Light" },
    { id: "beige", label: "Beige" },
    { id: "dark", label: "Dark" },
  ];
  return (
    <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.75rem" }}>
      {themes.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            style={{
              padding: "0.3rem 0.7rem",
              fontSize: "0.8rem",
              fontFamily: "inherit",
              border: `1px solid ${active ? "#2B7A5E" : "#d8d2c9"}`,
              borderRadius: "999px",
              background: active ? "#2B7A5E" : "transparent",
              color: active ? "#FAF7F2" : themeText(value),
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function themePageStyle(theme: Theme): React.CSSProperties {
  switch (theme) {
    case "beige":
      return { background: "#FAF7F2" };
    case "dark":
      return { background: "#000000" };
    default:
      return { background: "#FFFFFF" };
  }
}

function themeSectionStyle(theme: Theme): React.CSSProperties {
  switch (theme) {
    case "dark":
      return { background: "#1C1B18", border: "1px solid #35342F" };
    case "beige":
      return { background: "#FFFFFF", border: "1px solid #E6DDD0" };
    default:
      return { background: "#FFFFFF", border: "1px solid #e5e5ea" };
  }
}

function themeText(theme: Theme): string {
  return theme === "dark" ? "#FAF7F2" : "#1C1B18";
}

function themeMuted(theme: Theme): string {
  return theme === "dark" ? "#C1B7AB" : "#6B6B65";
}

function makeFetch(search: string): typeof fetch {
  const params = new URLSearchParams(search);
  const slowMs = parseInt(params.get("slow") ?? "0", 10);
  const base = window.fetch.bind(window);
  if (!slowMs || Number.isNaN(slowMs)) return base;
  return (input, init) =>
    new Promise((resolve, reject) =>
      setTimeout(() => base(input, init).then(resolve, reject), slowMs),
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
