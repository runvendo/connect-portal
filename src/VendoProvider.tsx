import React, { useCallback, useEffect, useReducer, useRef } from "react";
import type { Connection, Integration, Balance, SpendCaps } from "@vendodev/sdk";
import type { ConnectPortalClient } from "./client.js";
import { PortalContext } from "./context.js";
import type { PortalState, PortalContextValue } from "./context.js";
import { fetchTransport } from "./sse/fetchTransport.js";
import type { SseEvent, SseTransport } from "./sse/types.js";

type Action =
  | { type: "LOADED"; connections: Connection[]; integrations: Integration[]; balance: Balance; caps: SpendCaps }
  | { type: "ERROR"; error: Error }
  | { type: "UPSERT_CONNECTION"; connection: Connection }
  | { type: "DROP_CONNECTION"; slug: string }
  | { type: "SET_BALANCE"; balance: Balance }
  | { type: "SET_CAPS"; caps: SpendCaps };

function reducer(state: PortalState, action: Action): PortalState {
  switch (action.type) {
    case "LOADED":
      return {
        ...state,
        connections: action.connections,
        integrations: action.integrations,
        balance: action.balance,
        caps: action.caps,
        status: "ready",
        error: null,
      };
    case "ERROR":
      return { ...state, status: "error", error: action.error };
    case "UPSERT_CONNECTION": {
      const exists = state.connections.some((c) => c.slug === action.connection.slug);
      return {
        ...state,
        connections: exists
          ? state.connections.map((c) =>
              c.slug === action.connection.slug ? action.connection : c,
            )
          : [...state.connections, action.connection],
      };
    }
    case "DROP_CONNECTION":
      return {
        ...state,
        connections: state.connections.filter((c) => c.slug !== action.slug),
      };
    case "SET_BALANCE":
      return { ...state, balance: action.balance };
    case "SET_CAPS":
      return { ...state, caps: action.caps };
    default:
      return state;
  }
}

const INITIAL_STATE: PortalState = {
  connections: [],
  integrations: [],
  balance: null,
  caps: null,
  status: "loading",
  error: null,
};

interface VendoProviderProps {
  client: ConnectPortalClient;
  children: React.ReactNode;
  /**
   * @internal Testing-only: inject a mock SSE transport.
   * Not part of the public API — do not use in production code.
   */
  sseTransport?: SseTransport;
}

export function VendoProvider({ client, children, sseTransport }: VendoProviderProps): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const transport = sseTransport ?? fetchTransport;

  const upsertConnection = useCallback((conn: Connection) => {
    dispatch({ type: "UPSERT_CONNECTION", connection: conn });
  }, []);

  const dropConnection = useCallback((slug: string) => {
    dispatch({ type: "DROP_CONNECTION", slug });
  }, []);

  const setBalance = useCallback((b: Balance) => {
    dispatch({ type: "SET_BALANCE", balance: b });
  }, []);

  const setCaps = useCallback((c: SpendCaps) => {
    dispatch({ type: "SET_CAPS", caps: c });
  }, []);

  // Hold a stable ref to dispatch/client for SSE handler (avoids stale closures)
  const clientRef = useRef(client);
  clientRef.current = client;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        // Connections + integrations are required to render the portal.
        // Billing data is best-effort: a missing spend-caps endpoint or an
        // unfunded tenant should not blank out the whole UI.
        const [connections, integrations, billingResults] = await Promise.all([
          client.connections.list(),
          client.integrations.list(),
          Promise.allSettled([
            client.billing.balance(),
            client.billing.spendCaps(),
          ]),
        ]);
        const [balanceResult, capsResult] = billingResults;
        const balance = balanceResult.status === "fulfilled" ? balanceResult.value : null;
        const caps = capsResult.status === "fulfilled" ? capsResult.value : null;
        if (balanceResult.status === "rejected") {
          console.warn("[VendoProvider] billing.balance failed:", balanceResult.reason);
        }
        if (capsResult.status === "rejected") {
          console.warn("[VendoProvider] billing.spendCaps failed:", capsResult.reason);
        }
        if (!cancelled) {
          dispatch({ type: "LOADED", connections, integrations, balance, caps });
        }
      } catch (err) {
        if (!cancelled) {
          dispatch({ type: "ERROR", error: err instanceof Error ? err : new Error(String(err)) });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  // Run-once on mount; client identity is captured via clientRef for SSE handlers
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sseUrl = `${client.baseUrl}/api/deployments/me/events`;
    let cancelled = false;

    const conn = transport.open({ url: sseUrl, bearer: client.apiKey });

    conn.onEvent(async (ev: SseEvent) => {
      const d = dispatchRef.current;
      const c = clientRef.current;

      switch (ev.kind) {
        case "connection.connected":
        case "connection.changed":
        case "connection.status_changed": {
          const updated = await c.connections.get(ev.slug);
          if (cancelled) return;
          if (updated) d({ type: "UPSERT_CONNECTION", connection: updated });
          break;
        }
        case "connection.disconnected":
          d({ type: "DROP_CONNECTION", slug: ev.slug });
          break;
        case "billing.balance_changed": {
          // Map wire-format snake_case remaining_micros to SDK Balance shape
          const current = await c.billing.balance();
          if (cancelled) return;
          d({ type: "SET_BALANCE", balance: { ...current, creditsRemainingMicros: ev.remaining_micros } });
          break;
        }
        case "billing.cap_warned":
        case "billing.cap_tripped": {
          const caps = await c.billing.spendCaps();
          if (cancelled) return;
          d({ type: "SET_CAPS", caps });
          break;
        }
        case "billing.usage_recorded":
          // Informational only — no cache mutation needed
          break;
      }
    });

    conn.onError((_err: Error) => {
      // Errors are handled by transport reconnect logic; no state mutation
    });

    return () => {
      cancelled = true;
      conn.close();
    };
  // Run-once on mount; client identity is captured via clientRef for SSE handlers
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: PortalContextValue = {
    ...state,
    upsertConnection,
    dropConnection,
    setBalance,
    setCaps,
    _connectUrl: (slug, opts) => client.connectUrl(slug, opts),
    _baseUrl: client.baseUrl,
    _disconnect: client.disconnect ? (id) => client.disconnect!(id) : undefined,
    _refetchConnection: (slug) => client.connections.get(slug),
  };

  return (
    <PortalContext.Provider value={value}>
      {children}
    </PortalContext.Provider>
  );
}
