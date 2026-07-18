# Indexer：GitNexus & Graphify — 作法與規格

## 概覽

Cortex 透過「進行索引」功能，讓使用者對指定的本地目錄執行外部索引工具（**GitNexus** / **Graphify**），並以 **gRPC-over-WebSocket** 串流方式即時將工具的每行輸出推送至前端介面顯示。

---

## 架構

```
使用者輸入相對路徑
        │
        ▼
前端 IndexingPage
        │  WebSocket 連線（GET + query param）
        ▼
後端 Salvo WebSocket 端點
        │  tokio::process::Command
        ▼
  gitnexus index <full_path>
  graphify index <full_path>
        │  stdout / stderr 逐行
        ▼
後端 BufReader::lines() 逐行讀取
        │  JSON IndexEvent 串流
        ▼
前端 WebSocket onmessage → 終端機樣式日誌面板
```

### 傳輸層：gRPC-over-WebSocket

| 面向 | 說明 |
|------|------|
| 協議 | WebSocket（RFC 6455） |
| 訊息格式 | JSON（與 proto 定義相容） |
| 方向 | 主要為 server → client 串流（一個請求、多個回應） |
| 優點 | 瀏覽器原生支援，無需 Envoy proxy，同 port（54322） |

---

## Proto-compatible 訊息合約

雖未使用 `.proto` 檔案生成程式碼，但訊息結構與以下 proto 定義完全相容，方便日後升級為原生 gRPC：

```proto
syntax = "proto3";
package cortex.indexing;

service IndexingService {
  rpc RunGitNexus(IndexRequest) returns (stream IndexEvent);
  rpc RunGraphify(IndexRequest) returns (stream IndexEvent);
}

message IndexRequest {
  string relative_path = 1;
}

message IndexEvent {
  enum EventType {
    PROGRESS = 0;
    COMPLETE = 1;
    ERROR    = 2;
  }
  EventType type      = 1;
  string    message   = 2;
  string    full_path = 3;
}
```

### JSON 訊息範例

**連線建立後**（前端本地產生，非後端傳送）：
```json
{ "type": "PROGRESS", "message": "已建立連線，等待後端回應…", "full_path": "" }
```

**後端串流事件**：
```json
{ "type": "PROGRESS", "message": "Starting `gitnexus` on /data/workspace/projects/my-repo …", "full_path": "/data/workspace/projects/my-repo" }
{ "type": "PROGRESS", "message": "Indexing file: src/main.rs", "full_path": "/data/workspace/projects/my-repo" }
{ "type": "PROGRESS", "message": "[stderr] warning: large file skipped", "full_path": "..." }
{ "type": "COMPLETE", "message": "索引完成 ✓", "full_path": "/data/workspace/projects/my-repo" }
```

**失敗情況**：
```json
{ "type": "ERROR", "message": "索引失敗，exit code: 1", "full_path": "..." }
{ "type": "ERROR", "message": "Failed to start `gitnexus`: No such file or directory", "full_path": "..." }
```

---

## 後端規格

### 環境設定

`.env` 中新增：
```
WORK_ROOT=/data/workspace
```

`AppConfig` 對應欄位（`backend/src/config/mod.rs`）：
```rust
pub work_root: String,  // 從 WORK_ROOT env var 讀取，預設為 "./"
```

完整目錄路徑計算方式：
```
full_path = WORK_ROOT.trim_end_matches('/') + "/" + relative_path.trim_matches('/')
```

### API 端點

| Method | Path | 說明 |
|--------|------|------|
| `GET` | `/cortex/api/v0.85/indexing/ws/gitnexus?relative_path=<rel>` | WebSocket 升級，執行 `gitnexus index <path>` |
| `GET` | `/cortex/api/v0.85/indexing/ws/graphify?relative_path=<rel>` | WebSocket 升級，執行 `graphify index <path>` |
| `GET` | `/cortex/api/v0.85/indexing/ws/gitnexus/serve` | WebSocket 升級，執行 `gitnexus serve`（長期執行，HTTP server port 4747） |
| `GET` | `/cortex/api/v0.85/indexing/ws/graphify/extract?relative_path=<rel>` | WebSocket 升級，執行 `graphify extract <path>`（完整 AST + LLM 語意萃取） |

> [!NOTE]
> WebSocket 升級請求不能攜帶 body，因此 `relative_path` 以 **query string** 傳遞。

### 後端實作（`backend/src/api/indexing.rs`）

```rust
// Salvo WebSocket 升級
WebSocketUpgrade::new()
    .upgrade(req, res, move |ws| async move {
        run_indexer(ws, "gitnexus", &["index"], full_path).await;
    })
    .await
```

`run_indexer` 的執行流程：
1. 分割 WebSocket 為 `sink`（寫）、`stream`（讀）
2. 立即推送 PROGRESS「Starting …」
3. `tokio::process::Command::new(cmd).args(args).arg(&full_path).stdout(piped).stderr(piped).spawn()`
4. 逐行讀取 stdout → `IndexEvent { type: PROGRESS, message: line }`
5. 逐行讀取 stderr → `IndexEvent { type: PROGRESS, message: "[stderr] " + line }`
6. `child.wait()` → exit code 0 → COMPLETE；其餘 → ERROR
7. 若 client 中途斷線（`sink.send()` 失敗）→ `child.kill()`

