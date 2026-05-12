import React, { useContext, useEffect, useRef, useState } from "react";
import type { Connection } from "@vendodev/sdk";
import { useConnection } from "../hooks/useConnection.js";
import { useIntegrations } from "../hooks/useIntegrations.js";
import { useConnect } from "../hooks/useConnect.js";
import { PortalContext } from "../context.js";

interface ConnectionCardProps {
  /** Integration slug. Drives all state lookups. */
  slug: string;
  /** Called when the connection transitions to `connected`. */
  onConnected?: (conn: Connection) => void;
  /** Called when the connection is removed via Cancel in `pending_setup`. */
  onDisconnected?: (conn: Connection) => void;
  /** Compact layout (~80px tall). Default is comfortable (~120px). */
  compact?: boolean;
  /** Override the logo element. */
  customLogo?: React.ReactNode;
  /** Passed to connect() and the dashboard popup. */
  returnTo?: string;
  /** Built-in theme preset. Defaults to "light"; pass "beige" or "dark"
   *  for the other Vendo presets. Inherits from a wrapping <ConnectPortal>
   *  if rendered inside one. */
  theme?: "light" | "beige" | "dark" | "glass-light" | "glass-dark";
  className?: string;
}

/** State-aware connection card. Renders the correct CTA for each connection state.
 *  Use this when you want a full self-contained card; use <ConnectButton> for bare CTAs.
 */
