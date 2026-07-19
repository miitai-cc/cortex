export type CodexPromptEventType =
  | 'CONNECTED'
  | 'STARTED'
  | 'PROGRESS'
  | 'COMPLETE'
  | 'ERROR'
  | 'CANCELLED';

export interface CodexPromptEvent {
  type: CodexPromptEventType;
  jobId: string;
  message: string;
  stream?: 'stdout' | 'stderr';
  sourceType?: string;
}

export interface CodexPromptCallbacks {
  onEvent: (event: CodexPromptEvent) => void;
  onClose?: () => void;
  onError?: (message: string) => void;
}

export interface CodexPromptStream {
  cancel: () => void;
  disconnect: () => void;
}

export function openCodexPromptStream(
  wsUrl: string,
  prompt: string,
  callbacks: CodexPromptCallbacks,
): CodexPromptStream {
  const socket = new WebSocket(wsUrl);
  let terminal = false;
  let cancelRequested = false;

  socket.onopen = () => {
    socket.send(JSON.stringify({ prompt }));
  };
  socket.onmessage = (message) => {
    try {
      const event = JSON.parse(String(message.data)) as CodexPromptEvent;
      callbacks.onEvent(event);
      if (event.type === 'COMPLETE' || event.type === 'ERROR' || event.type === 'CANCELLED') {
        terminal = true;
        socket.close();
      }
    } catch {
      callbacks.onEvent({
        type: 'PROGRESS',
        jobId: '',
        message: String(message.data),
        stream: 'stdout',
      });
    }
  };
  socket.onerror = () => {
    if (!terminal) callbacks.onError?.('Codex WebSocket 連線失敗');
  };
  socket.onclose = () => {
    if (!terminal && !cancelRequested) callbacks.onError?.('Codex 串流在完成前中斷');
    callbacks.onClose?.();
  };

  return {
    cancel: () => {
      if (terminal || cancelRequested) return;
      cancelRequested = true;
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action: 'cancel' }));
      } else if (socket.readyState === WebSocket.CONNECTING) {
        socket.addEventListener('open', () => socket.send(JSON.stringify({ action: 'cancel' })), { once: true });
      }
    },
    disconnect: () => {
      if (socket.readyState === WebSocket.OPEN && !terminal) {
        socket.send(JSON.stringify({ action: 'cancel' }));
      }
      socket.close();
    },
  };
}

