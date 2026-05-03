import { describe, it, expect } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import React from "react";
import { VendoProvider } from "../src/VendoProvider.js";
import { useConnections } from "../src/hooks/useConnections.js";
import { useBilling } from "../src/hooks/useBilling.js";
import { MockClient } from "../src/testing/MockClient.js";
import { MockSseTransport } from "../src/testing/MockSseTransport.js";
import type { Connection } from "@vendodev/sdk";

function makeConn(slug: string): Connection {
  return {
    id: `id-${slug}`,
    externalId: `ext-${slug}`,
    slug,
    displayName: slug,
    category: "test",
    profile: "default",
    status: "connected",
    metadata: {},
    credential: null,
    setupUrl: null,
    errorMessage: null,
    connectedAt: "2024-01-01T00:00:00Z",
    logoUrl: "",
    brandColor: "#000",
    docsUrl: "",
  };
}

function Status(): React.ReactElement {
  const { status } = useConnections();
  return <span data-testid="status">{status}</span>;
}

describe("VendoProvider", () => {
  it("starts loading and transitions to ready after initial fetch", async () => {
    const client = new MockClient({ connections: [makeConn("github")] });
    const sse = new MockSseTransport();

    render(
      <VendoProvider client={client} sseTransport={sse}>
        <Status />
      </VendoProvider>,
    );

    expect(screen.getByTestId("status").textContent).toBe("loading");
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("ready"),
    );
  });

  it("populates connections cache on mount", async () => {
    const client = new MockClient({ connections: [makeConn("github"), makeConn("slack")] });
    const sse = new MockSseTransport();

    function List(): React.ReactElement {
      const { connections, status } = useConnections();
      return (
        <ul data-testid="list" data-status={status}>
          {connections.map((c) => (
            <li key={c.slug}>{c.slug}</li>
          ))}
        </ul>
      );
    }

    render(
      <VendoProvider client={client} sseTransport={sse}>
        <List />
      </VendoProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("list").getAttribute("data-status")).toBe("ready"),
    );
    expect(screen.getByText("github")).toBeDefined();
    expect(screen.getByText("slack")).toBeDefined();
  });

  it("updates connection cache on SSE connection.connected event", async () => {
    const newConn = makeConn("notion");
    const client = new MockClient({ connections: [] });
    // When get is called after the SSE event, return the new connection
    client.connections = {
      list: async () => [],
      get: async (slug: string) => (slug === "notion" ? newConn : null),
    };
    const sse = new MockSseTransport();

    function List(): React.ReactElement {
      const { connections } = useConnections();
      return <ul>{connections.map((c) => <li key={c.slug}>{c.slug}</li>)}</ul>;
    }

    render(
      <VendoProvider client={client} sseTransport={sse}>
        <List />
      </VendoProvider>,
    );

    await waitFor(() =>
      expect(screen.queryByText("loading")).toBeNull(),
    );

    await act(async () => {
      sse.emit({
        id: "1",
        at: "2024-01-01T00:00:00Z",
        kind: "connection.connected",
        slug: "notion",
        connection_id: "cid-notion",
      });
    });

    await waitFor(() => expect(screen.getByText("notion")).toBeDefined());
  });

  it("removes connection from cache on SSE connection.disconnected event", async () => {
    const conn = makeConn("github");
    const client = new MockClient({ connections: [conn] });
    const sse = new MockSseTransport();

    function List(): React.ReactElement {
      const { connections } = useConnections();
      return <ul>{connections.map((c) => <li key={c.slug}>{c.slug}</li>)}</ul>;
    }

    render(
      <VendoProvider client={client} sseTransport={sse}>
        <List />
      </VendoProvider>,
    );

    await waitFor(() => expect(screen.getByText("github")).toBeDefined());

    await act(async () => {
      sse.emit({
        id: "2",
        at: "2024-01-01T00:00:00Z",
        kind: "connection.disconnected",
        slug: "github",
        connection_id: "cid-github",
      });
    });

    await waitFor(() => expect(screen.queryByText("github")).toBeNull());
  });

  it("updates balance cache on SSE billing.balance_changed event", async () => {
    const client = new MockClient({
      balance: { creditsRemainingMicros: 1_000_000, currency: "USD", topUpUrl: "" },
    });
    const sse = new MockSseTransport();

    function Bal(): React.ReactElement {
      const { balance } = useBilling();
      return <span data-testid="bal">{balance?.creditsRemainingMicros ?? "null"}</span>;
    }

    render(
      <VendoProvider client={client} sseTransport={sse}>
        <Bal />
      </VendoProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("bal").textContent).toBe("1000000"),
    );

    await act(async () => {
      sse.emit({
        id: "3",
        at: "2024-01-01T00:00:00Z",
        kind: "billing.balance_changed",
        remaining_micros: 500_000,
      });
    });

    await waitFor(() =>
      expect(screen.getByTestId("bal").textContent).toBe("500000"),
    );
  });

  it("does not crash when SSE emits an error and connections cache stays usable", async () => {
    const client = new MockClient({ connections: [makeConn("github")] });
    const sse = new MockSseTransport();

    render(
      <VendoProvider client={client} sseTransport={sse}>
        <Status />
      </VendoProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("ready"),
    );

    // Emitting an SSE error should not crash the provider
    await act(async () => {
      sse.emitError(new Error("SSE auth/client error: 401"));
    });

    // Status should remain 'ready' — connections cache is still usable
    expect(screen.getByTestId("status").textContent).toBe("ready");
  });

  it("closes SSE stream on unmount", async () => {
    const client = new MockClient();
    const sse = new MockSseTransport();
    let closeCalled = false;
    const original = sse.open.bind(sse);
    sse.open = (opts) => {
      const conn = original(opts);
      const origClose = conn.close.bind(conn);
      conn.close = () => {
        closeCalled = true;
        origClose();
      };
      return conn;
    };

    const { unmount } = render(
      <VendoProvider client={client} sseTransport={sse}>
        <div />
      </VendoProvider>,
    );

    await waitFor(() => {}); // let mount settle

    unmount();
    expect(closeCalled).toBe(true);
  });
});
