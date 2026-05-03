import { useContext } from "react";
import type { Balance, SpendCaps } from "@vendodev/sdk";
import { PortalContext, VendoProviderMissingError } from "../context.js";

interface UseBillingResult {
  balance: Balance | null;
  caps: SpendCaps | null;
  status: "loading" | "ready" | "error";
  error: Error | null;
}

export function useBilling(): UseBillingResult {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new VendoProviderMissingError("useBilling");
  return { balance: ctx.balance, caps: ctx.caps, status: ctx.status, error: ctx.error };
}
