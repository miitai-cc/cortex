# Porting Guide: PageIndex Python → Rust

This document describes what needs to be ported from the
[Python implementation](https://github.com/VectifyAI/PageIndex).

## Source Code Overview

The Python codebase is ~1,800 lines across 5 files:

| File                         | Lines | Purpose                                              |
| ---------------------------- | ----- | ---------------------------------------------------- |
| `pageindex/page_index.py`    | 887   | Core logic: TOC detection, extraction, verification  |
| `pageindex/utils.py`         | 570   | Helpers: OpenAI API, token counting, JSON extraction |
| `pageindex/page_index_md.py` | 235   | Markdown output formatting                           |
| `run_pageindex.py`           | 95    | CLI entry point                                      |
| `pageindex/__init__.py`      | 2     | Package init                                         |

## Dependencies to Replace

| Python          | Rust Equivalent            | Notes                              |
| --------------- | -------------------------- | ---------------------------------- |
| `openai`        | `async-openai`             | Main LLM client                    |
| `pymupdf`       | `mupdf` or `pdfium-render` | PDF text extraction                |
| `PyPDF2`        | `lopdf` or `pdf-extract`   | Backup PDF parsing                 |
| `tiktoken`      | `tiktoken-rs`              | Token counting for context windows |
| `pyyaml`        | `serde_yaml`               | Config parsing                     |
| `python-dotenv` | `dotenvy`                  | Environment variables              |

### Recommended Rust Crates

```toml
[dependencies]
async-openai = "0.28"
tiktoken-rs = "0.6"
mupdf = "0.4"              # or pdfium-render
serde = { version = "1", features = ["derive"] }
serde_json = "1"
serde_yaml = "0.9"
dotenvy = "0.15"
tokio = { version = "1", features = ["full"] }
anyhow = "1"
thiserror = "2"
tracing = "0.1"
```

## Core Data Structures

### TOC Item

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TocItem {
    pub structure: Option<String>,  // e.g., "1.2.3"
    pub title: String,
    pub physical_index: Option<u32>,
    pub page: Option<u32>,
}
```

### Document Node (Tree)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentNode {
    pub id: Option<String>,
    pub structure: Option<String>,
    pub title: String,
    pub start_index: u32,
    pub end_index: u32,
    pub text: Option<String>,
    pub summary: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub nodes: Vec<DocumentNode>,
}
```

### Config

```rust
#[derive(Debug, Clone)]
pub struct Config {
    pub model: String,                    // e.g., "gpt-4o-2024-11-20"
    pub toc_check_page_num: usize,        // default: 30
    pub max_page_num_each_node: usize,    // default: 30
    pub max_token_num_each_node: usize,   // default: 10000
    pub if_add_node_id: bool,
    pub if_add_node_text: bool,
    pub if_add_node_summary: bool,
    pub if_add_doc_description: bool,
}
```

## Key Functions to Port

### 1. PDF Parsing (`utils.py`)

```python
def get_page_tokens(doc) -> list[tuple[str, int]]
```

Returns list of (page_text, token_count) for each page.

**Rust approach:**

```rust
pub fn get_page_tokens(path: &Path) -> Result<Vec<(String, usize)>>
```

### 2. OpenAI API Wrapper (`utils.py`)

```python
def ChatGPT_API(model, prompt, chat_history=None) -> str
async def ChatGPT_API_async(model, prompt) -> str
def ChatGPT_API_with_finish_reason(model, prompt) -> tuple[str, str]
```

**Rust approach:**

```rust
pub async fn chat_completion(
    client: &Client<OpenAIConfig>,
    model: &str,
    prompt: &str,
    history: Option<&[ChatMessage]>,
) -> Result<String>
```

### 3. JSON Extraction (`utils.py`)

```python
def extract_json(response: str) -> dict
```

Handles malformed JSON from LLM responses (strips markdown fences, fixes
trailing commas, etc.)

**Rust approach:** Use `serde_json` with preprocessing. Consider `json5` crate
for lenient parsing.

### 4. TOC Detection (`page_index.py`)

```python
def toc_detector_single_page(content, model) -> str  # "yes" or "no"
def find_toc_pages(start_page_index, page_list, opt) -> list[int]
def check_toc(page_list, opt) -> dict
```

### 5. TOC Extraction & Transformation (`page_index.py`)

```python
def toc_extractor(page_list, toc_page_list, model) -> dict
def toc_transformer(toc_content, model) -> list[dict]
def toc_index_extractor(toc, content, model) -> list[dict]
```

### 6. Page Number Mapping (`page_index.py`)

```python
def calculate_page_offset(pairs) -> int
def add_page_offset_to_toc_json(data, offset) -> list
async def check_title_appearance(item, page_list, start_index, model) -> dict
```

### 7. Verification & Fixing (`page_index.py`)

```python
async def verify_toc(page_list, list_result, start_index, N, model) -> tuple[float, list]
async def fix_incorrect_toc(toc, page_list, incorrect_results, ...) -> tuple[list, list]
async def fix_incorrect_toc_with_retries(toc, page_list, incorrect, max_attempts=3, ...) -> tuple
```

### 8. Tree Building (`page_index.py`)

```python
def post_processing(toc_items, total_pages) -> list[dict]  # in utils.py
async def process_large_node_recursively(node, page_list, opt) -> dict
async def tree_parser(page_list, opt, doc, logger) -> list[dict]
```

### 9. Main Entry Point (`page_index.py`)

```python
def page_index(doc, model=None, ...) -> dict
```

**Rust approach:**

```rust
pub async fn page_index(path: &Path, config: Config) -> Result<DocumentStructure>
```

## Concurrency Patterns

The Python code uses `asyncio.gather` extensively for parallel LLM calls:

```python
tasks = [check_title_appearance(item, ...) for item in items]
results = await asyncio.gather(*tasks)
```

**Rust equivalent:**

```rust
use futures::future::join_all;

let tasks: Vec<_> = items.iter()
    .map(|item| check_title_appearance(item, ...))
    .collect();
let results = join_all(tasks).await;
```

Or with `tokio::JoinSet` for better error handling.

## LLM Prompts

The Python code contains ~15 different prompts for various tasks. These should
be extracted as constants or template strings:

1. `toc_detector_single_page` - Detect if page contains TOC
2. `extract_toc_content` - Extract raw TOC text
3. `toc_transformer` - Convert TOC to JSON structure
4. `toc_index_extractor` - Map sections to physical pages
5. `check_title_appearance` - Verify section starts on claimed page
6. `check_title_appearance_in_start` - Check if section is at page start
7. `add_page_number_to_toc` - Fill in missing page numbers
8. `generate_toc_init` - Generate structure without TOC
9. `generate_toc_continue` - Continue structure generation
10. `single_toc_item_index_fixer` - Fix incorrect page mapping
11. `check_if_toc_extraction_is_complete` - Validate TOC completeness
12. `check_if_toc_transformation_is_complete` - Validate JSON transformation
13. `detect_page_index` - Check if TOC has page numbers

## Error Handling

Python uses exceptions; Rust should use `Result<T, E>`:

```rust
#[derive(Debug, thiserror::Error)]
pub enum PageIndexError {
    #[error("PDF parsing failed: {0}")]
    PdfError(String),

    #[error("OpenAI API error: {0}")]
    OpenAiError(#[from] async_openai::error::OpenAIError),

    #[error("Invalid JSON from LLM: {0}")]
    JsonParseError(String),

    #[error("TOC extraction failed after {0} attempts")]
    TocExtractionFailed(u32),

    #[error("Document validation failed: {0}")]
    ValidationError(String),
}
```

## Testing Strategy

The Python repo has test fixtures in `tests/results/` with expected JSON
outputs. Port these as integration tests:

```rust
#[tokio::test]
async fn test_annual_report_structure() {
    let result = page_index("tests/fixtures/2023-annual-report.pdf", config).await?;
    let expected: DocumentStructure = serde_json::from_str(include_str!(
        "../tests/results/2023-annual-report_structure.json"
    ))?;
    assert_eq!(result.structure, expected);
}
```

## Implementation Order

Suggested porting sequence:

1. **Data structures** - Define all types with serde
2. **Config loading** - YAML + env vars
3. **PDF parsing** - Text extraction per page
4. **Token counting** - tiktoken-rs integration
5. **OpenAI client wrapper** - With retry logic
6. **JSON extraction** - Lenient parsing from LLM output
7. **TOC detection** - Single page detector
8. **TOC extraction** - Full pipeline
9. **Verification** - Title appearance checks
10. **Fixing** - Incorrect TOC correction
11. **Tree building** - Hierarchical structure
12. **CLI** - `clap` for argument parsing

## Performance Considerations

- **Parallel LLM calls**: The Python code already parallelizes well; maintain
  this
- **PDF parsing**: Consider lazy loading pages for large documents
- **Token counting**: Cache token counts per page
- **Memory**: Stream large PDFs rather than loading entirely

## Open Questions

1. Should we support the same CLI interface as Python?
2. Should we add a library API in addition to CLI?
3. Support for non-OpenAI models (Anthropic, local)?
4. WebAssembly target for browser use?
