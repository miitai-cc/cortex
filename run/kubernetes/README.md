# Kubernetes Deploy

cortex 各服務的 Kubernetes 部署配置。所有資源部署於 `cortex` namespace 下。

## 目錄結構

```
run/kubernetes/
├── cortex-namespace.yaml       # Namespace 定義
├── cortex-secrets.yaml         # Secret 敏感配置
├── backend-deployment.yaml     # 後端 Deployment + Service + PVC
├── frontend-deployment.yaml    # 前端 Deployment + Service + ConfigMap
├── qdrant-deployment.yaml      # Qdrant Deployment + Service + PVC
└── cortex-ingress.yaml         # Ingress 路由規則
```

## 資源清單

| 檔案 | 資源類型 | 名稱 | 說明 |
|------|----------|------|------|
| cortex-namespace.yaml | Namespace | `cortex` | 專屬命名空間 |
| cortex-secrets.yaml | Secret | `cortex-secrets` | 資料庫、JWT、OpenAI API 金鑰 |
| backend-deployment.yaml | Deployment | `cortex-backend` | 後端 API（2 replicas） |
| | Service | `cortex-backend` | ClusterIP: 8080 |
| | PVC | `cortex-data-pvc` | 資料儲存 5Gi |
| | PVC | `cortex-uploads-pvc` | 上傳檔案儲存 20Gi |
| frontend-deployment.yaml | Deployment | `cortex-frontend` | Nginx 前端（2 replicas） |
| | Service | `cortex-frontend` | ClusterIP: 80 |
| | ConfigMap | `nginx-config` | Nginx 設定檔 |
| qdrant-deployment.yaml | Deployment | `qdrant` | Qdrant 向量資料庫（1 replica） |
| | Service | `qdrant` | ClusterIP: 6333/6334 |
| | PVC | `qdrant-pvc` | 向量儲存 10Gi |
| cortex-ingress.yaml | Ingress | `cortex-ingress` | 對外路由（nginx ingress） |

## 部署方式

### 一鍵部署

```bash
kubectl apply -f run/kubernetes/
```

### 按順序部署

```bash
# 1. 建立 namespace
kubectl apply -f run/kubernetes/cortex-namespace.yaml

# 2. 建立 secrets（部署前須修改敏感值）
kubectl apply -f run/kubernetes/cortex-secrets.yaml

# 3. 部署服務
kubectl apply -f run/kubernetes/backend-deployment.yaml
kubectl apply -f run/kubernetes/frontend-deployment.yaml
kubectl apply -f run/kubernetes/qdrant-deployment.yaml

# 4. 建立 ingress
kubectl apply -f run/kubernetes/cortex-ingress.yaml
```

### 刪除全部資源

```bash
kubectl delete namespace cortex
```

## 部署前設定

### 修改 Secrets

編輯 `cortex-secrets.yaml`，替换預設值：

```yaml
stringData:
  database-url: "postgresql://cortex:<password>@cortex-postgresql:5432/cortex"
  db-password: "<your-db-password>"
  jwt-secret: "<your-jwt-secret>"
  openai-api-key: "<your-openai-api-key>"
```

### 修改 Ingress Host

編輯 `cortex-ingress.yaml`，將 `cortex.example.com` 改為實際網域：

```yaml
rules:
  - host: your-domain.com
```

### 替換映像

後端映像預設為 `cortex-backend:latest`（`imagePullPolicy: IfNotPresent`）。若使用私有映像倉庫：

```bash
# 修改映像來源
sed -i 's|cortex-backend:latest|your-registry/cortex-app:v1.0.0|g' run/kubernetes/backend-deployment.yaml
```

## 架構說明

```
                    ┌─────────────────┐
                    │  Ingress (nginx) │
                    └────────┬────────┘
                             │
               ┌─────────────┴──────────────┐
               │                             │
        ┌──────▼──────┐             ┌────────▼────────┐
        │   frontend   │             │     backend      │
        │  (nginx:80)  │────proxy───▶│   (rust:8080)    │
        └──────────────┘             └────────┬────────┘
                                              │
                               ┌──────────────┼──────────────┐
                               │              │              │
                        ┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼─────┐
                        │   qdrant    │ │ keycloak  │ │  OpenAI   │
                        │ (6333/6334) │ │  (SSO)   │ │   API     │
                        └─────────────┘ └───────────┘ └───────────┘
```

- **frontend**：Nginx 提供靜態資源，反向代理 `/cortex/api/` 與 `/cortex/ws/` 至 backend
- **backend**：Rust API 伺服器，連接 Qdrant、Keycloak、OpenAI
- **qdrant**：向量資料庫，透過 gRPC 與 backend 通訊

## 常用操作

```bash
# 查看 pod 狀態
kubectl get pods -n cortex

# 查看 service
kubectl get svc -n cortex

# 查看後端日誌
kubectl logs -f deployment/cortex-backend -n cortex

# 進入後端 pod
kubectl exec -it deployment/cortex-backend -n cortex -- sh

# 重新部署後端（更新映像後）
kubectl rollout restart deployment/cortex-backend -n cortex

# 查看 ingress
kubectl get ingress -n cortex
```
