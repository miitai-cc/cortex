/**
 * gRPC-over-WebSocket indexing client
 *
 * Proto-compatible message contract (JSON):
 *
 * Server → Client stream:
 *   { type: "PROGRESS" | "COMPLETE" | "ERROR", message: string, full_path: string }
 */

export type EventType = 'PROGRESS' | 'COMPLETE' | 'ERROR';

export interface IndexEvent {
  type: EventType;
  message: string;
  full_path: string;
}

export interface StreamCallbacks {
  onEvent: (event: IndexEvent) => void;
  onClose?: () => void;
  onError?: (err: Event | string) => void;
}

/**
 * Open a WebSocket gRPC stream and call the provided callbacks for each event.
 * Returns a cleanup function that closes the socket.
 */
export function openIndexingStream(wsUrl: string, callbacks: StreamCallbacks): () => void {
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    callbacks.onEvent({
      type: 'PROGRESS',
      message: '已建立連線，等待後端回應…',
      full_path: '',
    });
  };

  ws.onmessage = (e: MessageEvent) => {
    try {
      const event: IndexEvent = JSON.parse(e.data as string);
      callbacks.onEvent(event);
      // Auto-close on terminal events
      if (event.type === 'COMPLETE' || event.type === 'ERROR') {
        ws.close();
      }
    } catch {
      callbacks.onEvent({ type: 'PROGRESS', message: e.data as string, full_path: '' });
    }
  };

  ws.onerror = (e) => {
    callbacks.onError?.(e);
    callbacks.onEvent({ type: 'ERROR', message: '連線發生錯誤', full_path: '' });
  };

  ws.onclose = () => {
    callbacks.onClose?.();
  };

  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  };
}
