export type SseEvent =
  | { id: string; at: string; kind: "connection.connected"; slug: string; connection_id: string }
  | { id: string; at: string; kind: "connection.disconnected"; slug: string; connection_id: string }
  | { id: string; at: string; kind: "connection.changed"; slug: string; connection_id: string }
  | { id: string; at: string; kind: "connection.status_changed"; slug: string; connection_id: string; status: string }
  | { id: string; at: string; kind: "billing.usage_recorded"; provider: string; micros: number }
  | { id: string; at: string; kind: "billing.balance_changed"; remaining_micros: number }
  | { id: string; at: string; kind: "billing.cap_warned"; window: "daily" | "monthly"; pct: number }
  | { id: string; at: string; kind: "billing.cap_tripped"; window: "daily" | "monthly" };

export interface SseTransport {
  open(opts: { url: string; bearer: string; lastEventId?: string }): SseConnection;
}

export interface SseConnection {
  onEvent(handler: (e: SseEvent) => void): void;
  onError(handler: (err: Error) => void): void;
  close(): void;
}
