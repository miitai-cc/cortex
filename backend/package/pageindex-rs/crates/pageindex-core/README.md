# pageindex-core

Core library for PageIndex - a vectorless, reasoning-based RAG system that
builds hierarchical tree indices from PDFs using LLM reasoning.

## Overview

This crate provides the core functionality for extracting document structure
from PDFs and Markdown files:

- **PDF Parsing**: Extract text content with page-level token counting
- **TOC Detection**: Detect and extract table of contents using LLM reasoning
- **TOC Verification**: Verify extracted TOC against actual document structure
- **Tree Building**: Build hierarchical document trees with proper parent-child
  relationships
- **Markdown Support**: Parse Markdown files based on header hierarchy

## Features

| Feature    | Description              | Default |
| ---------- | ------------------------ | ------- |
| `lopdf`    | Pure Rust PDF parsing    | Yes     |
| `mupdf`    | Fast C-based PDF parsing | No      |
| `markdown` | Markdown file support    | Yes     |

## Usage

```rust
use pageindex_core::{page_index, Config};
use pageindex_core::llm::LlmClient;

// Implement LlmClient trait or use pageindex-llm providers
let client = MyLlmClient::new();
let config = Config::new()
    .with_model("gpt-4o")
    .with_node_summary(true);

let structure = page_index("document.pdf", &client, &config).await?;
println!("Document: {}", structure.doc_name);
for section in &structure.structure {
    println!("  - {}", section.title);
}
```

## Modules

- `config` - Configuration types
- `error` - Error types with `thiserror`
- `llm` - `LlmClient` trait and prompt templates
- `model` - Data structures (`DocumentNode`, `DocumentStructure`, etc.)
- `pdf` - PDF text extraction and token counting
- `markdown` - Markdown parsing and tree building
- `toc` - TOC detection, extraction, verification, and fixing
- `tree` - Tree manipulation utilities

## License

MIT
