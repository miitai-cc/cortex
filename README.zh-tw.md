# cortex

Cognitive Orchestration for Retrieval, Tooling, Execution, and eXtensibility

> [English](README.md) · **繁體中文** · [日本語](README.ja.md)

## 概述

Cortex 是一個全方位的框架，專為建構 AI 驅動的應用程式而設計，具備先進的檢索、工具整合、執行與擴展能力。

## 功能特色

- AI 虛擬員工
- 知識 RAG
- SQL RAG
- Embedding
- Reranking
- LLM
- AI 代理
- MCP / 外掛
- 工作流程

## 架構

本專案採用模組化架構，前後端明確分離：

- **前端**：React + TypeScript + Tailwind CSS SPA
- **後端**：Rust + salvo + axon + sqlx + qdrant-client + llm
- **API 通訊**：RESTful API + WebSocket + gRPC
- **認證機制**：JWT Token + OAuth2 + SAML 2.0 / OIDC（Keycloak SSO）
- **資料庫**：SQLite、SQL Server 2022、MySQL 8.0、PostgreSQL 16
- **向量資料庫**：Qdrant

## 快速開始

### 前置需求

- Node.js（前端）
- Rust 工具鏈（後端）
- Docker & Docker Compose（容器化部署）
- Kubernetes & kubectl（叢集部署）

### 安裝

```bash
# 複製儲存庫
git clone https://github.com/your-org/cortex.git
cd cortex

# 安裝前端相依套件
cd frontend && npm install

# 建置後端
cd ../backend && cargo build
```

### Docker 建置

從 `run/container/` 建置所有容器映像：

```bash
# 建置全部映像
cd run/container && make all

# 或從專案根目錄使用腳本
./run/run-make.sh all

# 建置單一服務並指定版本
./run/run-make.sh app v1.0.0
```

映像倉庫：`miitai-cc/cortex-*`

### Docker Compose（本地開發）

```bash
cd run/container
docker-compose up -d
```

### Kubernetes 部署

```bash
# 部署所有資源至 cortex namespace
kubectl apply -f run/kubernetes/

# 或按順序部署
kubectl apply -f run/kubernetes/cortex-namespace.yaml
kubectl apply -f run/kubernetes/cortex-secrets.yaml
kubectl apply -f run/kubernetes/backend-deployment.yaml
kubectl apply -f run/kubernetes/frontend-deployment.yaml
kubectl apply -f run/kubernetes/qdrant-deployment.yaml
kubectl apply -f run/kubernetes/cortex-ingress.yaml
```

## 專案結構

```
cortex/
├── frontend/          # React SPA 前端
├── backend/           # Rust 後端服務
├── lib/
│   ├── react/         # 共用 TypeScript 型別與工具
│   └── rust/          # 共用 Rust 型別與工具
├── run/
│   ├── container/     # Docker 建置（Makefile、Dockerfiles、docker-compose）
│   └── kubernetes/    # Kubernetes 部署配置
├── third-party/       # 第三方原始碼（keycloak、qdrant）
├── ~docs/             # 文件
└── AGENTS.zh-tw.md    # 代理指令（繁體中文）
```

## 參考資料

本系統參考並擴充自 `rusty_claw`：

- [rusty_claw GitHub](https://github.com/opencode/rusty_claw)
- [rusty_claw 官方說明](https://opencode.ai/rusty-claw)

## 授權

[MIT](LICENSE)
