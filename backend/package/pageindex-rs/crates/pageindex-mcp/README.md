# pageindex-mcp

MCP (Model Context Protocol) server for PageIndex, enabling AI assistant
integration.

## Overview

This crate provides an MCP server that exposes PageIndex functionality to AI
assistants like Claude. It allows assistants to index, search, and retrieve
document structure through the Model Context Protocol.

## Installation

```bash
cargo install pageindex-mcp
```

Or build from source:

```bash
cargo build --release -p pageindex-mcp
```

## Configuration

### Claude Desktop

Add to your Claude Desktop configuration
(`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "pageindex": {
      "command": "pageindex-mcp",
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "pageindex": {
      "command": "pageindex-mcp"
    }
  }
}
```

## Available Tools

### index_document

Index a PDF or Markdown file.

**Parameters:**

- `path` (string, required): Path to the document
- `with_summary` (boolean): Generate node summaries
- `with_description` (boolean): Generate document description

### search_documents

Search indexed documents by query.

**Parameters:**

- `query` (string, required): Search query
- `limit` (number): Maximum results (default: 10)

### get_document

Get full document structure by ID.

**Parameters:**

- `id` (string, required): Document ID

### list_documents

List all indexed documents.

**Parameters:** None

## Example Usage

Once configured, you can ask Claude:

- "Index the PDF at ~/Documents/paper.pdf"
- "Search my documents for 'machine learning'"
- "Show me the structure of document abc123"
- "What documents do I have indexed?"

## Environment Variables

| Variable         | Description                                     |
| ---------------- | ----------------------------------------------- |
| `OPENAI_API_KEY` | OpenAI API key for LLM operations               |
| `RUST_LOG`       | Logging level (error, warn, info, debug, trace) |

## License

MIT
