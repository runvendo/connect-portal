import React, { useState } from "react";
import type { Connection } from "@vendodev/sdk";
import { useConnect } from "../hooks/useConnect.js";

interface ConnectButtonProps {
  /** Integration slug to connect. */
  slug: string;
  /** URL to return to after OAuth. Defaults to window.location.href. */
  returnTo?: string;
  /** Called when the connection completes successfully. */
  onConnected?: (connectionId: string) => void;
  /** Called when connect() throws or returns an unexpected result. */
  onError?: (error: Error) => void;
  /** Pass-through label. Defaults to "Connect". */
  children?: React.ReactNode;
  className?: string;
}

/** Bare connect CTA. The host owns all surrounding layout.
 *  Use this in onboarding flows or anywhere you need a standalone connect trigger.
 */
export function ConnectButton({
  slug,
  returnTo,
  onConnected,
  onError,
  children,
  className,
}: ConnectButtonProps): React.ReactElement {
  const { connect } = useConnect();
  const [inFlight, setInFlight] = useState(false);

  async function handleClick(): Promise<void> {
    setInFlight(true);
    try {
      const result = await connect(slug, { returnTo });
      if (result.status === "connected" && result.connectionId) {
        onConnected?.(result.connectionId);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setInFlight(false);
    }
  }

  return (
    <button
      className={["vendo-connect-btn", className].filter(Boolean).join(" ")}
      onClick={handleClick}
      disabled={inFlight}
    >
      {children ?? "Connect"}
    </button>
  );
}
