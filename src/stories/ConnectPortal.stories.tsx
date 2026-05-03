import type { Meta, StoryObj } from "@storybook/react";
import { ConnectPortal } from "../components/ConnectPortal.js";
import { makeMockDecorator, makeConnection, SAMPLE_INTEGRATIONS } from "./_mockProvider.js";

const meta: Meta<typeof ConnectPortal> = {
  title: "Components/ConnectPortal",
  component: ConnectPortal,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof ConnectPortal>;

/** Default: all integrations, grid layout, search visible. */
export const Default: Story = {
  args: {},
  decorators: [makeMockDecorator({})],
};

/** With a connected integration — shows sticky-top ordering. */
export const WithConnectedIntegration: Story = {
  args: {},
  decorators: [
    makeMockDecorator({
      connections: [
        makeConnection("openai", { category: "ai", status: "connected", displayName: "My OpenAI" }),
      ],
    }),
  ],
};

/** Filtered to messaging category only. */
export const MessagingOnly: Story = {
  args: { categories: ["messaging"] },
  decorators: [makeMockDecorator({})],
};

/** List layout — compact cards in single column. */
export const ListLayout: Story = {
  args: { layout: "list" },
  decorators: [makeMockDecorator({})],
};

/** Search hidden. */
export const NoSearch: Story = {
  args: { showSearch: false },
  decorators: [makeMockDecorator({})],
};

/** Empty search state — the component renders the "No integrations match" message.
 *  To trigger: type a non-matching query in the Default story. This story seeds a small
 *  catalog so the "clear" button behavior is easy to see. */
export const EmptyState: Story = {
  args: {},
  decorators: [
    makeMockDecorator({
      integrations: [SAMPLE_INTEGRATIONS[0]], // only Telegram
    }),
  ],
};

/** Mobile viewport (375px wide). */
export const MobileGrid: Story = {
  args: {},
  parameters: { viewport: { defaultViewport: "mobile1" } },
  decorators: [makeMockDecorator({})],
};
