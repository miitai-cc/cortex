# RAG 應用程式
cortex - 
Cognitive Orchestration for Retrieval, Tooling, Execution, and eXtensibility
## 簡介
RAG（Retrieval-Augmented Generation）是結合檢索與生成的技術架構，通過將外部知識庫與大模型結合，
實現更精準、上下文更丰富的智能回應。它的核心流程包括：
    1. **檢索**：基於向量相似度或關鍵字匹配，從向量資料庫中檢索出與查詢最相關的文檔片段
    2. **上下文生成**：將檢索到的文檔內容與原始查詢組合，生成充足的上下文供 LLM 處理
    3. **生成回應**：使用 LLM 生成最終的自然語言回應，並可選擇使用 reranking 模型優化答案質量

## 架構
具以下架構
   - **檔案儲存**：使用 SQLite 或 PostgreSQL 儲存向量、元資料和檔案索引
   - **向量化引擎**：集成 Qdrant 作為向量相似度搜尋引擎
   - **檔案接入**：支援 PDF、Word、TXT、Markdown 等格式的文件上傳與解析
   - **檢索層**：實現基於向量相似度的檢索功能，並支援混合檢索（向量 + 關鍵字）
   - **LLM 接口**：與 OpenAI、Anthropic 或自建大模型 API 整合
      - 使用 embedded AI Model (列出可用的小型 embedded 於 AGENTS.md)
      - 使用 reranking AI Model (列出可用的小型 embedded 於 AGENTS.md)
   - **RAG 生成器**：根據檢索結果生成上下文並調用 LLM 生成最終回應
   - **API 端點**：提供 RESTful API 供前端或其他服務調用
   - **內容管理** : 提供 Content Management 內容, 提供文件上傳與管理功能
   - **Office 文書處理** : 提供 Office 文書處理功能
      - 支援 Word 文書處理功能
      - 支援 Excel 文書處理功能
      - 支援 PowerPoint 文書處理功能    
   - **Markdown** : 
      - 提供 Markdown 編輯功能
      - 提供 轉檔功能 (Html, PDF, Word, Excel, PowerPoint)
   - **Google App Script**: 整合 Google Apps Script 作為工具使用
   - **Webdav** : 整合 Webdav 作為工具使用
   - **i18n** : 支援多語言國際化與本地化功能，提供動態切換語言與翻譯管理
   - **安全機制**：實現 API 金鑰管理與輸入過濾防止注入攻擊
   - **日誌與監控**：記錄檢索次數、延遲時間與錯誤率，便於後續優化
    - **部署與運維**：支持 Docker 容器化部署與 Kubernetes 編排，並提供 CI/CD 自動化流程
        - 容器建置：`run/container/` 目錄，使用 Makefile 建置 `miitai-cc/cortex-*` 映像
        - Kubernetes 部署：`run/kubernetes/` 目錄，包含 namespace、secrets、deployments、ingress 配置

## 前後端
    - 源碼目錄:
        - frontend: 前端應用程式 (React)
        - backend: 後端應用程式 (Rust)
        - lib/react: 前端共用工具函式與型別
        - lib/rust: 後端共用工具函式與型別
        - run/container: Docker 容器建置（Makefile、Dockerfiles、docker-compose）
        - run/kubernetes: Kubernetes 部署配置（namespace、secrets、deployments、ingress）
        - third-party: 第三方原始碼（keycloak、qdrant）
    - 應用前後端架構設計
        - **前端技術棧**：React/Vue.js + TypeScript + Tailwind CSS + SPA
        - **後端框架**： Rust + salvo + axon + sqlx + qdrant-client + llm + tokenizers + whisper + openvino
        - **API 通信**：RESTful API + WebSocket (實時更新) + gRpc
        - **認證機制**：JWT Token + OAuth2
        - **狀態管理**：Redux / Zustand (前端) + Redis (後端緩存)
        - **SSO** : 支援 SAML 2.0 / OIDC 協定的單點登錄集成, 使用 Keycloak
        - **日誌與監控**：統一的日誌格式與輸出方式，並支援 Prometheus + Grafana 監控系統指標
        - **自動化 CI/CD** : 提供 Docker, GitLab CI/CD 自動化流程，支援多環境部署（開發、測試、生產）
            - 定義 Dockerfile 與 Kubernetes 部署配置文件
            - 建立 CI/CD pipeline自動化測試
            - 定義 docker-compose 檔案，支援單機快速部署
            - 容器映像使用 Alpine 基底，映像命名為 `miitai-cc/cortex-*`
            - 透過 `make` 或 `./run/run-make.sh` 建置映像
        - **使用者與角色管理** :
            - 應整合 keycloak(SSO), 或自定 使用者帳號/密碼/email 作為 登入 服務, 可由 env.js(前端)與.env(後端) 設定 切換
            - 提供 API 與 視窗 供 使用者與角色管理 (分離至 lib)
            - 相關 前後端程式碼分離至 lib 目錄            
        - **共用原則** : 前後端應分離至 lib 目錄, 
            - 先以 std library 以最高優先
            - 以參照 lib 目錄的檔案作為共用
                - 前端使用 TypeScript 定義型別與工具函式 (在 lib/react 目錄)
                - 後端使用 Rust 定義型別與工具函式 (在 lib/rust 目錄)
    - 前端 SPA 經編譯後，其內容 建立在 後端 靜態檔案夾(Assets), 並由 Axon 提供後端服務 提供 使用者由 瀏覽器 存取

    - RAG 應用程式 可選用 Axon 作為後端服務，其包含以下功能
        - 靜態檔案服務
        - API 服務
        - WebSocket 服務
        - gRpc 服務
    - 資料庫:
        - sqlite , SqlServer 2022 , Mysql 8.0 , postgresql 16 供選擇
    - 向量資料庫:
        - Qdrant
