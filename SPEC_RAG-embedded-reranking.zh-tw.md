# Embedded 與 Reranking AI 模型運作說明

## 概述

本系統透過兩種 AI 模型協作實現 RAG（Retrieval-Augmented Generation）：

```
Embedding Model ──→ 向量化文件與查詢 → 向量資料庫相似度搜尋
     ↓
Reranking Model ──→ 對初篩結果二次排序 → 提高精準度
     ↓
LLM ──────────────→ 根據檢索結果生成最終回答
```

---

## 一、Embedding 模型：向量化引擎

### 角色

將文字轉換為固定維度的浮點數向量（embedding），使語義相似的文字在向量空間中距離相近。這是向量檢索的基礎。

### 運作流程

#### 文件索引階段（寫入）

```
使用者上傳文件
       ↓
  POST /api/documents/upload
       ↓
  parser::parse_file()        ← 依副檔名選擇解析器
       ↓ 純文字
  chunker::chunk_text()       ← 依 chunk_size + overlap 切割
       ↓ 文字區塊
  EmbeddingService::embed()   ← 呼叫 embedding API
       ↓ 向量 (Vec<f32>)
  Qdrant::upsert_points()     ← 存入 Qdrant collection "documents"
```

程式碼位置：`backend/src/api/documents.rs:103-133`（`index_document` 函式）

#### 查詢階段（讀取）

```
使用者輸入查詢
       ↓
  POST /api/rag/query
       ↓
  EmbeddingService::embed(query)    ← 將查詢文字向量化
       ↓ 查詢向量
  Qdrant::search_points()           ← 在 collection 中搜尋最相近的 top_k 個向量
       ↓ 初篩結果 (含 cosine score)
  (進入 Reranking 階段)
```

程式碼位置：`backend/src/api/rag.rs:30-47`

### 支援的模型

| 模型 | 維度 | 大小 | 語言 |
|------|------|------|------|
| `BAAI/bge-small-zh-v1.5` | 512 | ~33MB | 繁體中文 + 英文 |
| `intfloat/multilingual-e5-small` | 384 | ~118MB | 多語言含繁中 |
| `sentence-transformers/all-MiniLM-L6-v2` | 384 | ~80MB | 英文 |

### 設定方式

```bash
# backend/.env
EMBEDDING_MODEL=BAAI/bge-small-zh-v1.5
```

### 文字分塊（Chunking）

在 Embedding 之前，文件必須先切割成小區塊：

```
chunk_size = 512 字元
chunk_overlap = 128 字元

文件 ─→ [chunk1] ←── overlap ──→ [chunk2] ←── overlap ──→ [chunk3] ...
        1~512                   384~896                   768~1280
```

- 區塊邊界盡量在句號、問號、驚嘆號、換行等自然邊界處斷開（中英文皆支援）
- Overlap 確保跨區塊的語義不遺失

程式碼位置：`backend/src/rag/chunker.rs`

---

## 二、Reranking 模型：精準度優化

### 角色

Embedding 的向量搜尋雖然快速，但可能召回與查詢語義相關但不精確的結果。Reranker 是一個 cross-encoder，同時接受「查詢 + 候選文件」作為輸入，輸出更準確的相關性分數。

### 與 Embedding 的差異

| 特性 | Embedding | Reranking |
|------|-----------|-----------|
| 架構 | bi-encoder（各自獨立編碼） | cross-encoder（共同編碼） |
| 速度 | 快（向量可預先計算） | 慢（需即時計算每對組合） |
| 精準度 | 中等 | 高 |
| 使用時機 | 海量資料初篩 | 少量候選精排 |

### 運作流程

```
Qdrant search 回傳 top_k 個候選區塊
       ↓
  取出各區塊的文字內容
       ↓
  RerankerService::rerank(query, candidates)
       ↓
  對每個 (query, candidate[i]) 產出 relevance_score
       ↓
  依 score 重新排序 ──→ 分數高的排前面
       ↓
  傳遞給 LLM 生成回答
```

程式碼位置：`backend/src/api/rag.rs:49-67`

### 支援的模型

| 模型 | 大小 | 語言 |
|------|------|------|
| `BAAI/bge-reranker-v2-m3` | ~570MB | 多語言含繁中 + 英文 |
| `maidalun1020/bce-reranker-base_v1` | ~450MB | 中文 + 英文 |

