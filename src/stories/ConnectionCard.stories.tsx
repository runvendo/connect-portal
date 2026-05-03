import type { Meta, StoryObj } from "@storybook/react";
import { ConnectionCard } from "../components/ConnectionCard.js";
import { makeMockDecorator, makeConnection } from "./_mockProvider.js";

const meta: Meta<typeof ConnectionCard> = {
  title: "Components/ConnectionCard",
  component: ConnectionCard,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof ConnectionCard>;

// ── 6 states × comfortable (default) ─────────────────────────────────────────

export const Available: Story = {
  args: { slug: "telegram" },
  decorators: [makeMockDecorator({ connections: [] })],
};

export const Connecting: Story = {
  args: { slug: "telegram" },
  // Simulate in-flight state by providing no popup resolution
  decorators: [makeMockDecorator({ connections: [] })],
};

export const PendingSetup: Story = {
  args: { slug: "telegram" },
  decorators: [
    makeMockDecorator({
      connections: [makeConnection("telegram", { status: "pending_setup" })],
    }),
  ],
};

export const Connected: Story = {
  args: { slug: "telegram" },
  decorators: [
    makeMockDecorator({
      connections: [makeConnection("telegram", { status: "connected", displayName: "My Bot" })],
    }),
  ],
};

export const NeedsReauth: Story = {
  args: { slug: "telegram" },
  decorators: [
    makeMockDecorator({
      connections: [makeConnection("telegram", { status: "needs_reauth" })],
    }),
  ],
};

export const Error: Story = {
  args: { slug: "telegram" },
  decorators: [
    makeMockDecorator({
      connections: [
        makeConnection("telegram", { status: "error", errorMessage: "Token expired upstream" }),
      ],
    }),
  ],
};

// ── Compact variants ──────────────────────────────────────────────────────────

export const AvailableCompact: Story = {
  args: { slug: "telegram", compact: true },
  decorators: [makeMockDecorator({ connections: [] })],
};

export const ConnectedCompact: Story = {
  args: { slug: "telegram", compact: true },
  decorators: [
    makeMockDecorator({
      connections: [makeConnection("telegram", { status: "connected", displayName: "My Bot" })],
    }),
  ],
};
