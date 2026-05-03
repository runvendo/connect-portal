import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import React from "react";
import { VendoProvider } from "../src/VendoProvider.js";
import { useConnect } from "../src/hooks/useConnect.js";
import { MockClient } from "../src/testing/MockClient.js";
import { MockSseTransport } from "../src/testing/MockSseTransport.js";
import { VendoProviderMissingError } from "../src/context.js";
import type { Connection } from "@vendodev/sdk";

const BASE_CONNECTION: Connection = {
  id: "conn_123",
  externalId: "ext_123",
  slug: "telegram",
  displayName: "My Bot",
  category: "messaging",
  profile: "bot",
  status: "connected",
  metadata: {},
  credential: null,
  setupUrl: null,
  errorMessage: null,
  connectedAt: "2025-01-01T00:00:00Z",
  logoUrl: "https://cdn.vendo.run/logos/telegram.png",
  brandColor: "#0088cc",
  docsUrl: "https://docs.vendo.run/telegram",
};

function makeWrapper(opts: { connections?: Connection[]; clientExtra?: Record<string, unknown> } = {}) {
  const client = new MockClient({ connections: opts.connections ?? [] });
  if (opts.clientExtra) {
    Object.assign(client, opts.clientExtra);
  }
  const sse = new MockSseTransport();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <VendoProvider client={client} sseTransport={sse}>
        {children}
      </VendoProvider>
    );
  }
  return { client, sse, Wrapper };
}

// --- C1 compatibility ---

describe("useConnect – C1 compatibility", () => {
  it("throws VendoProviderMissingError when used outside provider", () => {
    function BareHook(): React.ReactElement {
      const { connect } = useConnect();
      return <button onClick={() => connect("x")}>x</button>;
    }

    expect(() => render(<BareHook />)).toThrow(VendoProviderMissingError);
  });
});

// --- C2 popup tests ---