## 共用
    共用 目錄為 lib，包含以下共用模組：
        - **工具函式庫**：檔案解析、向量計算、HTTP 請求封裝等通用函式
        - **型別定義**：TypeScript/JSON Schema 定義的資料結構與接口
        - **常數與設定**：API 金鑰、URL、超時設定等環境變數
        - **錯誤處理**：統一的錯誤類型與處理機制
        - **日誌工具**：統一的日誌格式與輸出方式
        - **安全工具**：輸入校驗、加密解密函式與安全中間件
        - **測試工具**：單元測試框架、集成測試支援與測試數據生成器

## 測試
    1. 提供相關測試 API，包含以下功能：
        - **健康檢查端點**：檢查系統依賴（Database、Qdrant、API）的可用性
        - **模擬查詢端點**：提供測試用戶查詢接口，用於驗證RAG流程的正確性
        - **性能基準測試**：測試API延遲、並發處理能力與資源消耗
        - **安全測試端點**：測試API金鑰有效性、輸入過濾與權限控制
        - **回歸測試腳本**：自動化測試流程，確保新功能不影響現有功能
        - **API 功能測試端點**：測試API功能，包含以下功能：
            1. RAG 查詢：測試基於向量相似度的檢索功能，並支援混合檢索（向量 + 關鍵字）
            2. LLM 接口：測試與 OpenAI、Anthropic 或自建大模型 API 整合
            3. RAG 生成器：測試根據檢索結果生成上下文並調用 LLM 生成最終回應
            4. API 端點：測試提供 RESTful API 供前端或其他服務調用
            5. 文件接入：測試 PDF、Word、TXT、Markdown 等格式文件的上傳與解析功能
            6. 向量化引擎：測試 Qdrant 的向量相似度搜尋與混合檢索能力
            7. 安全機制：測試 API 金鑰管理、JWT 認證與輸入過濾機制
            8. 性能指標：測試 API 延遲、並發處理能力與資源消耗
            9. 部署與運維：測試 Docker 容器化部署、Kubernetes 編排與 CI/CD 自動化流程

## 建議的輕量級 AI 模型

### Embedding 模型
| 模型 | 語言 | 向量維度 | 模型大小 | 說明 |
|------|------|----------|----------|------|
| `BAAI/bge-small-zh-v1.5` | 繁體中文 + 英文 | 512 | ~33MB | BGE 系列輕量中文版，繁體中文相容性佳，檢索效果優秀 |
| `intfloat/multilingual-e5-small` | 多語言(含繁中) + 英文 | 384 | ~118MB | 真正多語言小型模型，對繁體中文支援度最佳 |
| `sentence-transformers/all-MiniLM-L6-v2` | 英文為主 | 384 | ~80MB | 最廣泛使用的輕量英文 embedding 模型 |

### Reranking 模型
| 模型 | 語言 | 模型大小 | 說明 |
|------|------|----------|------|
| `BAAI/bge-reranker-v2-m3` | 多語言(含繁中 + 英文) | ~570MB | BGE 最新多語言 Reranker，中英混合情境表現穩定 |
| `maidalun1020/bce-reranker-base_v1` | 中文 + 英文 | ~450MB | 輕量級中英雙語 Reranker，適合本地部署 |