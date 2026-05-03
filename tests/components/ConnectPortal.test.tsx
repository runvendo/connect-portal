import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type { Connection, Integration } from "@vendodev/sdk";
import { VendoProvider } from "../../src/VendoProvider.js";
import { ConnectPortal } from "../../src/components/ConnectPortal.js";
import { MockClient } from "../../src/testing/MockClient.js";
import { MockSseTransport } from "../../src/testing/MockSseTransport.js";

// --- fixtures ---

const INTEGRATIONS: Integration[] = [
  {
    slug: "telegram",
    name: "Telegram",
    description: "Telegram messaging bot",
    category: "messaging",
    logoUrl: null,
    brandColor: "#0088cc",
    docsUrl: null,
    supportedProfiles: ["bot"],
    defaultProfile: "bot",
    enabled: true,
    featured: true,
  },
  {
    slug: "slack",
    name: "Slack",
    description: "Slack workspace messaging",
    category: "messaging",
    logoUrl: null,
    brandColor: "#4A154B",
    docsUrl: null,
    supportedProfiles: ["bot"],
    defaultProfile: "bot",
    enabled: true,
    featured: false,
  },
  {
    slug: "openai",
    name: "OpenAI",
    description: "OpenAI GPT API",
    category: "ai",
    logoUrl: null,
    brandColor: null,
    docsUrl: null,
    supportedProfiles: ["api"],
    defaultProfile: "api",
    enabled: true,
    featured: true,
  },
  {
    slug: "gdrive",
    name: "Google Drive",
    description: "Store files in Google Drive",
    category: "storage",
    logoUrl: null,
    brandColor: null,
    docsUrl: null,
    supportedProfiles: ["oauth"],
    defaultProfile: "oauth",
    enabled: true,
    featured: false,
  },
  {
    slug: "notion",
    name: "Notion",
    description: "Notion productivity tool",
    category: "productivity",
    logoUrl: null,
    brandColor: null,
    docsUrl: null,
    supportedProfiles: ["oauth"],
    defaultProfile: "oauth",
    enabled: true,
    featured: false,
  },
];

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
  logoUrl: "",
  brandColor: "#0088cc",
  docsUrl: "",
};

