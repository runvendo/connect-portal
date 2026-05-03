import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { VendoProvider } from "../src/VendoProvider.js";
import { useConnection } from "../src/hooks/useConnection.js";
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

describe("useConnection", () => {
  it("returns the connection matching the slug", async () => {
    const client = new MockClient({ connections: [makeConn("github"), makeConn("slack")] });
    const sse = new MockSseTransport();

    function SingleConn(): React.ReactElement {
      const { connection, status } = useConnection("github");
      return (
        <div>
          <span data-testid="status">{status}</span>
          <span data-testid="slug">{connection?.slug ?? "null"}</span>
        </div>
      );
    }

    render(
      <VendoProvider client={client} sseTransport={sse}>
        <SingleConn />
      </VendoProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("ready"),
    );
    expect(screen.getByTestId("slug").textContent).toBe("github");
  });

  it("returns null connection for unknown slug", async () => {
    const client = new MockClient({ connections: [] });
    const sse = new MockSseTransport();

    function SingleConn(): React.ReactElement {
      const { connection, status } = useConnection("nope");
      return (
        <div>
          <span data-testid="status">{status}</span>
          <span data-testid="slug">{connection?.slug ?? "null"}</span>
        </div>
      );
    }

    render(
      <VendoProvider client={client} sseTransport={sse}>
        <SingleConn />
      </VendoProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("ready"),
    );
    expect(screen.getByTestId("slug").textContent).toBe("null");
  });

  it("throws VendoProviderMissingError when used outside provider", () => {
    function BareHook(): React.ReactElement {
      const { connection } = useConnection("x");
      return <span>{connection?.slug}</span>;
    }

    expect(() => render(<BareHook />)).toThrow(VendoProviderMissingError);
  });
});
