# cortex

Cognitive Orchestration for Retrieval, Tooling, Execution, and eXtensibility

> **English** · [繁體中文](README.zh-hw.md) · [日本語](README.ja.md)

## Overview

Cortex is a comprehensive framework designed for building AI-powered applications with advanced retrieval, tool integration, execution, and extensibility capabilities.

## Features

- AI Virtual Employee
- Knowledge RAG
- SQL RAG
- Embedding
- Reranking
- LLM
- AI Agents
- MCP / Plugins
- Workflow

## Architecture

The project follows a modular architecture with clear separation between frontend and backend:

- **Frontend**: React + TypeScript + Tailwind CSS SPA
- **Backend**: Rust + salvo + axon + sqlx + qdrant-client + llm
- **API Communication**: RESTful API + WebSocket + gRPC
- **Authentication**: JWT Token + OAuth2 + SAML 2.0 / OIDC (Keycloak SSO)
- **Database**: SQLite, SQL Server 2022, MySQL 8.0, PostgreSQL 16
- **Vector Database**: Qdrant

## Getting Started

### Prerequisites

- Node.js (for frontend)
- Rust toolchain (for backend)
- Docker (optional, for containerized deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/cortex.git
cd cortex

# Install frontend dependencies
cd frontend && npm install

# Build backend
cd ../backend && cargo build
```

## Authentication (Keycloak SSO)

Cortex uses Keycloak as the primary identity provider for robust Single Sign-On (SSO) and RBAC (Role-Based Access Control).

### Setup and Configuration

1. **Start Keycloak:** Ensure the Keycloak container is running via Docker Compose (`docker-compose up -d keycloak`).
2. **Access Admin Console:** Navigate to `http://localhost:8080/admin` (default credentials: `admin` / `admin`).
3. **Realm Configuration:** 
   - Create a new Realm for `cortex`.
   - Configure OpenID Connect (OIDC) or SAML 2.0 clients for both the frontend application and backend API services.
4. **Environment Variables:** 
   - **Frontend (`env.js`)**: Configure the Keycloak URL, Realm name, and Client ID.
   - **Backend (`.env`)**: Provide the Keycloak OIDC discovery URL (`KC_DB_URL`) to validate incoming JWTs.

Keycloak is responsible for issuing access tokens (JWT), which the frontend includes in the `Authorization` header when communicating with the Cortex RESTful API.

## Project Structure

```
cortex/
├── frontend/          # React SPA frontend
├── backend/           # Rust backend services
├── lib/
│   ├── react/         # Shared TypeScript types & utilities
│   └── rust/          # Shared Rust types & utilities
├── ~docs/             # Documentation
└── AGENTS.zh-tw.md    # Agent instructions (Traditional Chinese)
```

## References

This system references and extends `rusty_claw`:

- [rusty_claw GitHub](https://github.com/opencode/rusty_claw)
- [rusty_claw Documentation](https://opencode.ai/rusty-claw)

## llm_wiki

- [llm_wiki GitHub](https://github.com/nashsu/llm_wiki)

## License

[MIT](LICENSE)
