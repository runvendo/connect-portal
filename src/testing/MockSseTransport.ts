import type { SseTransport, SseConnection, SseEvent } from "../sse/types.js";

/**
 * In-process SSE transport for tests.
 * Call `mock.emit(event)` to push an event through the connected transport.
 */
export class MockSseTransport implements SseTransport {
  private _connections: MockSseConnection[] = [];

  open(_opts: { url: string; bearer: string; lastEventId?: string }): SseConnection {
    const conn = new MockSseConnection();
    this._connections.push(conn);
    return conn;
  }

  emit(event: SseEvent): void {
    for (const conn of this._connections) {
      conn._dispatch(event);
    }
  }

  emitError(err: Error): void {
    for (const conn of this._connections) {
      conn._dispatchError(err);
    }
  }

  closeAll(): void {
    for (const conn of this._connections) {
      conn.close();
    }
    this._connections = [];
  }
}

class MockSseConnection implements SseConnection {
  private _eventHandlers: Array<(e: SseEvent) => void> = [];
  private _errorHandlers: Array<(err: Error) => void> = [];
  private _closed = false;

  onEvent(handler: (e: SseEvent) => void): void {
    this._eventHandlers.push(handler);
  }

  onError(handler: (err: Error) => void): void {
    this._errorHandlers.push(handler);
  }

  close(): void {
    this._closed = true;
  }

  get closed(): boolean {
    return this._closed;
  }

  _dispatch(event: SseEvent): void {
    if (this._closed) return;
    for (const h of this._eventHandlers) h(event);
  }

  _dispatchError(err: Error): void {
    if (this._closed) return;
    for (const h of this._errorHandlers) h(err);
  }
}
