//! TOC detection functionality.
//!
//! Detects whether a document contains a table of contents and
//! identifies which pages contain it.

use crate::config::Config;
use crate::error::Result;
use crate::llm::{
    extract_json, format_prompt, LlmClient, DETECT_PAGE_INDEX_PROMPT, TOC_DETECTOR_PROMPT,
};
use crate::model::{PageContent, TocDetectionResult};
use serde::Deserialize;

/// Detects if a single page contains a table of contents.
pub async fn detect_toc_single_page<C: LlmClient>(content: &str, client: &C) -> Result<bool> {
    let prompt = format_prompt(TOC_DETECTOR_PROMPT, &[("content", content)]);
    let response = client.complete(&prompt).await?;

    #[derive(Deserialize)]
    struct TocDetectorResponse {
        toc_detected: String,
    }

    let parsed: TocDetectorResponse = extract_json(&response)?;
    Ok(parsed.toc_detected.eq_ignore_ascii_case("yes"))
}

/// Finds all pages that contain the table of contents.
///
/// Starts from `start_page_index` and continues until a non-TOC page
/// is found after finding at least one TOC page.
pub async fn find_toc_pages<C: LlmClient>(
    start_page_index: usize,
    pages: &[PageContent],
    client: &C,
    config: &Config,
) -> Result<Vec<usize>> {
    let mut toc_pages = Vec::new();
    let mut last_page_is_toc = false;
    let mut i = start_page_index;

    while i < pages.len() {
        // Only check beyond max_pages if we're still finding TOC pages
        if i >= config.toc_check_page_num && !last_page_is_toc {
            break;
        }

        let is_toc = detect_toc_single_page(&pages[i].text, client).await?;

        if is_toc {
            tracing::debug!("Page {} contains TOC", i);
            toc_pages.push(i);
            last_page_is_toc = true;
        } else if last_page_is_toc {
            // Found end of TOC
            tracing::debug!("TOC ends at page {}", i - 1);
            break;
        }

        i += 1;
    }

    Ok(toc_pages)
}

/// Detects if page numbers are included in the TOC content.
pub async fn detect_page_numbers_in_toc<C: LlmClient>(
    toc_content: &str,
    client: &C,
) -> Result<bool> {
    let prompt = format_prompt(DETECT_PAGE_INDEX_PROMPT, &[("toc_content", toc_content)]);
    let response = client.complete(&prompt).await?;

    #[derive(Deserialize)]
    struct PageIndexResponse {
        page_index_given_in_toc: String,
    }

    let parsed: PageIndexResponse = extract_json(&response)?;
    Ok(parsed.page_index_given_in_toc.eq_ignore_ascii_case("yes"))
}

/// Checks if the document has a TOC and extracts relevant information.
///
/// This is the main entry point for TOC detection, combining:
/// 1. Finding TOC pages
/// 2. Extracting TOC content
/// 3. Detecting if page numbers are present
pub async fn check_toc<C: LlmClient>(
    pages: &[PageContent],
    client: &C,
    config: &Config,
) -> Result<TocDetectionResult> {
    // Find initial TOC pages
    let toc_pages = find_toc_pages(0, pages, client, config).await?;

    if toc_pages.is_empty() {
        tracing::info!("No TOC found in document");
        return Ok(TocDetectionResult {
            toc_content: None,
            toc_page_list: vec![],
            page_index_given_in_toc: false,
        });
    }

    // Extract and process TOC content
    let toc_content = extract_toc_content_from_pages(pages, &toc_pages);
    let toc_content = super::transform_dots_to_colon(&toc_content);

    // Check if page numbers are present
    let has_page_numbers = detect_page_numbers_in_toc(&toc_content, client).await?;

    if has_page_numbers {
        tracing::info!("TOC found with page numbers on pages {:?}", toc_pages);
        return Ok(TocDetectionResult {
            toc_content: Some(toc_content),
            toc_page_list: toc_pages,
            page_index_given_in_toc: true,
        });
    }

    // No page numbers - check for additional TOC sections
    let mut current_start = toc_pages.last().map(|&p| p + 1).unwrap_or(0);

    while current_start < pages.len() && current_start < config.toc_check_page_num {
        let additional_pages = find_toc_pages(current_start, pages, client, config).await?;

        if additional_pages.is_empty() {
            break;
        }

        let additional_content = extract_toc_content_from_pages(pages, &additional_pages);
        let additional_content = super::transform_dots_to_colon(&additional_content);

        if detect_page_numbers_in_toc(&additional_content, client).await? {
            tracing::info!(
                "TOC found with page numbers on pages {:?}",
                additional_pages
            );
            return Ok(TocDetectionResult {
                toc_content: Some(additional_content),
                toc_page_list: additional_pages,
                page_index_given_in_toc: true,
            });
        }

        current_start = additional_pages
            .last()
            .map(|&p| p + 1)
            .unwrap_or(pages.len());
    }

    // Return TOC without page numbers
    tracing::info!("TOC found without page numbers on pages {:?}", toc_pages);
    Ok(TocDetectionResult {
        toc_content: Some(toc_content),
        toc_page_list: toc_pages,
        page_index_given_in_toc: false,
    })
}

/// Extracts raw TOC content from specified pages.
fn extract_toc_content_from_pages(pages: &[PageContent], toc_pages: &[usize]) -> String {
    toc_pages
        .iter()
        .filter_map(|&idx| pages.get(idx))
        .map(|p| p.text.as_str())
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_toc_page() -> PageContent {
        PageContent::new(
            r#"
Table of Contents

Chapter 1: Introduction ............... 1
Chapter 2: Methods .................... 15
Chapter 3: Results .................... 42
Chapter 4: Discussion ................. 78
Chapter 5: Conclusion ................. 95
References ............................ 100
"#,
            50,
            1,
        )
    }

    fn sample_content_page() -> PageContent {
        PageContent::new(
            r#"
Introduction

This document provides an overview of the research conducted
over the past year. The primary focus was on developing
new methodologies for data analysis.
"#,
            40,
            2,
        )
    }

    #[test]
    fn test_extract_toc_content_from_pages() {
        let pages = vec![sample_toc_page(), sample_content_page()];
        let content = extract_toc_content_from_pages(&pages, &[0]);

        assert!(content.contains("Table of Contents"));
        assert!(content.contains("Chapter 1"));
        assert!(!content.contains("Introduction\n\nThis document"));
    }
}
