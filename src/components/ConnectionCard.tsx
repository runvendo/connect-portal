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
  className,
}: ConnectionCardProps): React.ReactElement {
  const { connection } = useConnection(slug);
  const { integrations } = useIntegrations();
  const { connect, disconnect } = useConnect();
  const ctx = useContext(PortalContext);
  const [inFlight, setInFlight] = useState(false);
  // Track mount status so post-await state updates are skipped after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const integration = integrations.find((i) => i.slug === slug);

  // Determine effective state; treat status='available' same as no connection.
  // When a popup connect is in-flight, show 'connecting' regardless of server state.
  const serverStatus =
    !connection || connection.status === "available" ? "available" : connection.status;
  const effectiveStatus = inFlight ? "connecting" : serverStatus;

  const displayName =
    connection?.displayName ?? integration?.name ?? slug;

  const logoUrl = connection?.logoUrl ?? integration?.logoUrl ?? null;

  const logoEl = customLogo ?? (
    logoUrl ? (
      <img
        src={logoUrl}
        alt={`${displayName} logo`}
        className="vendo-connect-card__logo"
      />
    ) : (
      <div className="vendo-connect-card__logo" aria-hidden />
    )
  );

  // Derive the dashboard URL for Manage actions.
  // Use connection.id (UUID) — the dashboard route queries .eq("id", connectionId).
  const dashboardOrigin = ctx ? ctx._baseUrl.replace(/\/api\/?$/, "") : "https://vendo.run";
  const dashboardUrl = connection
    ? `${dashboardOrigin}/dashboard/connections/${connection.id}`
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
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClasses}>
      {logoEl}
      <div className="vendo-connect-card__info">
        <div className="vendo-connect-card__name">{displayName}</div>
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
