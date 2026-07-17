//! PDF parsing and text extraction.
//!
//! This module provides functionality for extracting text from PDF files
//! and counting tokens per page. It supports multiple backends via features:
//! - `mupdf`: Fast C-based PDF parsing (default)
//! - `lopdf`: Pure Rust fallback

use crate::error::{PageIndexError, Result};
use crate::model::PageContent;
use std::path::Path;

/// Extracts text and token counts from all pages of a PDF file.
///
/// # Arguments
///
/// * `path` - Path to the PDF file
/// * `model` - Model name for token counting (e.g., "gpt-4o")
///
/// # Returns
///
/// A vector of `PageContent` containing text and token count for each page.
pub fn get_page_tokens<P: AsRef<Path>>(path: P, model: &str) -> Result<Vec<PageContent>> {
    let path = path.as_ref();

    if !path.exists() {
        return Err(PageIndexError::pdf(format!(
            "PDF file not found: {}",
            path.display()
        )));
    }

    if !path
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("pdf"))
    {
        return Err(PageIndexError::pdf(format!(
            "Not a PDF file: {}",
            path.display()
        )));
    }

    #[cfg(feature = "mupdf")]
    {
        get_page_tokens_mupdf(path, model)
    }

    #[cfg(all(feature = "lopdf", not(feature = "mupdf")))]
    {
        get_page_tokens_lopdf(path, model)
    }

    #[cfg(not(any(feature = "mupdf", feature = "lopdf")))]
    {
        Err(PageIndexError::pdf(
            "No PDF backend available. Enable 'mupdf' or 'lopdf' feature.",
        ))
    }
}

/// Extracts text and token counts from PDF bytes.
///
/// # Arguments
///
/// * `data` - PDF file contents as bytes
/// * `model` - Model name for token counting
pub fn get_page_tokens_from_bytes(data: &[u8], model: &str) -> Result<Vec<PageContent>> {
    #[cfg(feature = "mupdf")]
    {
        get_page_tokens_mupdf_from_bytes(data, model)
    }

    #[cfg(all(feature = "lopdf", not(feature = "mupdf")))]
    {
        get_page_tokens_lopdf_from_bytes(data, model)
    }

    #[cfg(not(any(feature = "mupdf", feature = "lopdf")))]
    {
        Err(PageIndexError::pdf(
            "No PDF backend available. Enable 'mupdf' or 'lopdf' feature.",
        ))
    }
}

#[cfg(feature = "mupdf")]
fn get_page_tokens_mupdf<P: AsRef<Path>>(path: P, model: &str) -> Result<Vec<PageContent>> {
    use mupdf::Document;

    let doc = Document::open(
        path.as_ref()
            .to_str()
            .ok_or_else(|| PageIndexError::pdf("Invalid path encoding"))?,
    )?;

    extract_pages_mupdf(&doc, model)
}

#[cfg(feature = "mupdf")]
fn get_page_tokens_mupdf_from_bytes(data: &[u8], model: &str) -> Result<Vec<PageContent>> {
    use mupdf::Document;

    let doc = Document::from_bytes(data, "")?;
    extract_pages_mupdf(&doc, model)
}

#[cfg(feature = "mupdf")]
fn extract_pages_mupdf(doc: &mupdf::Document, model: &str) -> Result<Vec<PageContent>> {
    let page_count = doc.page_count()?;
    let mut pages = Vec::with_capacity(page_count as usize);

    for page_num in 0..page_count {
        let page = doc.load_page(page_num)?;
        let text = page.to_text()?;
        let token_count = count_tokens(&text, model)?;

        pages.push(PageContent::new(text, token_count, page_num as u32 + 1));
    }

    Ok(pages)
}

#[cfg(feature = "lopdf")]
fn get_page_tokens_lopdf<P: AsRef<Path>>(path: P, model: &str) -> Result<Vec<PageContent>> {
    use lopdf::Document;

    let doc = Document::load(path.as_ref()).map_err(|e| PageIndexError::pdf(e.to_string()))?;
    extract_pages_lopdf(&doc, model)
}

#[cfg(feature = "lopdf")]
fn get_page_tokens_lopdf_from_bytes(data: &[u8], model: &str) -> Result<Vec<PageContent>> {
    use lopdf::Document;
    use std::io::Cursor;

    let doc =
        Document::load_from(Cursor::new(data)).map_err(|e| PageIndexError::pdf(e.to_string()))?;
    extract_pages_lopdf(&doc, model)
}

#[cfg(feature = "lopdf")]
fn extract_pages_lopdf(doc: &lopdf::Document, model: &str) -> Result<Vec<PageContent>> {
    let page_count = doc.get_pages().len();
    let mut pages = Vec::with_capacity(page_count);

    for page_num in 1..=page_count {
        // Use lopdf's built-in extract_text method
        let text = doc
            .extract_text(&[page_num as u32])
            .map_err(|e| PageIndexError::pdf(e.to_string()))?;

        let token_count = count_tokens(&text, model)?;
        pages.push(PageContent::new(text, token_count, page_num as u32));
    }

    Ok(pages)
}

/// Counts the number of tokens in a text string for a given model.
///
/// Uses tiktoken-rs for accurate token counting compatible with OpenAI models.
pub fn count_tokens(text: &str, model: &str) -> Result<usize> {
    if text.is_empty() {
        return Ok(0);
    }

    // Map model names to tiktoken encoding names
    let encoding_name = model_to_encoding(model);

    let bpe = tiktoken_rs::get_bpe_from_model(encoding_name)
        .map_err(|e| PageIndexError::TokenError(format!("Failed to get tokenizer: {}", e)))?;

    Ok(bpe.encode_with_special_tokens(text).len())
}

