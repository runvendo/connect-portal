import type { Connection, Integration, Balance, SpendCaps } from "@vendodev/sdk";

export interface ConnectPortalClient {
  apiKey: string;
  baseUrl: string;
  connections: {
    list(): Promise<Connection[]>;
    get(slug: string): Promise<Connection | null>;
  };
  integrations: {
    list(): Promise<Integration[]>;
    get(slug: string): Promise<Integration | null>;
  };
  billing: {
    balance(): Promise<Balance>;
    spendCaps(): Promise<SpendCaps>;
  };
  connectUrl(slug: string, opts?: { returnTo?: string; state?: string }): string;
  /** Optional. If provided, useConnect.disconnect() calls this. Otherwise disconnect() throws. */
  disconnect?(connectionId: string): Promise<void>;
}