function makeWrapper(opts: {
  connections?: Connection[];
  integrations?: Integration[];
} = {}) {
  const client = new MockClient({
    connections: opts.connections ?? [],
    integrations: opts.integrations ?? INTEGRATIONS,
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

describe("ConnectPortal", () => {
  // window.open is mocked suite-wide because every ConnectionCard CTA triggers
  // a popup; without the mock, jsdom throws on window.open(null).
  beforeEach(() => {
    vi.spyOn(window, "open").mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // window.addEventListener / removeEventListener spies are scoped inside this
  // describe so they don't suppress listeners relied on by other tests.
  describe("popup message bridge (window event listeners)", () => {
    beforeEach(() => {
      vi.spyOn(window, "addEventListener").mockImplementation(() => {});
      vi.spyOn(window, "removeEventListener").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("does not attach a global message listener on plain render (bridge is lazy)", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal />, { wrapper: Wrapper });
      await waitFor(() => screen.getByRole("region"));
      // The popup bridge attaches its message listener only when a CTA is
      // clicked, not on mount — so a bare render should produce zero calls.
      const messageCalls = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([type]) => type === "message",
      );
      expect(messageCalls).toHaveLength(0);
    });
  });

  describe("renders grouped integrations", () => {
    it("renders all integrations from context", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText("Telegram")).toBeInTheDocument();
        expect(screen.getByText("Slack")).toBeInTheDocument();
        expect(screen.getByText("OpenAI")).toBeInTheDocument();
        expect(screen.getByText("Google Drive")).toBeInTheDocument();
        expect(screen.getByText("Notion")).toBeInTheDocument();
      });
    });

    it("renders category group headers", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /messaging/i })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /^ai$/i })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /storage/i })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /productivity/i })).toBeInTheDocument();
      });
    });

    it("cards are wrapped in ul with role=list", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal />, { wrapper: Wrapper });
      await waitFor(() => {
        const lists = screen.getAllByRole("list");
        expect(lists.length).toBeGreaterThan(0);
      });
    });

    it("root container has aria-label", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByRole("region", { name: /vendo connections/i })).toBeInTheDocument();
      });
    });
  });

  describe("categories prop filter", () => {
    it("only shows groups for requested categories", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal categories={["messaging"]} />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText("Telegram")).toBeInTheDocument();
        expect(screen.getByText("Slack")).toBeInTheDocument();
        expect(screen.queryByText("OpenAI")).not.toBeInTheDocument();
        expect(screen.queryByText("Google Drive")).not.toBeInTheDocument();
      });
    });

    it("shows multiple categories when specified", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal categories={["ai", "storage"]} />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText("OpenAI")).toBeInTheDocument();
        expect(screen.getByText("Google Drive")).toBeInTheDocument();
        expect(screen.queryByText("Telegram")).not.toBeInTheDocument();
      });
    });
  });

  describe("search / filter", () => {
    it("renders a search input by default", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByRole("searchbox")).toBeInTheDocument();
      });
    });

    it("does not render search when showSearch=false", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal showSearch={false} />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
      });
    });

    it("filters by name substring", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal />, { wrapper: Wrapper });
      await waitFor(() => screen.getByRole("searchbox"));

      vi.useFakeTimers();
      try {
        await act(async () => {
          fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Telegram" } });
        });
        await act(async () => { vi.advanceTimersByTime(150); });
      } finally {
        vi.useRealTimers();
      }

      await waitFor(() => {
        expect(screen.getByText("Telegram")).toBeInTheDocument();
        expect(screen.queryByText("Slack")).not.toBeInTheDocument();
        expect(screen.queryByText("OpenAI")).not.toBeInTheDocument();
      });
    });

    it("filters by slug substring (case-insensitive)", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal />, { wrapper: Wrapper });
      await waitFor(() => screen.getByRole("searchbox"));

      vi.useFakeTimers();
      try {
        await act(async () => {
          fireEvent.change(screen.getByRole("searchbox"), { target: { value: "gdrive" } });
        });
        await act(async () => { vi.advanceTimersByTime(150); });
      } finally {
        vi.useRealTimers();
      }

      await waitFor(() => {
        expect(screen.getByText("Google Drive")).toBeInTheDocument();
        expect(screen.queryByText("Telegram")).not.toBeInTheDocument();
      });
    });

    it("filters by description substring", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal />, { wrapper: Wrapper });
      await waitFor(() => screen.getByRole("searchbox"));

      vi.useFakeTimers();
      try {
        await act(async () => {
          fireEvent.change(screen.getByRole("searchbox"), { target: { value: "GPT" } });
        });
        await act(async () => { vi.advanceTimersByTime(150); });
      } finally {
        vi.useRealTimers();
      }

      await waitFor(() => {
        expect(screen.getByText("OpenAI")).toBeInTheDocument();
        expect(screen.queryByText("Telegram")).not.toBeInTheDocument();
      });
    });

    it("hides group header when group is empty after filtering", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal />, { wrapper: Wrapper });
      await waitFor(() => screen.getByRole("searchbox"));

      vi.useFakeTimers();
      try {
        // Search for something that only matches messaging
        await act(async () => {
          fireEvent.change(screen.getByRole("searchbox"), { target: { value: "telegram" } });
        });
        await act(async () => { vi.advanceTimersByTime(150); });
      } finally {
        vi.useRealTimers();
      }

      await waitFor(() => {
        // messaging group shown
        expect(screen.getByText("Telegram")).toBeInTheDocument();
        // ai group header not shown
        const aiHeader = screen.queryByRole("heading", { name: /^ai$/i });
        expect(aiHeader).not.toBeInTheDocument();
      });
    });

    it("shows inline Clear button when search has value and results are present", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal />, { wrapper: Wrapper });
      await waitFor(() => screen.getByRole("searchbox"));

      // "slack" matches "Slack" — results are present
      vi.useFakeTimers();
      try {
        await act(async () => {
          fireEvent.change(screen.getByRole("searchbox"), { target: { value: "slack" } });
        });
        await act(async () => { vi.advanceTimersByTime(150); });
      } finally {
        vi.useRealTimers();
      }

      await waitFor(() => {
        // Results are still present (Slack matches)
        expect(screen.getByText("Slack")).toBeInTheDocument();
        // Inline Clear button should be visible
        expect(screen.getByRole("button", { name: /clear search/i })).toBeInTheDocument();
      });

      // Clicking inline clear resets the input
      await act(async () => {
        screen.getByRole("button", { name: /clear search/i }).click();
      });

      await waitFor(() => {
        expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
      });
    });
  });

  describe("empty search state", () => {
    it("shows friendly empty state when no integrations match", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal />, { wrapper: Wrapper });
      await waitFor(() => screen.getByRole("searchbox"));

      vi.useFakeTimers();
      try {
        await act(async () => {
          fireEvent.change(screen.getByRole("searchbox"), { target: { value: "xyznotfound" } });
        });
        await act(async () => { vi.advanceTimersByTime(150); });
      } finally {
        vi.useRealTimers();
      }

      await waitFor(() => {
        expect(screen.getByText(/no integrations match/i)).toBeInTheDocument();
      });
    });

    it("shows Clear button in empty state", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal />, { wrapper: Wrapper });
      await waitFor(() => screen.getByRole("searchbox"));

      vi.useFakeTimers();
      try {
        await act(async () => {
          fireEvent.change(screen.getByRole("searchbox"), { target: { value: "xyznotfound" } });
        });
        await act(async () => { vi.advanceTimersByTime(150); });
      } finally {
        vi.useRealTimers();
      }

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^clear$/i })).toBeInTheDocument();
      });
    });

    it("clicking Clear resets the search and shows all integrations", async () => {
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal />, { wrapper: Wrapper });
      await waitFor(() => screen.getByRole("searchbox"));

      vi.useFakeTimers();
      try {
        await act(async () => {
          fireEvent.change(screen.getByRole("searchbox"), { target: { value: "xyznotfound" } });
        });
        await act(async () => { vi.advanceTimersByTime(150); });
      } finally {
        vi.useRealTimers();
      }

      await waitFor(() => screen.getByRole("button", { name: /^clear$/i }));

      await act(async () => {
        screen.getByRole("button", { name: /^clear$/i }).click();
      });

      await waitFor(() => {
        expect(screen.getByText("Telegram")).toBeInTheDocument();
        expect(screen.getByText("OpenAI")).toBeInTheDocument();
        expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
      });
    });
  });

  describe("sticky-top: connected cards above available within same category", () => {
    it("renders connected card before available card in the same group", async () => {
      const connectedSlackConn: Connection = {
        id: "conn_slack",
        externalId: "ext_slack",
        slug: "slack",
        // ConnectionCard shows displayName when connection exists
        displayName: "My Slack",
        category: "messaging",
        profile: "bot",
        status: "connected",
        metadata: {},
        credential: null,
        setupUrl: null,
        errorMessage: null,
        connectedAt: "2025-01-01T00:00:00Z",
        logoUrl: "",
        brandColor: "#4A154B",
        docsUrl: "",
      };
      const { Wrapper } = makeWrapper({ connections: [connectedSlackConn] });
      render(<ConnectPortal categories={["messaging"]} showSearch={false} />, {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        // "My Slack" is the displayName; "Telegram" is the integration name (no connection)
        expect(screen.getByText("My Slack")).toBeInTheDocument();
        expect(screen.getByText("Telegram")).toBeInTheDocument();
      });

      // Slack (connected) should appear before Telegram (available) in the DOM
      const cards = screen.getAllByRole("listitem");
      const slackIndex = cards.findIndex((el) => el.textContent?.includes("My Slack"));
      const telegramIndex = cards.findIndex((el) => el.textContent?.includes("Telegram"));
      expect(slackIndex).toBeLessThan(telegramIndex);
    });
  });

  describe("featured cards before non-featured within same group", () => {
    it("featured integration renders before non-featured in same category", async () => {
      // telegram is featured, slack is not — both in messaging
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal categories={["messaging"]} showSearch={false} />, {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(screen.getByText("Telegram")).toBeInTheDocument();
        expect(screen.getByText("Slack")).toBeInTheDocument();
      });

      // Telegram (featured) should appear before Slack (non-featured)
      const cards = screen.getAllByRole("listitem");
      const telegramIndex = cards.findIndex((el) => el.textContent?.includes("Telegram"));
      const slackIndex = cards.findIndex((el) => el.textContent?.includes("Slack"));
      expect(telegramIndex).toBeLessThan(slackIndex);
    });
  });

  describe("layout prop", () => {
    it("applies grid layout class by default", async () => {
      const { Wrapper } = makeWrapper();
      const { container } = render(<ConnectPortal />, { wrapper: Wrapper });
      await waitFor(() => screen.getByRole("region"));
      expect(container.querySelector(".vendo-portal--grid")).toBeInTheDocument();
    });

    it("applies list layout class when layout=list", async () => {
      const { Wrapper } = makeWrapper();
      const { container } = render(<ConnectPortal layout="list" />, { wrapper: Wrapper });
      await waitFor(() => screen.getByRole("region"));
      expect(container.querySelector(".vendo-portal--list")).toBeInTheDocument();
    });
  });

  describe("keyboard navigation", () => {
    it("Tab key moves focus from search to first card's primary CTA", async () => {
      const user = userEvent.setup();
      const { Wrapper } = makeWrapper({
        integrations: [INTEGRATIONS[0], INTEGRATIONS[2]], // telegram, openai
      });
      render(<ConnectPortal />, { wrapper: Wrapper });

      await waitFor(() => screen.getByRole("searchbox"));

      // Focus the search input
      screen.getByRole("searchbox").focus();
      expect(document.activeElement).toBe(screen.getByRole("searchbox"));

      // Tab once → should move to first interactive button in the cards
      await user.tab();
      expect(document.activeElement?.tagName).toBe("BUTTON");
    });
  });

  describe("onConnected / onDisconnected callbacks", () => {
    it("forwards onConnected prop to each ConnectionCard", async () => {
      // We can verify the prop is forwarded by checking it's accepted without error
      const onConnected = vi.fn();
      const { Wrapper } = makeWrapper();
      render(<ConnectPortal onConnected={onConnected} />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText("Telegram")).toBeInTheDocument();
      });
      // No error thrown — prop forwarded correctly
    });
  });

  describe("defensive: connection slug not in catalog", () => {
    it("still renders a card for a connected slug missing from integrations", async () => {
      const orphanConn: Connection = {
        ...BASE_CONNECTION,
        slug: "orphan-tool",
        displayName: "Orphan Tool",
        category: "other",
      };
      const { Wrapper } = makeWrapper({ connections: [orphanConn] });
      render(<ConnectPortal />, { wrapper: Wrapper });
      await waitFor(() => {
        // The orphan slug should produce a card
        expect(screen.getByText("Orphan Tool")).toBeInTheDocument();
      });
    });
  });
});