/// Maps model names to tiktoken encoding names.
fn model_to_encoding(model: &str) -> &str {
    // GPT-4o, GPT-4, GPT-3.5 all use cl100k_base
    if model.contains("gpt-4") || model.contains("gpt-3.5") {
        return "gpt-4o";
    }

    // Claude uses similar tokenization to GPT-4
    if model.contains("claude") {
        return "gpt-4o";
    }

    // Default to GPT-4o tokenizer
    "gpt-4o"
}

/// Extracts the PDF filename without extension.
pub fn get_pdf_name<P: AsRef<Path>>(path: P) -> String {
    let path = path.as_ref();

    // file_name() returns None for paths ending with "/" (directories)
    // file_stem() extracts the name without extension
    match path.file_name() {
        Some(name) if name.to_str().is_some_and(|s| s.contains('.')) => path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string(),
        _ => "Untitled".to_string(),
    }
}

/// Gets the total number of pages in a PDF.
#[cfg(feature = "mupdf")]
pub fn get_page_count<P: AsRef<Path>>(path: P) -> Result<usize> {
    use mupdf::Document;

    let doc = Document::open(
        path.as_ref()
            .to_str()
            .ok_or_else(|| PageIndexError::pdf("Invalid path encoding"))?,
    )?;

    Ok(doc.page_count()? as usize)
}

#[cfg(all(feature = "lopdf", not(feature = "mupdf")))]
pub fn get_page_count<P: AsRef<Path>>(path: P) -> Result<usize> {
    use lopdf::Document;

    let doc = Document::load(path.as_ref()).map_err(|e| PageIndexError::pdf(e.to_string()))?;
    Ok(doc.get_pages().len())
}

/// Groups pages into chunks based on token limits.
///
/// This is used for splitting large documents into manageable pieces
/// for LLM processing.
///
/// # Arguments
///
/// * `pages` - List of page contents
/// * `max_tokens` - Maximum tokens per group
/// * `overlap_pages` - Number of pages to overlap between groups
pub fn group_pages_by_tokens(
    pages: &[PageContent],
    max_tokens: usize,
    overlap_pages: usize,
) -> Vec<String> {
    if pages.is_empty() {
        return vec![];
    }

    let total_tokens: usize = pages.iter().map(|p| p.token_count).sum();

    // If total fits in one chunk, return it all
    if total_tokens <= max_tokens {
        return vec![pages.iter().map(|p| p.with_tags()).collect()];
    }

    // Calculate expected number of parts
    let expected_parts = (total_tokens as f64 / max_tokens as f64).ceil() as usize;
    let average_tokens_per_part = ((total_tokens / expected_parts) + max_tokens) / 2;

    let mut groups = Vec::new();
    let mut current_group: Vec<String> = Vec::new();
    let mut current_tokens = 0;

    for (i, page) in pages.iter().enumerate() {
        if current_tokens + page.token_count > average_tokens_per_part && !current_group.is_empty()
        {
            groups.push(current_group.join(""));

            // Start new group with overlap
            let overlap_start = i.saturating_sub(overlap_pages);
            current_group = pages[overlap_start..i]
                .iter()
                .map(|p| p.with_tags())
                .collect();
            current_tokens = pages[overlap_start..i].iter().map(|p| p.token_count).sum();
        }

        current_group.push(page.with_tags());
        current_tokens += page.token_count;
    }

    // Add the last group
    if !current_group.is_empty() {
        groups.push(current_group.join(""));
    }

    groups
}

/// Extracts text from a range of pages.
///
/// # Arguments
///
/// * `pages` - All page contents
/// * `start_page` - Starting page (1-based, inclusive)
/// * `end_page` - Ending page (1-based, inclusive)
/// * `with_tags` - Whether to include physical index tags
pub fn get_text_of_pages(
    pages: &[PageContent],
    start_page: u32,
    end_page: u32,
    with_tags: bool,
) -> String {
    let start_idx = (start_page.saturating_sub(1)) as usize;
    let end_idx = end_page as usize;

    pages[start_idx..end_idx.min(pages.len())]
        .iter()
        .map(|p| {
            if with_tags {
                p.with_tags()
            } else {
                p.text.clone()
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_count_tokens() {
        let text = "Hello, world! This is a test.";
        let count = count_tokens(text, "gpt-4o").unwrap();
        assert!(count > 0);
        assert!(count < 20); // Should be around 8 tokens
    }

    #[test]
    fn test_count_tokens_empty() {
        let count = count_tokens("", "gpt-4o").unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_model_to_encoding() {
        assert_eq!(model_to_encoding("gpt-4o-2024-11-20"), "gpt-4o");
        assert_eq!(model_to_encoding("gpt-4"), "gpt-4o");
        assert_eq!(model_to_encoding("claude-3-5-sonnet"), "gpt-4o");
    }

    #[test]
    fn test_get_pdf_name() {
        assert_eq!(get_pdf_name("/path/to/document.pdf"), "document");
        assert_eq!(get_pdf_name("report.pdf"), "report");
        assert_eq!(get_pdf_name("/path/to/"), "Untitled");
    }

    #[test]
    fn test_group_pages_small() {
        let pages = vec![
            PageContent::new("Page 1", 10, 1),
            PageContent::new("Page 2", 10, 2),
        ];

        let groups = group_pages_by_tokens(&pages, 100, 1);
        assert_eq!(groups.len(), 1);
    }

    #[test]
    fn test_group_pages_large() {
        let pages: Vec<_> = (1..=10)
            .map(|i| PageContent::new(format!("Page {}", i), 500, i))
            .collect();

        let groups = group_pages_by_tokens(&pages, 1000, 1);
        assert!(groups.len() > 1);
    }
}