describe("useConnect – C2 popup flow", () => {
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;
  let capturedListeners: Array<(event: MessageEvent) => void>;

  beforeEach(() => {
    capturedListeners = [];

    // Capture only "message" event listeners added after this point
    const origAdd = window.addEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation(
      (type: string, handler: EventListenerOrEventListenerObject, opts?: unknown) => {
        if (type === "message") {
          capturedListeners.push(handler as (event: MessageEvent) => void);
        }
        // Call through so browser internals still work
        origAdd(type, handler as EventListenerOrEventListenerObject, opts as AddEventListenerOptions);
      }
    );

    vi.spyOn(window, "removeEventListener").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to location.assign when popup is blocked and resolves redirect_initiated", async () => {
    windowOpenSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const assignSpy = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign: assignSpy, href: window.location.href, origin: window.location.origin });

    let result: { status: string } | undefined;

    function Connector(): React.ReactElement {
      const { connect } = useConnect();
      return (
        <button
          data-testid="btn"
          onClick={async () => {
            result = await connect("telegram", { returnTo: "/dashboard" });
          }}
        >
          Connect
        </button>
      );
    }

    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <Connector />
      </Wrapper>
    );

    await act(async () => {
      screen.getByTestId("btn").click();
    });

    expect(assignSpy).toHaveBeenCalledWith(expect.stringContaining("telegram"));
    expect(result).toEqual({ status: "redirect_initiated" });

    assignSpy.mockRestore();
  });

  it("resolves { status: connected } after valid popup postMessage", async () => {
    const fakePopup = { closed: false, close: vi.fn() };
    windowOpenSpy = vi.spyOn(window, "open").mockReturnValue(fakePopup as unknown as Window);

    const updatedConn = { ...BASE_CONNECTION };
    const client = new MockClient({ connections: [] });
    client.connections = {
      ...client.connections,
      get: vi.fn().mockResolvedValue(updatedConn),
      list: vi.fn().mockResolvedValue([]),
    };
    const sse = new MockSseTransport();

    let result: { status: string; connectionId?: string } | undefined;

    function Connector(): React.ReactElement {
      const { connect } = useConnect();
      return (
        <button
          data-testid="btn"
          onClick={async () => {
            result = await connect("telegram") as { status: string; connectionId?: string };
          }}
        >
          Connect
        </button>
      );
    }

    render(
      <VendoProvider client={client} sseTransport={sse}>
        <Connector />
      </VendoProvider>
    );

    await act(async () => {
      screen.getByTestId("btn").click();
    });

    // Dispatch the postMessage from vendo.run — use the client's baseUrl as origin
    const messageEvent = new MessageEvent("message", {
      origin: "https://api.vendo.run",
      data: {
        type: "vendo:connection-completed",
        slug: "telegram",
        connectionId: "conn_123",
      },
    });

    await act(async () => {
      for (const listener of capturedListeners) {
        listener(messageEvent);
      }
    });

    await waitFor(() => {
      expect(result?.status).toBe("connected");
    }, { timeout: 3000 });

    expect(result?.connectionId).toBe("conn_123");
  });

  it("calls client.connections.get with the slug after a successful popup connect (belt-and-suspenders refetch)", async () => {
    const fakePopup = { closed: false, close: vi.fn() };
    windowOpenSpy = vi.spyOn(window, "open").mockReturnValue(fakePopup as unknown as Window);

    const updatedConn = { ...BASE_CONNECTION };
    const client = new MockClient({ connections: [] });
    const getSpy = vi.fn().mockResolvedValue(updatedConn);
    client.connections = {
      ...client.connections,
      get: getSpy,
      list: vi.fn().mockResolvedValue([]),
    };
    const sse = new MockSseTransport();

    let result: { status: string } | undefined;

    function Connector(): React.ReactElement {
      const { connect } = useConnect();
      return (
        <button
          data-testid="btn"
          onClick={async () => {
            result = await connect("telegram");
          }}
        >
          Connect
        </button>
      );
    }

    render(
      <VendoProvider client={client} sseTransport={sse}>
        <Connector />
      </VendoProvider>
    );

    await act(async () => {
      screen.getByTestId("btn").click();
    });

    const messageEvent = new MessageEvent("message", {
      origin: "https://api.vendo.run",
      data: {
        type: "vendo:connection-completed",
        slug: "telegram",
        connectionId: "conn_123",
      },
    });

    await act(async () => {
      for (const listener of capturedListeners) {
        listener(messageEvent);
      }
    });

    await waitFor(() => {
      expect(result?.status).toBe("connected");
    }, { timeout: 3000 });

    // Belt-and-suspenders: connections.get must be called once with the slug
    expect(getSpy).toHaveBeenCalledWith("telegram");
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it("resolves { status: connected } even when refetch throws (no downgrade)", async () => {
    const fakePopup = { closed: false, close: vi.fn() };
    windowOpenSpy = vi.spyOn(window, "open").mockReturnValue(fakePopup as unknown as Window);

    const client = new MockClient({ connections: [] });
    // connections.get throws after a successful popup — simulates a transient network error
    client.connections = {
      ...client.connections,
      get: vi.fn().mockRejectedValue(new Error("network error")),
      list: vi.fn().mockResolvedValue([]),
    };
    const sse = new MockSseTransport();

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    let result: { status: string } | undefined;

    function Connector(): React.ReactElement {
      const { connect } = useConnect();
      return (
        <button
          data-testid="btn"
          onClick={async () => {
            result = await connect("telegram");
          }}
        >
          Connect
        </button>
      );
    }

    render(
      <VendoProvider client={client} sseTransport={sse}>
        <Connector />
      </VendoProvider>
    );

    await act(async () => {
      screen.getByTestId("btn").click();
    });

    const messageEvent = new MessageEvent("message", {
      origin: "https://api.vendo.run",
      data: {
        type: "vendo:connection-completed",
        slug: "telegram",
        connectionId: "conn_123",
      },
    });

    await act(async () => {
      for (const listener of capturedListeners) {
        listener(messageEvent);
      }
    });

    await waitFor(() => {
      expect(result?.status).toBe("connected");
    }, { timeout: 3000 });

    // Refetch failure should be logged as a warning, not thrown
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[useConnect]"),
      expect.anything(),
    );

    warnSpy.mockRestore();
  });

  it("onConnected callback receives the refetched connection, not the stale snapshot", async () => {
    const fakePopup = { closed: false, close: vi.fn() };
    windowOpenSpy = vi.spyOn(window, "open").mockReturnValue(fakePopup as unknown as Window);

    const updatedConn: Connection = { ...BASE_CONNECTION, displayName: "Updated Bot Name" };
    const client = new MockClient({ connections: [BASE_CONNECTION] });
    client.connections = {
      ...client.connections,
      get: vi.fn().mockResolvedValue(updatedConn),
      list: vi.fn().mockResolvedValue([BASE_CONNECTION]),
    };
    const sse = new MockSseTransport();

    const onConnectedSpy = vi.fn();

    function Connector(): React.ReactElement {
      const { connect } = useConnect();
      // Simulate what ConnectionCard does: pass result.connection to onConnected
      return (
        <button
          data-testid="btn"
          onClick={async () => {
            const res = await connect("telegram");
            if (res.status === "connected") {
              onConnectedSpy(res.connection ?? BASE_CONNECTION);
            }
          }}
        >
          Connect
        </button>
      );
    }

    render(
      <VendoProvider client={client} sseTransport={sse}>
        <Connector />
      </VendoProvider>
    );

    await act(async () => {
      screen.getByTestId("btn").click();
    });

    const messageEvent = new MessageEvent("message", {
      origin: "https://api.vendo.run",
      data: {
        type: "vendo:connection-completed",
        slug: "telegram",
        connectionId: "conn_123",
      },
    });

    await act(async () => {
      for (const listener of capturedListeners) {
        listener(messageEvent);
      }
    });

    await waitFor(() => {
      expect(onConnectedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: "Updated Bot Name" }),
      );
    }, { timeout: 3000 });
  });

  it("disconnect calls client.disconnect if available", async () => {
    const disconnectMock = vi.fn().mockResolvedValue(undefined);

    const { Wrapper } = makeWrapper({
      connections: [BASE_CONNECTION],
      clientExtra: { disconnect: disconnectMock },
    });

    function Disconnector(): React.ReactElement {
      const { disconnect } = useConnect();
      return (
        <button
          data-testid="btn"
          onClick={() => disconnect("conn_123")}
        >
          Disconnect
        </button>
      );
    }

    render(
      <Wrapper>
        <Disconnector />
      </Wrapper>
    );

    await act(async () => {
      screen.getByTestId("btn").click();
    });

    await waitFor(() => {
      expect(disconnectMock).toHaveBeenCalledWith("conn_123");
    }, { timeout: 3000 });
  });
});
