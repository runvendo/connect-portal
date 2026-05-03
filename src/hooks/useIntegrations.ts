import { useContext } from "react";
import type { Integration } from "@vendodev/sdk";
import { PortalContext, VendoProviderMissingError } from "../context.js";

interface UseIntegrationsResult {
  integrations: Integration[];
  status: "loading" | "ready" | "error";
  error: Error | null;
}

export function useIntegrations(): UseIntegrationsResult {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new VendoProviderMissingError("useIntegrations");
  return { integrations: ctx.integrations, status: ctx.status, error: ctx.error };
}
