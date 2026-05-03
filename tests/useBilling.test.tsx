import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { VendoProvider } from "../src/VendoProvider.js";
import { useBilling } from "../src/hooks/useBilling.js";
import { MockClient } from "../src/testing/MockClient.js";
import { MockSseTransport } from "../src/testing/MockSseTransport.js";
import { VendoProviderMissingError } from "../src/context.js";

describe("useBilling", () => {
  it("returns balance and caps after initial load", async () => {
    const client = new MockClient({
      balance: { creditsRemainingMicros: 2_000_000, currency: "USD", topUpUrl: "" },
      caps: { dailyMicros: 100_000, monthlyMicros: null, usedTodayMicros: 0, usedMonthMicros: 0 },
    });
    const sse = new MockSseTransport();

    function Billing(): React.ReactElement {
      const { balance, caps, status } = useBilling();
      return (
        <div>
          <span data-testid="status">{status}</span>
          <span data-testid="balance">{balance?.creditsRemainingMicros ?? "null"}</span>
          <span data-testid="daily">{caps?.dailyMicros ?? "null"}</span>
        </div>
      );
    }

    render(
      <VendoProvider client={client} sseTransport={sse}>
        <Billing />
      </VendoProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("ready"),
    );

    expect(screen.getByTestId("balance").textContent).toBe("2000000");
    expect(screen.getByTestId("daily").textContent).toBe("100000");
  });

  it("throws VendoProviderMissingError when used outside provider", () => {
    function BareHook(): React.ReactElement {
      const { balance } = useBilling();
      return <span>{balance?.creditsRemainingMicros}</span>;
    }

    expect(() => render(<BareHook />)).toThrow(VendoProviderMissingError);
  });
});
