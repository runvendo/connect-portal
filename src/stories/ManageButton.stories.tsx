import type { Meta, StoryObj } from "@storybook/react";
import { ManageButton } from "../components/ManageButton.js";
import { makeMockDecorator, makeConnection } from "./_mockProvider.js";

const meta: Meta<typeof ManageButton> = {
  title: "Components/ManageButton",
  component: ManageButton,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof ManageButton>;

export const Connected: Story = {
  args: { slug: "telegram" },
  decorators: [
    makeMockDecorator({
      connections: [makeConnection("telegram", { status: "connected" })],
    }),
  ],
};

export const NoConnection: Story = {
  args: { slug: "telegram" },
  decorators: [makeMockDecorator({ connections: [] })],
};
