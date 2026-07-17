# cortex

Cognitive Orchestration for Retrieval, Tooling, Execution, and eXtensibility

> [English](README.md) · [繁體中文](README.zh-hw.md) · **日本語**

## 概要

Cortex は、高度な検索、ツール統合、実行、拡張性を備えた AI 駆動アプリケーションを構築するための包括的なフレームワークです。

## 機能

- AI 仮想社員
- 知識 RAG
- SQL RAG
- Embedding
- Reranking
- LLM
- AI エージェント
- MCP / プラグイン
- ワークフロー

## アーキテクチャ

本プロジェクトは、フロントエンドとバックエンドが明確に分離されたモジュラーアーキテクチャを採用しています：

- **フロントエンド**: React + TypeScript + Tailwind CSS SPA
- **バックエンド**: Rust + salvo + axon + sqlx + qdrant-client + llm
- **API 通信**: RESTful API + WebSocket + gRPC
- **認証**: JWT Token + OAuth2 + SAML 2.0 / OIDC（Keycloak SSO）
- **データベース**: SQLite、SQL Server 2022、MySQL 8.0、PostgreSQL 16
- **ベクターデータベース**: Qdrant

## はじめに

### 前提条件

- Node.js（フロントエンド）
- Rust ツールチェーン（バックエンド）
- Docker（オプション、コンテナ化デプロイ用）

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/your-org/cortex.git
cd cortex

# フロントエンドの依存関係をインストール
cd frontend && npm install

# バックエンドをビルド
cd ../backend && cargo build
```

## プロジェクト構造

```
cortex/
├── frontend/          # React SPA フロントエンド
├── backend/           # Rust バックエンドサービス
├── lib/
│   ├── react/         # 共有 TypeScript 型定義とユーティリティ
│   └── rust/          # 共有 Rust 型定義とユーティリティ
├── ~docs/             # ドキュメント
└── AGENTS.zh-tw.md    # エージェント指示書（繁体字中国語）
```

## 参考

本システムは `rusty_claw` を参考にし、拡張しています：

- [rusty_claw GitHub](https://github.com/opencode/rusty_claw)
- [rusty_claw ドキュメント](https://opencode.ai/rusty-claw)

## ライセンス

[MIT](LICENSE)
