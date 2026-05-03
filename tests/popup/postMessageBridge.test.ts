import { describe, it, expect } from "vitest";
import { expectedOrigin, validateMessage } from "../../src/popup/postMessageBridge.js";

describe("expectedOrigin", () => {
  it("strips /api suffix from base URL", () => {
    expect(expectedOrigin("https://vendo.run/api")).toBe("https://vendo.run");
  });

  it("strips /api/ with trailing slash", () => {
    expect(expectedOrigin("https://vendo.run/api/")).toBe("https://vendo.run");
  });

  it("returns origin as-is when no /api suffix", () => {
    expect(expectedOrigin("https://api.vendo.run")).toBe("https://api.vendo.run");
  });

  it("handles localhost for dev", () => {
    expect(expectedOrigin("http://localhost:3000/api")).toBe("http://localhost:3000");
  });
});

describe("validateMessage", () => {
  const expectedOrig = "https://vendo.run";
  const expectedSlug = "telegram";

  function makeEvent(overrides: {
    origin?: string;
    type?: string;
    slug?: string;
    connectionId?: string;
  } = {}): MessageEvent {
    return {
      origin: overrides.origin ?? expectedOrig,
      data: {
        type: overrides.type ?? "vendo:connection-completed",
        slug: overrides.slug ?? expectedSlug,
        connectionId: overrides.connectionId ?? "conn_123",
      },
    } as unknown as MessageEvent;
  }

  it("returns ok:true for a valid message", () => {
    const result = validateMessage(makeEvent(), expectedOrig, expectedSlug);
    expect(result).toEqual({ ok: true, data: { type: "vendo:connection-completed", slug: expectedSlug, connectionId: "conn_123" } });
  });

  it("returns ok:false with origin_mismatch when origin is wrong", () => {
    const result = validateMessage(makeEvent({ origin: "https://evil.com" }), expectedOrig, expectedSlug);
    expect(result).toEqual({ ok: false, reason: "origin_mismatch" });
  });

  it("returns ok:false with unexpected_type when type is wrong", () => {
    const result = validateMessage(makeEvent({ type: "vendo:something-else" }), expectedOrig, expectedSlug);
    expect(result).toEqual({ ok: false, reason: "unexpected_type" });
  });

  it("returns ok:false with slug_mismatch when slug differs", () => {
    const result = validateMessage(makeEvent({ slug: "github" }), expectedOrig, expectedSlug);
    expect(result).toEqual({ ok: false, reason: "slug_mismatch" });
  });
});
