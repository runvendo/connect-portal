import type { Connection, Integration, Balance, SpendCaps } from "@vendodev/sdk";
import type { ConnectPortalClient } from "../client.js";

export class MockClient implements ConnectPortalClient {
  readonly apiKey = "vendo_sk_test";
  readonly baseUrl = "https://api.vendo.run";

  private _connections: Connection[];
  private _integrations: Integration[];
  private _balance: Balance;
  private _caps: SpendCaps;

  constructor(opts: {
    connections?: Connection[];
    integrations?: Integration[];
    balance?: Balance;
    caps?: SpendCaps;
  } = {}) {
    this._connections = opts.connections ?? [];
    this._integrations = opts.integrations ?? [];
    this._balance = opts.balance ?? {
      creditsRemainingMicros: 1_000_000,
      currency: "USD",
      topUpUrl: "https://vendo.run/billing",
    };
    this._caps = opts.caps ?? {
      dailyMicros: null,
      monthlyMicros: null,
      usedTodayMicros: 0,
      usedMonthMicros: 0,
    };
  }

  connections = {
    list: async (): Promise<Connection[]> => [...this._connections],
    get: async (slug: string): Promise<Connection | null> =>
      this._connections.find((c) => c.slug === slug) ?? null,
  };

  integrations = {
    list: async (): Promise<Integration[]> => [...this._integrations],
    get: async (slug: string): Promise<Integration | null> =>
      this._integrations.find((i) => i.slug === slug) ?? null,
  };

  billing = {
    balance: async (): Promise<Balance> => ({ ...this._balance }),
    spendCaps: async (): Promise<SpendCaps> => ({ ...this._caps }),
  };

  connectUrl(slug: string, opts?: { returnTo?: string; state?: string }): string {
    const u = new URL(`https://connect.vendo.run/${slug}`);
    if (opts?.returnTo) u.searchParams.set("return_to", opts.returnTo);
    if (opts?.state) u.searchParams.set("state", opts.state);
    return u.toString();
  }

  async disconnect(connectionId: string): Promise<void> {
    this._connections = this._connections.filter((c) => c.id !== connectionId && c.externalId !== connectionId);
  }

  /** Test helpers — mutate underlying state between renders. */
  _setConnections(conns: Connection[]): void {
    this._connections = conns;
  }
  _setBalance(b: Balance): void {
    this._balance = b;
  }
  _setCaps(c: SpendCaps): void {
    this._caps = c;
  }
}
