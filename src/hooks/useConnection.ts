import { useContext } from "react";
import type { Connection } from "@vendodev/sdk";
import { PortalContext, VendoProviderMissingError } from "../context.js";

interface UseConnectionResult {
  connection: Connection | null;
  status: "loading" | "ready" | "error";
  error: Error | null;
}

export function useConnection(slug: string): UseConnectionResult {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new VendoProviderMissingError("useConnection");
  const connection = ctx.connections.find((c) => c.slug === slug) ?? null;
  return { connection, status: ctx.status, error: ctx.error };
}