### 設定方式

```bash
# backend/.env
RERANKING_MODEL=BAAI/bge-reranker-v2-m3
```

---

## 三、LLM：最終回答生成

Reranking 後的精選區塊組合為 context，傳送給 LLM 生成最終回答：

```
context = chunk1 + "\n\n" + chunk2 + "\n\n" + ...

LLM 收到的 prompt：
  系統：你是一個專業的 RAG 助手。請基於提供的上下文來回答...
  使用者：上下文：{context}\n\n問題：{query}
```

程式碼位置：`backend/src/rag/llm.rs`

---

## 四、完整查詢流程圖

```
使用者輸入查詢 "Rust 的借用規則"
       │
       ▼
  [1] EmbeddingService::embed("Rust 的借用規則")
       │ 回傳 512 維向量
       ▼
  [2] Qdrant::search_points("documents", query_vec, top_k=5)
       │ 回傳 5 個最接近的區塊（含 cosine distance）
       ▼
  [3] RerankerService::rerank("Rust 的借用規則", [chunkA, chunkB, ...])
       │ 對每對 (query, chunk) 計算 relevance_score
       │ 依分數重新排序
       ▼
  [4] LLMService::generate(query, context)
       │ 將區塊拼接成 context 送入 LLM
       ▼
  [5] 回傳 { answer: "Rust 的借用規則是指...", chunks: [...] }
       │
       ▼
     前端 SearchPage 顯示 AI 回答 + 參考來源
```

---

## 五、模型 API 呼叫實作

目前 Embedding 與 Reranking 皆透過 HTTP API 呼叫（可相容 OpenAI 格式）：

### Embedding 請求

```
POST {OPENAI_BASE_URL}/embeddings
Authorization: Bearer {OPENAI_API_KEY}

{
  "model": "BAAI/bge-small-zh-v1.5",
  "input": "要編碼的文字"
}
```

### Reranking 請求

```
POST {OPENAI_BASE_URL}/rerank
Authorization: Bearer {OPENAI_API_KEY}

{
  "model": "BAAI/bge-reranker-v2-m3",
  "query": "使用者的查詢",
  "documents": ["候選文件1", "候選文件2", ...]
}
```

### 回應格式

```json
// Embedding 回應
{
  "data": [{ "embedding": [0.012, 0.034, ...] }]
}

// Reranking 回應
{
  "results": [
    { "index": 0, "relevance_score": 0.95 },
    { "index": 1, "relevance_score": 0.23 }
  ]
}
```

當 `OPENAI_API_KEY` 未設定或 API 呼叫失敗時，Reranking 步驟會被跳過，系統仍可退回到純向量搜尋的結果。

---

## 六、相關環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `EMBEDDING_MODEL` | `BAAI/bge-small-zh-v1.5` | 使用的 embedding 模型名稱 |
| `RERANKING_MODEL` | `BAAI/bge-reranker-v2-m3` | 使用的 reranking 模型名稱 |
| `OPENAI_API_KEY` | — | API 金鑰（未設定則 reranking 跳過） |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | API 端點基底 URL |

---

## 七、相關程式碼索引

| 功能 | 檔案 | 行數 |
|------|------|------|
| Embedding 服務實作 | `backend/src/rag/embeddings.rs` | 全檔 |
| Reranking 服務實作 | `backend/src/rag/reranker.rs` | 全檔 |
| 文字分塊 | `backend/src/rag/chunker.rs` | 全檔 |
| LLM 回答生成 | `backend/src/rag/llm.rs` | 全檔 |
| RAG 查詢 API | `backend/src/api/rag.rs` | 全檔 |
| 文件上傳與索引 | `backend/src/api/documents.rs` | `index_document()` |
| 文件解析 | `backend/src/ingestion/parser.rs` | 全檔 |
| 共用型別 | `lib/rust/src/types/mod.rs` | `DocumentChunk`, `RagQuery`, `RagResult` |
| 共用常數 | `lib/rust/src/constants/mod.rs` | `DEFAULT_CHUNK_SIZE`, `DEFAULT_TOP_K` |
| 建議模型清單 | `AGENTS.zh-tw.md` | 最後段落 |
