import type { SseTransport, SseConnection, SseEvent } from "./types.js";

export const fetchTransport: SseTransport = {
  open({ url, bearer, lastEventId }): SseConnection {
    const ac = new AbortController();
    let eventHandler: ((e: SseEvent) => void) | null = null;
    let errorHandler: ((err: Error) => void) | null = null;
    let lastId: string | undefined = lastEventId;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const BACKOFF_BASE = 1000;
    const BACKOFF_CAP = 30_000;

    function scheduleReconnect(attempt: number): void {
      const delay = Math.min(BACKOFF_BASE * 2 ** attempt, BACKOFF_CAP);
      reconnectTimer = setTimeout(() => connect(attempt + 1), delay);
    }

    async function connect(attempt: number): Promise<void> {
      if (ac.signal.aborted) return;

      const headers: Record<string, string> = {
        Authorization: `Bearer ${bearer}`,
        Accept: "text/event-stream",
      };
      if (lastId) headers["Last-Event-ID"] = lastId;

      let res: Response;
      try {
        res = await fetch(url, { headers, signal: ac.signal });
      } catch (err) {
        if (ac.signal.aborted) return;
        errorHandler?.(err instanceof Error ? err : new Error(String(err)));
        scheduleReconnect(attempt);
        return;
      }

      if (!res.ok || !res.body) {
        // Non-retryable 4xx: report error and stop reconnecting to avoid burning the bearer
        if (res.status >= 400 && res.status < 500) {
          errorHandler?.(new Error(`SSE auth/client error: ${res.status}`));
          return;
        }
        const err = new Error(`SSE connect failed: ${res.status}`);
        errorHandler?.(err);
        scheduleReconnect(attempt);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        if (ac.signal.aborted) {
          reader.cancel();
          return;
        }

        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch (err) {
          if (ac.signal.aborted) return;
          errorHandler?.(err instanceof Error ? err : new Error(String(err)));
          scheduleReconnect(attempt);
          return;
        }

        if (chunk.done) {
          if (!ac.signal.aborted) scheduleReconnect(0);
          return;
        }

        // Normalize CRLF to LF per SSE spec before buffering
        const decoded = decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, "\n");
        buf += decoded;
        const blocks = buf.split("\n\n");
        buf = blocks.pop() ?? "";

        for (const block of blocks) {
          if (!block.trim()) continue;

          const dataLines: string[] = [];
          let eventId: string | undefined;

          for (const line of block.split("\n")) {
            // SSE comments (lines starting with ':') and blank lines are skipped
            if (line === "" || line.startsWith(":")) continue;

            const colon = line.indexOf(":");
            if (colon === -1) continue;
            const key = line.slice(0, colon).trim();
            const val = line.slice(colon + 1).trimStart();

            if (key === "id") {
              eventId = val;
            } else if (key === "data") {
              // Accumulate multi-line data per SSE spec (joined with \n)
              dataLines.push(val);
            }
          }

          if (eventId !== undefined) lastId = eventId;

          if (dataLines.length > 0) {
            try {
              const ev = JSON.parse(dataLines.join("\n")) as SseEvent;
              eventHandler?.(ev);
            } catch {
              // malformed data; ignore
            }
          }
        }
      }
    }

    connect(0);

    return {
      onEvent(handler) { eventHandler = handler; },
      onError(handler) { errorHandler = handler; },
      close() {
        if (reconnectTimer !== null) clearTimeout(reconnectTimer);
        ac.abort();
      },
    };
  },
};
