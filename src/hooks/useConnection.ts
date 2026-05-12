import { useContext } from "react";
import type { Connection } from "@vendodev/sdk";
import { PortalContext, VendoProviderMissingError } from "../context.js";

interface UseConnectionResult {
  connection: Connection | null;
  /** Overall portal status — gates whole-card skeleton. */
  status: "loading" | "ready" | "error";
  /**
   * Connections-list-specific status. While the connections request is in
   * flight (server-side Composio credential fan-out) the integration grid
   * has already rendered but per-card connection state is still unknown.
   * Cards use this to render a spinner on the connect/manage button.
   */
  connectionsStatus: "loading" | "ready" | "error";
  error: Error | null;
}

export function useConnection(slug: string): UseConnectionResult {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new VendoProviderMissingError("useConnection");
  const connection = ctx.connections.find((c) => c.slug === slug) ?? null;
  return {
    connection,
    status: ctx.status,
    connectionsStatus: ctx.connectionsStatus,
    error: ctx.error,
  };
}
