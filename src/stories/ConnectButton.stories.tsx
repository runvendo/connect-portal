import type { Meta, StoryObj } from "@storybook/react";
import { ConnectButton } from "../components/ConnectButton.js";
import { makeMockDecorator } from "./_mockProvider.js";

const meta: Meta<typeof ConnectButton> = {
  title: "Components/ConnectButton",
  component: ConnectButton,
  decorators: [makeMockDecorator({})],
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof ConnectButton>;

export const Default: Story = {
  args: { slug: "telegram" },
};

export const CustomLabel: Story = {
  args: { slug: "slack", children: "Connect Slack" },
};
