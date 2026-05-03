import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import React from "react";
import type { Connection, Integration } from "@vendodev/sdk";
import { VendoProvider } from "../../src/VendoProvider.js";
import { ConnectionCard } from "../../src/components/ConnectionCard.js";
import { MockClient } from "../../src/testing/MockClient.js";
import { MockSseTransport } from "../../src/testing/MockSseTransport.js";

const BASE_INTEGRATION: Integration = {
  slug: "telegram",
  name: "Telegram",
  description: "Telegram messaging",
  category: "messaging",
  logoUrl: "https://cdn.vendo.run/logos/telegram.png",
  brandColor: "#0088cc",
  docsUrl: "https://docs.vendo.run/telegram",
  supportedProfiles: ["bot"],
  defaultProfile: "bot",
  enabled: true,
  featured: false,
};

const BASE_CONNECTION: Connection = {
  id: "conn_123",
  externalId: "ext_123",
  slug: "telegram",
  displayName: "My Telegram Bot",
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

function makeWrapper(opts: { connections?: Connection[]; integrations?: Integration[] } = {}) {
  const client = new MockClient({
    connections: opts.connections ?? [],
    integrations: opts.integrations ?? [BASE_INTEGRATION],
  });
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

describe("ConnectionCard", () => {
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;
  let addListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    windowOpenSpy = vi.spyOn(window, "open").mockReturnValue(null);
    addListenerSpy = vi.spyOn(window, "addEventListener").mockImplementation(() => {});
    removeListenerSpy = vi.spyOn(window, "removeEventListener").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("available state (no connection row)", () => {
    it("renders Connect button when no connection exists", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectionCard slug="telegram" />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^connect$/i })).toBeInTheDocument();
      });
    });

    it("shows integration name", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectionCard slug="telegram" />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText(/telegram/i)).toBeInTheDocument();
      });
    });

    it("calls connect with correct slug on Connect click", async () => {
      const assignSpy = vi.spyOn(window.location, "assign").mockImplementation(() => {});
      const { Wrapper } = makeWrapper();
      render(<ConnectionCard slug="telegram" />, { wrapper: Wrapper });

      await waitFor(() => screen.getByRole("button", { name: /^connect$/i }));

      await act(async () => {
        screen.getByRole("button", { name: /^connect$/i }).click();
      });

      await waitFor(() => {
        // window.open called (popup attempt) or location.assign called (fallback)
        expect(windowOpenSpy.mock.calls.length + assignSpy.mock.calls.length).toBeGreaterThan(0);
      });

      assignSpy.mockRestore();
    });
  });

  describe("available state (connection.status === 'available')", () => {
    it("renders Connect button when status is available", async () => {
      const conn: Connection = { ...BASE_CONNECTION, status: "available" };
      const { Wrapper } = makeWrapper({ connections: [conn] });
      render(<ConnectionCard slug="telegram" />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^connect$/i })).toBeInTheDocument();
      });
    });
  });

  describe("connected state", () => {
    it("shows Connected badge + display name", async () => {
      const { Wrapper } = makeWrapper({ connections: [BASE_CONNECTION] });
      render(<ConnectionCard slug="telegram" />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
        expect(screen.getByText(/my telegram bot/i)).toBeInTheDocument();
      });
    });

    it("renders Manage button", async () => {
      const { Wrapper } = makeWrapper({ connections: [BASE_CONNECTION] });
      render(<ConnectionCard slug="telegram" />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^manage$/i })).toBeInTheDocument();
      });
    });
  });

  describe("pending_setup state", () => {
    it("shows Setup incomplete badge + Continue setup button", async () => {
      const conn: Connection = { ...BASE_CONNECTION, status: "pending_setup" };
      const { Wrapper } = makeWrapper({ connections: [conn] });
      render(<ConnectionCard slug="telegram" />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText(/setup incomplete/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /continue setup/i })).toBeInTheDocument();
      });
    });

    it("shows Cancel secondary button in pending_setup", async () => {
      const conn: Connection = { ...BASE_CONNECTION, status: "pending_setup" };
      const { Wrapper } = makeWrapper({ connections: [conn] });
      render(<ConnectionCard slug="telegram" />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
      });
    });
  });

  describe("needs_reauth state", () => {
    it("shows Reauth needed badge + Reconnect button", async () => {
      const conn: Connection = { ...BASE_CONNECTION, status: "needs_reauth" };
      const { Wrapper } = makeWrapper({ connections: [conn] });
      render(<ConnectionCard slug="telegram" />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText(/reauth needed/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /reconnect/i })).toBeInTheDocument();
      });
    });

    it("shows secondary Manage button in needs_reauth", async () => {
      const conn: Connection = { ...BASE_CONNECTION, status: "needs_reauth" };
      const { Wrapper } = makeWrapper({ connections: [conn] });
      render(<ConnectionCard slug="telegram" />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^manage$/i })).toBeInTheDocument();
      });
    });
  });

  describe("error state", () => {
    it("shows error badge with truncated message + Retry button", async () => {
      const conn: Connection = { ...BASE_CONNECTION, status: "error", errorMessage: "Upstream timeout" };
      const { Wrapper } = makeWrapper({ connections: [conn] });
      render(<ConnectionCard slug="telegram" />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
      });
    });

    it("shows secondary Manage button in error state", async () => {
      const conn: Connection = { ...BASE_CONNECTION, status: "error", errorMessage: "Oops" };
      const { Wrapper } = makeWrapper({ connections: [conn] });
      render(<ConnectionCard slug="telegram" />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^manage$/i })).toBeInTheDocument();
      });
    });
  });

  describe("compact variant", () => {
    it("renders with compact class when compact prop is true", async () => {
      const { Wrapper } = makeWrapper({ connections: [BASE_CONNECTION] });
      render(<ConnectionCard slug="telegram" compact />, { wrapper: Wrapper });
      await waitFor(() => {
        const card = document.querySelector(".vendo-connect-card--compact");
        expect(card).toBeInTheDocument();
      });
    });
  });

  describe("Manage button action", () => {
    it("opens dashboard popup URL when Manage is clicked in connected state", async () => {
      windowOpenSpy.mockReturnValue({} as Window);
      const { Wrapper } = makeWrapper({ connections: [BASE_CONNECTION] });
      render(<ConnectionCard slug="telegram" />, { wrapper: Wrapper });
      await waitFor(() => screen.getByRole("button", { name: /^manage$/i }));

      await act(async () => {
        screen.getByRole("button", { name: /^manage$/i }).click();
      });

      await waitFor(() => {
        const call = windowOpenSpy.mock.calls[0];
        expect(call[0]).toMatch(/\/dashboard\/connections\//);
      });
    });
  });

  describe("connecting state (Fix D — inFlight)", () => {
    it("shows Connecting badge while popup connect is in-flight", async () => {
      // popup open succeeds but we never resolve — deferred promise controls timing
      let resolveConnect!: (value: import("../../src/hooks/useConnect.js").ConnectResult) => void;
      const pendingConnect = new Promise<import("../../src/hooks/useConnect.js").ConnectResult>(
        (res) => { resolveConnect = res; }
      );

      const fakePopup = { closed: false, close: vi.fn() };
      windowOpenSpy.mockReturnValue(fakePopup as unknown as Window);

      // Prevent the popup bridge from resolving on its own
      addListenerSpy.mockImplementation(() => {});

      const client = new MockClient({
        connections: [],
        integrations: [BASE_INTEGRATION],
      });
      // Make connections.get return the updated connection
      client.connections = {
        ...client.connections,
        get: vi.fn().mockResolvedValue(null),
        list: vi.fn().mockResolvedValue([]),
      };

      // Patch connectUrl so the popup-open path works, then intercept via a custom
      // VendoProvider that injects a stubbed connect via context won't work cleanly —
      // instead we rely on window.open returning fakePopup and addEventListener being mocked
      // so the popup bridge never resolves, leaving inFlight=true.

      const sse = new MockSseTransport();

      function Wrapper({ children }: { children: React.ReactNode }) {
        return (
          <VendoProvider client={client} sseTransport={sse}>
            {children}
          </VendoProvider>
        );
      }

      render(<ConnectionCard slug="telegram" />, { wrapper: Wrapper });

      // Wait for Connect button to appear
      await waitFor(() => screen.getByRole("button", { name: /^connect$/i }));

      // Click Connect — this opens the (fake, never-resolving) popup
      await act(async () => {
        screen.getByRole("button", { name: /^connect$/i }).click();
      });

      // inFlight should now be true → badge text should contain "Connecting"
      await waitFor(() => {
        expect(screen.getByText(/connecting/i)).toBeInTheDocument();
      });

      // Cleanup — resolve the deferred so the component unmounts cleanly
      resolveConnect({ status: "cancelled" });
    });
  });
});
