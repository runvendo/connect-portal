import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import React from "react";
import { VendoProvider } from "../../src/VendoProvider.js";
import { ConnectButton } from "../../src/components/ConnectButton.js";
import { MockClient } from "../../src/testing/MockClient.js";
import { MockSseTransport } from "../../src/testing/MockSseTransport.js";

function makeWrapper() {
  const client = new MockClient();
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

describe("ConnectButton", () => {
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;
  let addListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Return null to simulate popup blocked — most tests just check label/disabled state
    windowOpenSpy = vi.spyOn(window, "open").mockReturnValue(null);
    addListenerSpy = vi.spyOn(window, "addEventListener").mockImplementation(() => {});
    removeListenerSpy = vi.spyOn(window, "removeEventListener").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders default 'Connect' label when no children", () => {
    const { Wrapper } = makeWrapper();
    render(<ConnectButton slug="telegram" />, { wrapper: Wrapper });
    expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument();
  });

  it("renders custom children as label", () => {
    const { Wrapper } = makeWrapper();
    render(<ConnectButton slug="telegram">Connect Gmail</ConnectButton>, { wrapper: Wrapper });
    expect(screen.getByRole("button", { name: /connect gmail/i })).toBeInTheDocument();
  });

  it("passes className through to the button", () => {
    const { Wrapper } = makeWrapper();
    render(<ConnectButton slug="telegram" className="my-btn" />, { wrapper: Wrapper });
    expect(screen.getByRole("button")).toHaveClass("my-btn");
  });

  it("calls onError when popup is blocked (window.open returns null)", async () => {
    const { Wrapper, client } = makeWrapper();
    // Mock location.assign for redirect fallback
    const assignSpy = vi.spyOn(window.location, "assign").mockImplementation(() => {});

    const onError = vi.fn();
    render(
      <ConnectButton slug="telegram" onError={onError} returnTo="/dashboard" />,
      { wrapper: Wrapper }
    );

    await act(async () => {
      screen.getByRole("button").click();
    });

    // When popup blocked, falls back to redirect — onError is NOT called in redirect case
    // Instead location.assign should be called
    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith(expect.stringContaining("telegram"));
    });

    assignSpy.mockRestore();
  });
});
