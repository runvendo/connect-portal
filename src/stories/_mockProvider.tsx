import React from "react";
import type { Decorator } from "@storybook/react";
import type { Connection, Integration } from "@vendodev/sdk";
import { VendoProvider } from "../VendoProvider.js";
import { MockClient } from "../testing/MockClient.js";
import { MockSseTransport } from "../testing/MockSseTransport.js";

export const SAMPLE_INTEGRATIONS: Integration[] = [
  {
    slug: "telegram",
    name: "Telegram",
    description: "Telegram bot messaging",
    category: "messaging",
    logoUrl: null,
    brandColor: "#0088cc",
    docsUrl: "https://docs.vendo.run/telegram",
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
    docsUrl: "https://docs.vendo.run/slack",
    supportedProfiles: ["bot"],
    defaultProfile: "bot",
    enabled: true,
    featured: false,
  },
  {
    slug: "openai",
    name: "OpenAI",
    description: "OpenAI GPT models API",
    category: "ai",
    logoUrl: null,
    brandColor: "#10a37f",
    docsUrl: "https://docs.vendo.run/openai",
    supportedProfiles: ["api"],
    defaultProfile: "api",
    enabled: true,
    featured: true,
  },
  {
    slug: "gdrive",
    name: "Google Drive",
    description: "Store and retrieve files in Google Drive",
    category: "storage",
    logoUrl: null,
    brandColor: "#4285F4",
    docsUrl: "https://docs.vendo.run/gdrive",
    supportedProfiles: ["oauth"],
    defaultProfile: "oauth",
    enabled: true,
    featured: false,
  },
  {
    slug: "notion",
    name: "Notion",
    description: "Notion pages and databases",
    category: "productivity",
    logoUrl: null,
    brandColor: "#000000",
    docsUrl: "https://docs.vendo.run/notion",
    supportedProfiles: ["oauth"],
    defaultProfile: "oauth",
    enabled: true,
    featured: false,
  },
];

export function makeMockDecorator(opts: {
  connections?: Connection[];
  integrations?: Integration[];
}): Decorator {
  const client = new MockClient({
    connections: opts.connections ?? [],
    integrations: opts.integrations ?? SAMPLE_INTEGRATIONS,
  });
  const sse = new MockSseTransport();

  return (Story) => (
    <VendoProvider client={client} sseTransport={sse}>
      <Story />
    </VendoProvider>
  );
}

/** Base 36 unique id helper for connection fixtures. */
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function makeConnection(
  slug: string,
  overrides: Partial<Connection> = {},
): Connection {
  return {
    id: `conn_${uid()}`,
    externalId: `ext_${uid()}`,
    slug,
    displayName: slug.charAt(0).toUpperCase() + slug.slice(1),
    category: "messaging",
    profile: "bot",
    status: "connected",
    metadata: {},
    credential: null,
    setupUrl: null,
    errorMessage: null,
    connectedAt: "2025-01-01T00:00:00Z",
    logoUrl: "",
    brandColor: "",
    docsUrl: "",
    ...overrides,
  };
}
