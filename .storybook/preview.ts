import type { Preview } from "@storybook/react";
import "../src/components/styles.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#ffffff" },
        { name: "muted", value: "#f8f8fa" },
      ],
    },
  },
};

export default preview;
