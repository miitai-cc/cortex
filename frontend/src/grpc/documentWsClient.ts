export type DocumentEventType = 'PROGRESS' | 'COMPLETE' | 'ERROR';

export interface DocumentIndexEvent {
  type: DocumentEventType;
  stage: string;
  message: string;
  documentId?: string;
  status: 'processing' | 'indexed' | 'failed';
  progress: number;
  result?: {
    document?: Record<string, unknown>;
    initialDocument?: Record<string, unknown>;
    indexMethod?: string;
  };
}

export function uploadDocumentStream(
  wsUrl: string,
  file: File,
  onEvent: (event: DocumentIndexEvent) => void,
): Promise<DocumentIndexEvent> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    let settled = false;

    ws.onopen = async () => {
      try {
        ws.send(await file.arrayBuffer());
      } catch (error) {
        settled = true;
        ws.close();
        reject(error);
      }
    };

    ws.onmessage = (message) => {
      try {
        const event = JSON.parse(String(message.data)) as DocumentIndexEvent;
        onEvent(event);
        if (event.type === 'COMPLETE') {
          settled = true;
          resolve(event);
          ws.close();
        } else if (event.type === 'ERROR') {
          settled = true;
          reject(new Error(event.message));
          ws.close();
        }
      } catch (error) {
        if (!settled) reject(error);
        settled = true;
        ws.close();
      }
    };

    ws.onerror = () => {
      if (!settled) reject(new Error('文件索引 WebSocket 連線失敗'));
      settled = true;
    };

    ws.onclose = () => {
      if (!settled) reject(new Error('文件索引連線在完成前關閉'));
      settled = true;
    };
  });
}
