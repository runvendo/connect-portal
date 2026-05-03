/** Thrown when a postMessage arrives from an unexpected origin. */
export class OriginMismatchError extends Error {
  readonly received: string;
  readonly expected: string;

  constructor(received: string, expected: string) {
    super(`Origin mismatch: expected "${expected}", got "${received}"`);
    this.name = "OriginMismatchError";
    this.received = received;
    this.expected = expected;
  }
}

/** Resolved (not thrown) when the popup closes before completing — kept as an error class for explicit error paths. */
export class PopupClosedError extends Error {
  constructor() {
    super("Popup closed before connection completed");
    this.name = "PopupClosedError";
  }
}

/** Resolved (not thrown) when the popup times out. */
export class ConnectTimeoutError extends Error {
  constructor() {
    super("Connect popup timed out");
    this.name = "ConnectTimeoutError";
  }
}
