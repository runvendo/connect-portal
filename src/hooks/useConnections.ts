import { useContext } from "react";
import type { Connection } from "@vendodev/sdk";
import { PortalContext, VendoProviderMissingError } from "../context.js";

interface UseConnectionsResult {
  connections: Connection[];
  status: "loading" | "ready" | "error";
  error: Error | null;
}

export function useConnections(): UseConnectionsResult {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new VendoProviderMissingError("useConnections");
  return { connections: ctx.connections, status: ctx.status, error: ctx.error };
}
