# Container Build

cortex 各服務的 Docker 映像建置配置。所有映像使用 **Alpine** 基底，以最小體積為原則。

## 目錄結構

```
run/container/
├── Makefile                 # 映像建置腳本
├── docker-compose.yml       # 本地整合開發用
├── app/                     # Cortex 後端 (Rust)
│   └── Dockerfile
├── sso/
│   └── keycloak/            # Keycloak SSO
│       └── Dockerfile
├── qdrant/                  # Qdrant 向量資料庫
│   └── Dockerfile
├── ai/
│   ├── embedded/            # llama.cpp 嵌入模型伺服器
│   │   └── Dockerfile
│   ├── reranking/           # llama.cpp 重排序模型伺服器
│   │   └── Dockerfile
│   └── common/              # llama.cpp 通用對話伺服器
│       └── Dockerfile
└── postgresql/              # PostgreSQL 資料庫
    └── Dockerfile
```

## 映像清單

| 服務 | 映像名稱 | 說明 |
|------|----------|------|
| app | `miitai-cc/cortex-app` | Rust 後端 API 伺服器 |
| sso | `miitai-cc/cortex-sso` | Keycloak SSO 認證服務 |
| qdrant | `miitai-cc/cortex-qdrant` | Qdrant 向量資料庫 |
| ai-embedded | `miitai-cc/cortex-ai-embedded` | llama.cpp 嵌入模型推理 |
| ai-reranking | `miitai-cc/cortex-ai-reranking` | llama.cpp 重排序模型推理 |
| ai-common | `miitai-cc/cortex-ai-common` | llama.cpp 通用文字生成 |
| postgresql | `miitai-cc/cortex-postgresql` | PostgreSQL 資料庫伺服器 |

## 建置方式

### 使用 Makefile

從 `run/container/` 目錄執行：

```bash
# 建置全部映像
make all

# 建置單一服務
make app
make sso
make qdrant
make ai-embedded
make ai-reranking
make ai-common
make postgresql

# 指定版本
make app VERSION=v1.0.0

# 清除所有映像
make clean
```

### 使用 run-make.sh

從任意位置執行：

```bash
# 建置全部
./run/run-make.sh all

# 建置單一服務 + 指定版本
./run/run-make.sh app v1.0.0
./run/run-make.sh ai-embedded latest

# 清除
./run/run-make.sh clean
```

## 各服務說明

### app — Cortex 後端

Rust 後端 API，多階段建置：
- 建置：`rust:1.80-alpine` 編譯 release binary
- 運行：`alpine:3.20` 僅含必要 TLS 函式庫

對外暴露 `8080` port。

### sso/keycloak — Keycloak SSO

基於 Keycloak 26.1 Quarkus distribution：
- 建置：從 `third-party/keycloak/` 原始碼編譯 Quarkus distribution
- 運行：`alpine:3.20` + `gcompat`（Keycloak 官方無 Alpine 變體，以 gcompat 提供 GLIBC 相容）

對外暴露 `8080` port。

### qdrant — Qdrant 向量資料庫

從 `third-party/qdrant/` 原始碼編譯：
- 建置：`rust:1.80-alpine` 編譯 qdrant binary
- 運行：`alpine:3.20`

對外暴露 `6333`（HTTP）與 `6334`（gRPC）port。

### ai — llama.cpp 推理伺服器

三個變體共享相同 llama.cpp 建置流程，差異在啟動參數：

| 變體 | 用途 | 啟動模式 |
|------|------|----------|
| embedded | 嵌入向量生成 | `--embedding` |
| reranking | 文檔重排序 | 預設（載入 reranker 模型） |
| common | 通用文字生成 / 對話 | 預設 |

- 建置：`alpine:3.20` + `build-base` 從原始碼編譯
- 運行：`alpine:3.20` + `libgomp`

所有變體對外暴露 `8080` port。

### postgresql — PostgreSQL 資料庫

基於 `postgres:16-alpine`，預設配置：
- 資料庫：`cortex`
- 使用者：`cortex`
- 密碼：`cortex`（部署時應透過環境變數覆蓋）

對外暴露 `5432` port。

## 本地開發

使用 `docker-compose.yml` 啟動完整開發環境：

```bash
cd run/container
docker-compose up -d
```

服務清單：
- `cortex-backend` → localhost:8080
- `cortex-frontend` → localhost:80
- `qdrant` → localhost:6333 / 6334