export function ConnectionCard({
  slug,
  onConnected,
  onDisconnected,
  compact,
  customLogo,
  returnTo,
  theme = "light",
  className,
}: ConnectionCardProps): React.ReactElement {
  const { connection, status, connectionsStatus } = useConnection(slug);
  const { integrations } = useIntegrations();
  const { connect, disconnect } = useConnect();
  const ctx = useContext(PortalContext);
  const [inFlight, setInFlight] = useState(false);
  // Connections list is still resolving on the server (Composio credential
  // fan-out). The card has its integration metadata, so name/logo render
  // immediately, but the connect/manage button can't pick its real state
  // yet — show a spinner CTA until we know.
  const connectionsPending = connectionsStatus === "loading" && !connection;
  // Track mount status so post-await state updates are skipped after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const integration = integrations.find((i) => i.slug === slug);

  // Determine effective state; treat status='available' same as no connection.
  // When a popup connect is in-flight, show 'connecting' regardless of server state.
  // When the connections fetch is still resolving, surface 'pending' so the
  // button renders a spinner instead of optimistically claiming 'available'.
  const serverStatus =
    !connection || connection.status === "available" ? "available" : connection.status;
  const effectiveStatus = inFlight
    ? "connecting"
    : connectionsPending
      ? "pending"
      : serverStatus;

  // Primary label is the provider/integration name (stable, recognizable).
  // The user-chosen connection nickname renders as subtext below, only when
  // it differs from the provider name (avoids "OpenAI / OpenAI" duplication).
  const providerName = integration?.name ?? slug;
  const connectionLabel =
    connection?.displayName && connection.displayName !== providerName
      ? connection.displayName
      : null;

  // integration.logoUrl is the SDK-facing public source of truth (DB-backed).
  // connection.logoUrl is a per-instance copy populated server-side from the
  // static dashboard catalog — it goes stale when the catalog changes and is
  // sometimes empty/whitespace, so prefer the integration value when present.
  const trim = (s: string | null | undefined): string | null =>
    s && s.trim() ? s : null;
  const logoUrl = trim(integration?.logoUrl) ?? trim(connection?.logoUrl) ?? null;

  const logoEl = customLogo ?? (
    logoUrl ? (
      <Logo url={logoUrl} alt={`${providerName} logo`} />
    ) : (
      <div className="vendo-connect-card__logo" aria-hidden />
    )
  );

  // Derive the dashboard URL for Manage actions.
  // Use connection.id (UUID) — the dashboard route at /connections/<id>
  // queries .eq("id", connectionId).
  //
  // Use the popup host (derived from client.connectUrl) rather than the API
  // baseUrl, so consumers who proxy the SDK API surface through their own
  // origin still get a manage URL pointing at the real Vendo dashboard.
  const dashboardOrigin = ctx
    ? safeOrigin(ctx._connectUrl("__placeholder__")) ??
      ctx._baseUrl.replace(/\/api\/?$/, "")
    : "https://vendo.run";
  const dashboardUrl = connection
    ? `${dashboardOrigin}/connections/${connection.id}`
    : null;

  function handleConnect(): void {
    setInFlight(true);
    void connect(slug, { returnTo })
      .then((result) => {
        if (!mountedRef.current) return;
        if (result.status === "connected") {
          // Pass the freshly-refetched connection so the callback receives current server state
          if (onConnected) onConnected(result.connection ?? connection!);
        }
        // Do not clear inFlight on redirect_initiated — the page is navigating away
        if (result.status !== "redirect_initiated") {
          setInFlight(false);
        }
      })
      .catch(() => {
        if (mountedRef.current) setInFlight(false);
      });
  }

  function handleDisconnect(): void {
    if (!connection) return;
    void disconnect(connection.id).then(() => {
      if (onDisconnected && connection) onDisconnected(connection);
    });
  }

  function handleManage(): void {
    if (dashboardUrl) {
      window.open(dashboardUrl, "vendo-manage", "width=960,height=720,popup");
    }
  }

  const cardClasses = [
    "vendo-connect-card",
    compact ? "vendo-connect-card--compact" : undefined,
    theme !== "light" ? `vendo-theme-${theme}` : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Standalone-card loading state. When a card is rendered outside <ConnectPortal>
  // (e.g. <ConnectionCard slug="telegram" />), it has no parent skeleton to
  // mask the in-flight provider fetch — render a self-contained skeleton
  // until the catalog lands. Inside the portal grid this never trips because
  // ConnectPortal returns its own skeleton grid first.
  if (status === "loading") {
    return (
      <div
        className={`${cardClasses} vendo-connect-card--skeleton`}
        aria-busy="true"
      >
        <div className="vendo-connect-card__logo-skeleton" aria-hidden />
        <div className="vendo-connect-card__info">
          <div className="vendo-skeleton-line vendo-skeleton-line--name" />
          <div className="vendo-skeleton-line vendo-skeleton-line--badge" />
        </div>
        <div className="vendo-skeleton-line vendo-skeleton-line--cta" />
      </div>
    );
  }

  return (
    <div className={cardClasses}>
      {logoEl}
      <div className="vendo-connect-card__info">
        <div className="vendo-connect-card__name">{providerName}</div>
        {connectionLabel ? (
          <div className="vendo-connect-card__nickname">{connectionLabel}</div>
        ) : null}
        <StatusBadge status={effectiveStatus} errorMessage={connection?.errorMessage ?? null} />
      </div>
      <div className="vendo-connect-card__actions">
        <PrimaryAction
          status={effectiveStatus}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onManage={handleManage}
          onCancelInFlight={() => setInFlight(false)}
        />
        <SecondaryAction
          status={effectiveStatus}
          onDisconnect={handleDisconnect}
          onManage={handleManage}
        />
      </div>
    </div>
  );
}

// --- Internal sub-components ---

function StatusBadge({
  status,
  errorMessage,
}: {
  status: string;
  errorMessage: string | null;
}): React.ReactElement | null {
  switch (status) {
    case "available":
      return null;
    case "connecting":
      return (
        <span className="vendo-connect-card__badge">
          <Spinner /> Connecting…
        </span>
      );
    case "pending_setup":
      return <span className="vendo-connect-card__badge">Setup incomplete</span>;
    case "connected":
      return (
        <span className="vendo-connect-card__badge vendo-connect-card__badge--connected">
          ● Connected
        </span>
      );
    case "needs_reauth":
      return (
        <span className="vendo-connect-card__badge vendo-connect-card__badge--warning">
          ● Reauth needed
        </span>
      );
    case "error":
      return (
        <span className="vendo-connect-card__badge vendo-connect-card__badge--error">
          ● Error{errorMessage ? `: ${errorMessage.slice(0, 60)}` : ""}
        </span>
      );
    default:
      return null;
  }
}

function PrimaryAction({
  status,
  onConnect,
  onDisconnect,
  onManage,
  onCancelInFlight,
}: {
  status: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onManage: () => void;
  /** Called when the user cancels an in-flight popup connect. Sets inFlight=false;
   *  the popup itself resolves to 'cancelled' when the user closes it or timeout fires. */
  onCancelInFlight: () => void;
}): React.ReactElement {
  switch (status) {
    case "pending":
      // Connections list still loading server-side (Composio fan-out).
      // Disabled CTA with a spinner. Clicking is a no-op until we know
      // whether to call connect() or open the manage popup.
      return (
        <button
          className="vendo-connect-card__cta vendo-connect-card__cta--pending"
          disabled
          aria-busy="true"
          aria-label="Loading connection state"
        >
          <Spinner />
        </button>
      );
    case "available":
      return (
        <button className="vendo-connect-card__cta" onClick={onConnect}>
          Connect
        </button>
      );
    case "connecting":
      return (
        <button className="vendo-connect-card__cta" onClick={onCancelInFlight}>
          Cancel
        </button>
      );
    case "pending_setup":
      return (
        <button className="vendo-connect-card__cta" onClick={onConnect}>
          Continue setup
        </button>
      );
    case "connected":
      return (
        <button className="vendo-connect-card__cta" onClick={onManage}>
          Manage
        </button>
      );
    case "needs_reauth":
      return (
        <button className="vendo-connect-card__cta" onClick={onConnect}>
          Reconnect
        </button>
      );
    case "error":
      return (
        <button className="vendo-connect-card__cta" onClick={onConnect}>
          Retry
        </button>
      );
    default:
      return (
        <button className="vendo-connect-card__cta" onClick={onConnect}>
          Connect
        </button>
      );
  }
}

function SecondaryAction({
  status,
  onDisconnect,
  onManage,
}: {
  status: string;
  onDisconnect: () => void;
  onManage: () => void;
}): React.ReactElement | null {
  switch (status) {
    case "pending_setup":
      return (
        <button
          className="vendo-connect-card__cta vendo-connect-card__cta--secondary"
          onClick={onDisconnect}
        >
          Cancel
        </button>
      );
    case "needs_reauth":
    case "error":
      return (
        <button
          className="vendo-connect-card__cta vendo-connect-card__cta--secondary"
          onClick={onManage}
        >
          Manage
        </button>
      );
    default:
      return null;
  }
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Show a skeleton box until the logo image finishes loading or errors. */
function Logo({ url, alt }: { url: string; alt: string }): React.ReactElement {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // A cached <img> resolves its native `load` event *before* React attaches
  // the onLoad handler, so `onLoad` never fires and the image stays at
  // opacity:0 forever (visible only when the user drags it, which is the
  // browser's drag-preview). Check `complete` after attach as a backstop.
  // Also resets state when the URL changes (e.g. theme switch) — without
  // the reset the previous `loaded=true` keeps the old src visible until
  // the new image swaps in.
  useEffect(() => {
    setLoaded(false);
    setErrored(false);
    const img = imgRef.current;
    if (img && img.complete) {
      if (img.naturalWidth > 0) setLoaded(true);
      else setErrored(true);
    }
  }, [url]);

  return (
    <div className="vendo-connect-card__logo-wrap" aria-hidden={errored}>
      {!loaded && !errored ? (
        <div className="vendo-connect-card__logo-skeleton" aria-hidden />
      ) : null}
      {!errored ? (
        <img
          ref={imgRef}
          src={url}
          alt={alt}
          className="vendo-connect-card__logo"
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      ) : null}
    </div>
  );
}

function Spinner(): React.ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      className="vendo-spinner"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
