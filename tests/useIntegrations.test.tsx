import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { VendoProvider } from "../src/VendoProvider.js";
import { useIntegrations } from "../src/hooks/useIntegrations.js";
import { MockClient } from "../src/testing/MockClient.js";
import { MockSseTransport } from "../src/testing/MockSseTransport.js";
import { VendoProviderMissingError } from "../src/context.js";
import type { Integration } from "@vendodev/sdk";

function makeIntegration(slug: string): Integration {
  return {
    slug,
    name: slug,
    description: "",
    category: "test",
    logoUrl: null,
    brandColor: null,
    docsUrl: null,
    supportedProfiles: ["default"],
    defaultProfile: "default",
    enabled: true,
    featured: false,
  };
}

describe("useIntegrations", () => {
  it("returns integrations after initial load", async () => {
    const client = new MockClient({
      integrations: [makeIntegration("github"), makeIntegration("slack")],
    });
    const sse = new MockSseTransport();

    function IntList(): React.ReactElement {
      const { integrations, status } = useIntegrations();
      return (
        <div>
          <span data-testid="status">{status}</span>
          <ul>
            {integrations.map((i) => (
              <li key={i.slug}>{i.slug}</li>
            ))}
          </ul>
        </div>
      );
    }

    render(
      <VendoProvider client={client} sseTransport={sse}>
        <IntList />
      </VendoProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("ready"),
    );

    expect(screen.getByText("github")).toBeDefined();
    expect(screen.getByText("slack")).toBeDefined();
  });

  it("throws VendoProviderMissingError when used outside provider", () => {
    function BareHook(): React.ReactElement {
      const { integrations } = useIntegrations();
      return <span>{integrations.length}</span>;
    }

    expect(() => render(<BareHook />)).toThrow(VendoProviderMissingError);
  });
});