### Cargo 依賴

```toml
salvo = { version = "0.74", features = ["...", "websocket"] }
```

追加的 trait import（必要）：
```rust
use futures_util::{StreamExt, SinkExt};  // SinkExt 提供 .send() 方法
```

### 路由掛載（`backend/src/api/router.rs`）

```rust
.push(indexing::router())
// → Router::with_path("indexing")
//     .push(Router::with_path("ws/gitnexus").get(ws_gitnexus))
//     .push(Router::with_path("ws/graphify").get(ws_graphify))
```

---

## 前端規格

### 套件與模組

無需新增第三方套件，使用瀏覽器原生 `WebSocket` API。

| 檔案 | 用途 |
|------|------|
| [`frontend/src/grpc/indexingWsClient.ts`](file:///Volumes/workspace/ai/application/cortex/frontend/src/grpc/indexingWsClient.ts) | gRPC-over-WebSocket 客戶端（底層） |
| [`frontend/src/pages/IndexingPage.tsx`](file:///Volumes/workspace/ai/application/cortex/frontend/src/pages/IndexingPage.tsx) | 使用者介面頁面 |
| [`frontend/src/services/api.ts`](file:///Volumes/workspace/ai/application/cortex/frontend/src/services/api.ts) | `indexingApi.gitNexusWsUrl()` / `graphifyWsUrl()` URL 工廠 |

### WebSocket 客戶端（`indexingWsClient.ts`）

```typescript
export function openIndexingStream(wsUrl: string, callbacks: StreamCallbacks): () => void
```

- `onopen`：產生本地 PROGRESS 事件（「已建立連線」）
- `onmessage`：解析 JSON `IndexEvent`；收到 COMPLETE 或 ERROR 後自動關閉 socket
- `onerror`：產生 ERROR 事件
- 返回值：cleanup 函式（`ws.close()`）供 React useEffect 使用

### React Hook（`useIndexingStream`）

```typescript
function useIndexingStream(wsUrlFactory: (path: string) => string)
  : { job: JobState; start: (relPath: string) => void; reset: () => void }
```

狀態機：

```
idle ──start()──▶ connecting
                    │ onopen
                    ▼
                 streaming ←── PROGRESS events
                    │
          ┌─────────┴────────┐
       COMPLETE            ERROR
          │                  │
          ▼                  ▼
       complete            error
```

任何時候呼叫 `reset()` → 關閉現有 WebSocket → 回到 idle。

### URL 組合

```typescript
// frontend/src/config/env.ts 中已有
export const WS_BASE_URL = `ws://${env.BACKEND_HOST}:${env.BACKEND_PORT}${env.API_PREFIX}`;

// indexingApi
gitNexusWsUrl: (relative_path) =>
  `${WS_BASE_URL}/indexing/ws/gitnexus?relative_path=${encodeURIComponent(relative_path)}`
```

### UI 元件

```
IndexingPage
├── 路徑輸入框（relative_path）
│     └── 執行中鎖定輸入
├── IndexCard（GitNexus）
│   ├── StatusBadge（idle/connecting/streaming/complete/error）
│   ├── 執行按鈕（執行中顯示 spinner）
│   └── LogPanel（終端機深色背景，自動捲動）
└── IndexCard（Graphify）
    └── （同上）
```

`LogPanel` 顏色規則：

| 事件類型 | 顏色 |
|---------|------|
| `PROGRESS` | `text-gray-300` |
| `COMPLETE` | `text-emerald-400 font-semibold` |
| `ERROR` | `text-red-400` |

---

## 路由與導覽

### 後端路由

已掛載於現有 REST API prefix 下（port 54322），不需要額外 port。

### 前端路由

| 路徑 | 元件 |
|------|------|
| `/cortex/documents/indexing` | `IndexingPage` |

### 側邊欄子選單

文件管理（`/cortex/documents`）→ 子項「進行索引」（`FolderSearch` 圖示）

i18n keys：
- `zh-TW`：`"nav.documents.indexing": "進行索引"`
- `en`：`"nav.documents.indexing": "Run Indexing"`

---

## 注意事項

> [!IMPORTANT]
> `gitnexus` 與 `graphify` CLI 工具必須存在於後端執行環境的 `$PATH` 中。如果工具不存在，後端會傳送 `ERROR` 事件（`Failed to start: No such file or directory`）而不會 panic。

> [!NOTE]
> stdout 與 stderr 是**循序讀取**（先 stdout 讀完再讀 stderr），非交錯輸出。若需要真正交錯的 stdout/stderr 串流，可改用 `tokio::select!` 同時監聽兩個 stream。

> [!NOTE]
> 若 CLI 工具的命令列參數格式不同（例如 `graphify --path <path>` 而非 `graphify index <path>`），修改 `run_indexer` 呼叫中的 `args` 參數即可：
> ```rust
> run_indexer(ws, "graphify", &["--path"], full_path).await;
> ```
