# pageindex-rs

A Rust port of [PageIndex](https://github.com/VectifyAI/PageIndex) — a
vectorless, reasoning-based RAG system that builds hierarchical tree indices
from PDFs using LLM reasoning instead of vector similarity.

## Overview

PageIndex extracts hierarchical structure from PDF documents by:

1. **Detecting Table of Contents** - Uses LLM to identify if a document has a
   TOC
2. **Extracting Structure** - Parses TOC entries with page numbers
3. **Verification** - Validates extracted structure against actual document
   content
4. **Tree Building** - Creates a navigable tree with proper parent-child
   relationships
5. **Summarization** - Optionally generates summaries for each section

## Quick Start

```bash
# Install the CLI
cargo install --path crates/pageindex-cli

# Set your API key
export OPENAI_API_KEY=sk-...

# Index a document
pageindex index document.pdf

# Search your documents
pageindex query "search terms"
```

## Workspace Crates

| Crate                                               | Description                                               |
| --------------------------------------------------- | --------------------------------------------------------- |
| [pageindex-core](crates/pageindex-core/README.md)   | Core library - PDF parsing, TOC extraction, tree building |
| [pageindex-llm](crates/pageindex-llm/README.md)     | LLM provider implementations (OpenAI, Anthropic, etc.)    |
| [pageindex-store](crates/pageindex-store/README.md) | Document storage, caching, and file watching              |
| [pageindex-cli](crates/pageindex-cli/README.md)     | Command-line interface                                    |
| [pageindex-mcp](crates/pageindex-mcp/README.md)     | MCP server for AI assistant integration                   |

## Architecture

```
┌─────────────────┐
│  pageindex-core │  Core library (PDF, TOC, tree building)
└────────┬────────┘
         │
    ┌────┴────┬─────────────┐
    │         │             │
    ▼         ▼             ▼
┌───────┐ ┌───────┐ ┌─────────────┐
│  llm  │ │ store │ │   (core)    │
└───┬───┘ └───┬───┘ └─────────────┘
    │         │
    └────┬────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌───────┐
│  cli  │ │  mcp  │
└───────┘ └───────┘
```

## Features

- **Vectorless RAG** - Uses LLM reasoning instead of embedding similarity
- **Structure Preservation** - Maintains document hierarchy and relationships
- **Multiple Formats** - Supports PDF and Markdown files
- **Flexible Storage** - SQLite (default) or JSON backends (testing only)
- **File Watching** - Automatic re-indexing on file changes
- **MCP Integration** - Use with Claude and other AI assistants

## Configuration

### LLM Providers

| Provider                  | Feature Flag | Status      |
| ------------------------- | ------------ | ----------- |
| [OpenAI][openai]          | `openai`     | Implemented |
| [Anthropic][anthropic]    | `anthropic`  | Stub        |
| [Gemini][gemini]          | `gemini`     | Stub        |
| [Groq][groq]              | `groq`       | Stub        |
| [Azure OpenAI][azure]     | `azure`      | Stub        |
| [Together AI][together]   | `together`   | Planned     |
| [Fireworks AI][fireworks] | `fireworks`  | Planned     |
| [Cerebras][cerebras]      | `cerebras`   | Planned     |
| [DeepInfra][deepinfra]    | `deepinfra`  | Planned     |
| [Replicate][replicate]    | `replicate`  | Planned     |
| [Baseten][baseten]        | `baseten`    | Planned     |
| [xAI][xai]                | `xai`        | Planned     |
| [Nebius][nebius]          | `nebius`     | Planned     |
| [Mistral AI][mistral]     | `mistral`    | Planned     |
| [Cohere][cohere]          | `cohere`     | Planned     |
| [Ollama][ollama]          | `ollama`     | Stub        |

[openai]: https://platform.openai.com
[anthropic]: https://www.anthropic.com
[gemini]: https://ai.google.dev
[groq]: https://groq.com
[azure]: https://azure.microsoft.com/en-us/products/ai-services/openai-service
[together]: https://www.together.ai
[fireworks]: https://fireworks.ai
[cerebras]: https://cerebras.ai
[deepinfra]: https://deepinfra.com
[replicate]: https://replicate.com
[baseten]: https://www.baseten.co
[xai]: https://x.ai
[nebius]: https://nebius.com
[mistral]: https://mistral.ai
[cohere]: https://cohere.com
[ollama]: https://ollama.com

### PDF Backends

| Backend | Feature Flag      | Description                          |
| ------- | ----------------- | ------------------------------------ |
| lopdf   | `lopdf` (default) | Pure Rust, portable                  |
| mupdf   | `mupdf`           | Fast C library, requires system deps |

## Migration Note (Storage)

SQLite is now the default storage backend. If you previously indexed documents
with the JSON store, reindex them or use the CLI flag `--store json` to access
the old JSON data.

## Development

```bash
# Build all crates
cargo build --workspace

# Run tests
cargo test --workspace

# Run clippy
cargo clippy --workspace

# Format code
cargo fmt --all
```

## License

MIT

## Credits

Based on [PageIndex](https://github.com/VectifyAI/PageIndex) by VectifyAI.
