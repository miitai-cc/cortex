# pageindex-cli

Command-line interface for PageIndex.

## Installation

```bash
cargo install pageindex-cli
```

Or build from source:

```bash
cargo build --release -p pageindex-cli
```

## Setup

Set your OpenAI API key:

```bash
export OPENAI_API_KEY=sk-...
```

## Commands

### Index a Document

```bash
# Basic indexing
pageindex index document.pdf

# With options
pageindex index document.pdf \
    --model gpt-4o \
    --with-text \
    --with-summary \
    --with-description \
    --store sqlite

# Output as JSON
pageindex index document.pdf --output json
```

### Search Documents

```bash
pageindex query "search terms" --limit 10
```

### List Documents

```bash
# Simple list
pageindex list

# Detailed view
pageindex list --detailed
```

### Watch Directory

```bash
pageindex watch ./documents --model gpt-4o
```

### Export Document

```bash
# Export as JSON
pageindex export doc-id --format json --output structure.json

# Export as Markdown TOC
pageindex export doc-id --format markdown
```

### Refresh Stale Documents

```bash
# Check and refresh specific document
pageindex refresh doc-id

# Refresh all stale documents
pageindex refresh --all
```

## Options

| Flag                 | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `-v, --verbose`      | Increase verbosity (use multiple times for more)         |
| `-m, --model`        | LLM model to use (default: gpt-4o-2024-11-20)            |
| `--with-text`        | Include full text content in nodes                       |
| `--with-summary`     | Generate node summaries (default: true)                  |
| `--with-description` | Generate document description                            |
| `-o, --output`       | Output format (json, pretty)                             |
| `--store`            | Storage backend: sqlite (default) or json (testing only) |

## Examples

```bash
# Index a PDF with verbose output
pageindex -v index paper.pdf --with-description

# Search for specific content
pageindex query "machine learning" -n 5

# Watch a folder for changes
pageindex watch ~/Documents/papers

# Export a document structure
pageindex export abc123 --format json > structure.json
```

## License

MIT
