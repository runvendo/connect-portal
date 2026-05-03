import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { VendoProvider } from "../src/VendoProvider.js";
import { useConnections } from "../src/hooks/useConnections.js";
import { MockClient } from "../src/testing/MockClient.js";
import { MockSseTransport } from "../src/testing/MockSseTransport.js";
import { VendoProviderMissingError } from "../src/context.js";
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

function ConnectionList(): React.ReactElement {
  const { connections, status } = useConnections();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <ul>
        {connections.map((c) => (
          <li key={c.slug}>{c.slug}</li>
        ))}
      </ul>
    </div>
  );
}

describe("useConnections", () => {
  it("returns loading then ready with connections from provider", async () => {
    const client = new MockClient({ connections: [makeConn("github"), makeConn("slack")] });
    const sse = new MockSseTransport();

    render(
      <VendoProvider client={client} sseTransport={sse}>
        <ConnectionList />
      </VendoProvider>,
    );

    expect(screen.getByTestId("status").textContent).toBe("loading");

    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("ready"),
    );

    expect(screen.getByText("github")).toBeDefined();
    expect(screen.getByText("slack")).toBeDefined();
  });

  it("throws VendoProviderMissingError when used outside provider", () => {
    function BareHook(): React.ReactElement {
      const { connections } = useConnections();
      return <span>{connections.length}</span>;
    }

    expect(() => render(<BareHook />)).toThrow(VendoProviderMissingError);
  });
});
