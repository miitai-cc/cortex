//! Main processing pipeline for PageIndex.
//!
//! Orchestrates the full document indexing workflow.

use crate::config::Config;
use crate::error::Result;
use crate::llm::LlmClient;
use crate::model::{DocumentStructure, PageContent};
use crate::pdf::{get_page_tokens, get_pdf_name};
use crate::toc::{self, add_preface_if_needed};
use crate::tree::{self, post_processing, write_node_ids};
use std::path::Path;

/// Main entry point for indexing a PDF document.
///
/// This function orchestrates the full indexing pipeline:
/// 1. Extract text from PDF pages
/// 2. Detect and process table of contents
/// 3. Build hierarchical document tree
/// 4. Optionally generate summaries and descriptions
///
/// # Arguments
///
/// * `path` - Path to the PDF file
/// * `client` - LLM client for processing
/// * `config` - Configuration options
///
/// # Returns
///
/// The complete document structure with all requested enrichments.
pub async fn page_index<P: AsRef<Path>, C: LlmClient>(
    path: P,
    client: &C,
    config: &Config,
) -> Result<DocumentStructure> {
    let path = path.as_ref();

    // Validate config
    config.validate()?;

    tracing::info!("Starting PageIndex for: {}", path.display());

    // Step 1: Parse PDF and extract page content
    let pages = get_page_tokens(path, &config.model)?;

    tracing::info!(
        "Parsed PDF: {} pages, {} total tokens",
        pages.len(),
        pages.iter().map(|p| p.token_count).sum::<usize>()
    );

    // Step 2: Process using common pipeline
    page_index_from_pages(&pages, get_pdf_name(path), client, config).await
}

/// Indexes a document from pre-parsed page content.
///
/// Useful when PDF parsing has already been done or when working with
/// non-PDF sources.
pub async fn page_index_from_pages<C: LlmClient>(
    pages: &[PageContent],
    doc_name: String,
    client: &C,
    config: &Config,
) -> Result<DocumentStructure> {
    // Step 1: Process TOC
    let toc_items = toc::process_toc(pages, client, config).await?;

    tracing::info!("Extracted {} TOC items", toc_items.len());

    // Step 2: Add preface if needed
    let toc_items = add_preface_if_needed(toc_items);

    // Step 3: Check title appearances at page starts
    let mut toc_items = toc_items;
    toc::check_title_appearance_in_start_concurrent(&mut toc_items, pages, client).await?;

    // Step 4: Filter items with valid physical_index
    let valid_items: Vec<_> = toc_items
        .into_iter()
        .filter(|item| item.physical_index.is_some())
        .collect();

    // Step 5: Convert to tree structure
    let mut structure = post_processing(valid_items, pages.len() as u32);

    // Step 6: Process large nodes
    tree::process_large_nodes(&mut structure, pages, client, config).await?;

    // Step 7: Add node IDs if requested
    if config.if_add_node_id {
        write_node_ids(&mut structure);
    }

    // Step 8: Add text if requested (needed for summaries)
    if config.if_add_node_text || config.if_add_node_summary {
        tree::add_node_text(&mut structure, pages);
    }

    // Step 9: Generate summaries if requested
    if config.if_add_node_summary {
        tree::generate_summaries(&mut structure, client).await?;

        // Remove text if not explicitly requested
        if !config.if_add_node_text {
            tree::remove_text(&mut structure);
        }
    }

    // Step 10: Generate document description if requested
    let doc_description = if config.if_add_doc_description {
        Some(tree::generate_doc_description(&structure, client).await?)
    } else {
        None
    };

    tracing::info!("PageIndex complete: {} root sections", structure.len());

    Ok(DocumentStructure {
        doc_name,
        doc_description,
        structure,
    })
}

/// Indexes a PDF from bytes.
///
/// Useful for processing PDFs from network streams or memory.
pub async fn page_index_from_bytes<C: LlmClient>(
    data: &[u8],
    doc_name: String,
    client: &C,
    config: &Config,
) -> Result<DocumentStructure> {
    let pages = crate::pdf::get_page_tokens_from_bytes(data, &config.model)?;

    tracing::info!(
        "Parsed PDF from bytes: {} pages, {} total tokens",
        pages.len(),
        pages.iter().map(|p| p.token_count).sum::<usize>()
    );

    page_index_from_pages(&pages, doc_name, client, config).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_validation() {
        let valid = Config::default();
        assert!(valid.validate().is_ok());

        let invalid = Config {
            model: String::new(),
            ..Default::default()
        };
        assert!(invalid.validate().is_err());
    }
}
