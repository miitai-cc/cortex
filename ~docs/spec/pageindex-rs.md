# 文件上傳使用 pageindex-rs 進行頁面索引

## 背景

`pageindex-rs` 是一個 Vectorless、基於 LLM reasoning 的 RAG 系統，從 [VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex) 移植而來。  
它不依賴向量相似度，而是使用 LLM 分析 PDF 的目錄結構（TOC），建立階層樹狀索引（hierarchical tree index）。

**核心功能**：
1. 偵測 PDF 是否有目錄（TOC）
2. 解析 TOC 結構（章節 + 頁碼）
3. 驗證結構是否與實際內容吻合
4. 建立可導覽的樹狀索引（parent-child relationships）
5. 可選：對各章節生成摘要

## User Review Required

> [!IMPORTANT]
> `pageindex-rs` 是一個 **git 依賴**（非 crates.io 發佈），需以 `git` 方式引用，且它要求 `OPENAI_API_KEY` 才能完成 LLM reasoning 索引步驟。  
> 若 API key 未設定，pageindex 的 TOC 偵測/摘要步驟將無法執行，但基本頁面文字提取仍可運作。

> [!WARNING]  
> `pageindex-core` 依賴 `lopdf`（已在後端 Cargo.toml 中），不需要額外系統依賴（無 mupdf 選項）。

## Proposed Changes

---

### 後端：新增 pageindex-core 依賴

#### [MODIFY] [Cargo.toml](file:///Volumes/workspace/ai/application/cortex/backend/Cargo.toml)

新增 git 依賴：
```toml
pageindex-core = { git = "https://github.com/kevinmichaelchen/pageindex-rs.git", default-features = false, features = ["lopdf"] }
```

---

### 後端：重構文件索引 Pipeline

#### [MODIFY] [documents.rs](file:///Volumes/workspace/ai/application/cortex/backend/src/api/documents.rs)

目前的 `index_document()` 流程：
```
parse_file → chunk_text → embed → upsert Qdrant
```

新的 pageindex-based 流程：
```
pageindex-core::page_index(pdf) 
  → 取得 IndexedDocument { pages: Vec<Page>, sections: Vec<Section> }
  → 每個 section 的 content 進行 embedding
  → 存入 Qdrant（含 page_number, section_title metadata）
```

對非 PDF 格式（txt, md, docx）維持原有 chunker 流程。

上傳後的回應增加 `page_count` 和 `index_method` 欄位。

---

### 後端：新增 `GET /documents/:id/index` 端點

返回文件的 pageindex 結構（階層樹、各章節標題與頁碼），供前端顯示。

---

### 前端：文件上傳 UI 增強

#### [MODIFY] [DocumentsPage.tsx](file:///Volumes/workspace/ai/application/cortex/frontend/src/pages/DocumentsPage.tsx)

上傳後顯示索引進度和結果：
- 上傳後顯示 `index_method`（`pageindex` 或 `chunker`）
- 顯示 `page_count`（PDF 頁數）

#### [MODIFY] [DocumentDetailPage.tsx](file:///Volumes/workspace/ai/application/cortex/frontend/src/pages/DocumentDetailPage.tsx)

顯示 pageindex 建立的文件結構（章節樹狀）。

---

## Open Questions

> [!IMPORTANT]
> `pageindex-core` 的 `page_index()` API 還在非常早期的 stage（lib.rs 幾乎為空）。  
> 建議實作方式：
> - **方案 A**：只整合 `pageindex-core` 的 PDF 逐頁文字提取（page-by-page text extraction），不用 LLM TOC 分析。每頁作為一個 chunk，記錄 `page_number` metadata → 較穩定。
> - **方案 B**：完整整合 pageindex LLM reasoning（需要有效 OpenAI API key），使用階層索引。→ 功能強大但依賴 LLM。
> 
> 建議選擇方案 A，作為穩定基礎，再視需求添加方案 B 的 LLM 功能。

## Verification Plan

### Automated Tests
- `cargo check` 確保後端編譯

### Manual Verification
1. 上傳 PDF → 後端以 pageindex 逐頁索引，回傳 `page_count` 和 `index_method: "pageindex"`
2. 上傳 TXT/MD → 使用原有 chunker，回傳 `index_method: "chunker"`
3. 前端顯示上傳結果中的索引資訊
