//! Table of Contents detection, extraction, and processing.
//!
//! This module handles all TOC-related operations:
//! - Detecting if a document has a TOC
//! - Extracting the TOC content
//! - Transforming TOC into structured format
//! - Verifying and fixing page mappings

mod detection;
mod extraction;
mod fixing;
mod verification;

pub use detection::*;
pub use extraction::*;
pub use fixing::*;
pub use verification::*;

use crate::config::Config;
use crate::error::Result;
use crate::llm::LlmClient;
use crate::model::{PageContent, TocItem};
use regex::Regex;

/// Main entry point for TOC processing.
///
/// This function orchestrates the full TOC pipeline:
/// 1. Detect TOC pages
/// 2. Extract TOC content
/// 3. Transform to structured format
/// 4. Map to physical pages
/// 5. Verify and fix mappings
pub async fn process_toc<C: LlmClient>(
    pages: &[PageContent],
    client: &C,
    config: &Config,
) -> Result<Vec<TocItem>> {
    // Step 1: Detect and extract TOC
    let detection = check_toc(pages, client, config).await?;

    if !detection.has_toc() {
        // No TOC found - generate structure from content
        tracing::info!("No TOC found, generating structure from document content");
        return process_no_toc(pages, 1, client, config).await;
    }

    tracing::info!(
        "TOC found on pages {:?}, has_page_numbers: {}",
        detection.toc_page_list,
        detection.page_index_given_in_toc
    );

    // Step 2: Process based on whether TOC has page numbers
    let toc_items = if detection.page_index_given_in_toc {
        process_toc_with_page_numbers(
            detection.toc_content.as_deref().unwrap(),
            &detection.toc_page_list,
            pages,
            client,
            config,
        )
        .await?
    } else {
        process_toc_no_page_numbers(
            detection.toc_content.as_deref().unwrap(),
            &detection.toc_page_list,
            pages,
            client,
            config,
        )
        .await?
    };

    // Step 3: Verify and fix if needed
    let verified = verify_and_fix_toc(toc_items, pages, 1, client, config).await?;

    Ok(verified)
}

/// Processes a document with a TOC that includes page numbers.
pub async fn process_toc_with_page_numbers<C: LlmClient>(
    toc_content: &str,
    toc_page_list: &[usize],
    pages: &[PageContent],
    client: &C,
    config: &Config,
) -> Result<Vec<TocItem>> {
    // Transform TOC to JSON structure
    let toc_with_page_number = transform_toc(toc_content, client).await?;
    tracing::debug!("Transformed TOC: {} items", toc_with_page_number.len());

    // Create version without page numbers for index extraction
    let toc_no_page_number: Vec<_> = toc_with_page_number
        .iter()
        .map(|item| TocItem {
            page: None,
            ..item.clone()
        })
        .collect();

    // Get physical indices from document content
    let start_page_index = toc_page_list.last().map(|&p| p + 1).unwrap_or(0);
    let main_content = build_page_content_with_tags(
        pages,
        start_page_index,
        (start_page_index + config.toc_check_page_num).min(pages.len()),
    );

    let toc_with_physical_index =
        extract_toc_indices(&toc_no_page_number, &main_content, client).await?;

    // Calculate page offset
    let matching_pairs = extract_matching_page_pairs(
        &toc_with_page_number,
        &toc_with_physical_index,
        start_page_index,
    );
    let offset = calculate_page_offset(&matching_pairs);

    tracing::debug!("Calculated page offset: {:?}", offset);

    // Apply offset to all items
    let mut result = if let Some(offset) = offset {
        apply_page_offset(&toc_with_page_number, offset)
    } else {
        toc_with_page_number
    };

    // Fix any items without physical_index
    result = fix_none_page_numbers(result, pages, 1, client).await?;

    Ok(result)
}

/// Processes a document with a TOC but no page numbers.
pub async fn process_toc_no_page_numbers<C: LlmClient>(
    toc_content: &str,
    _toc_page_list: &[usize],
    pages: &[PageContent],
    client: &C,
    config: &Config,
) -> Result<Vec<TocItem>> {
    // Transform TOC to JSON
    let toc_items = transform_toc(toc_content, client).await?;

    // Build page content groups
    let page_groups = group_pages_for_processing(pages, 1, &config.model)?;

    // Add page numbers by scanning content
    let mut result = toc_items;
    for group in &page_groups {
        result = add_page_numbers_to_toc(group, &result, client).await?;
    }

    // Convert physical_index strings to integers
    result = convert_physical_indices(result);

    Ok(result)
}

/// Processes a document with no TOC by extracting structure from content.
pub async fn process_no_toc<C: LlmClient>(
    pages: &[PageContent],
    start_index: u32,
    client: &C,
    config: &Config,
) -> Result<Vec<TocItem>> {
    let page_groups = group_pages_for_processing(pages, start_index, &config.model)?;

    // Generate initial structure from first group
    let mut toc_items = generate_toc_init(&page_groups[0], client).await?;

    // Continue with remaining groups
    for group in page_groups.iter().skip(1) {
        let additional = generate_toc_continue(&toc_items, group, client).await?;
        toc_items.extend(additional);
    }

    // Convert physical_index strings to integers
    toc_items = convert_physical_indices(toc_items);

    Ok(toc_items)
}

/// Builds page content string with physical index tags.
fn build_page_content_with_tags(pages: &[PageContent], start: usize, end: usize) -> String {
    pages[start..end.min(pages.len())]
        .iter()
        .map(|p| p.with_tags())
        .collect()
}

/// Groups pages for LLM processing based on token limits.
fn group_pages_for_processing(
    pages: &[PageContent],
    start_index: u32,
    _model: &str,
) -> Result<Vec<String>> {
    use crate::pdf::group_pages_by_tokens;

    // Re-tag pages with correct indices
    let tagged_pages: Vec<_> = pages
        .iter()
        .enumerate()
        .map(|(i, p)| PageContent::new(p.text.clone(), p.token_count, start_index + i as u32))
        .collect();

    Ok(group_pages_by_tokens(&tagged_pages, 20000, 1))
}

/// Converts physical_index strings to integers.
fn convert_physical_indices(items: Vec<TocItem>) -> Vec<TocItem> {
    items.into_iter().collect()
}

/// Extracts pairs of matching TOC and physical indices.
fn extract_matching_page_pairs(
    toc_page: &[TocItem],
    toc_physical: &[TocItem],
    start_page_index: usize,
) -> Vec<(u32, u32)> {
    let mut pairs = Vec::new();

    for phy_item in toc_physical {
        for page_item in toc_page {
            if phy_item.title == page_item.title {
                if let (Some(physical), Some(page)) = (phy_item.physical_index, page_item.page) {
                    if physical as usize >= start_page_index {
                        pairs.push((physical, page));
                    }
                }
            }
        }
    }

    pairs
}

/// Calculates the page offset between TOC page numbers and physical indices.
fn calculate_page_offset(pairs: &[(u32, u32)]) -> Option<i32> {
    if pairs.is_empty() {
        return None;
    }

    // Count occurrences of each difference
    let mut counts = std::collections::HashMap::new();
    for (physical, page) in pairs {
        let diff = *physical as i32 - *page as i32;
        *counts.entry(diff).or_insert(0) += 1;
    }

    // Return the most common difference
    counts
        .into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(diff, _)| diff)
}

/// Applies page offset to TOC items.
fn apply_page_offset(items: &[TocItem], offset: i32) -> Vec<TocItem> {
    items
        .iter()
        .map(|item| {
            let mut new_item = item.clone();
            if let Some(page) = item.page {
                new_item.physical_index = Some((page as i32 + offset) as u32);
                new_item.page = None;
            }
            new_item
        })
        .collect()
}

/// Transforms dots in TOC content to colons.
pub fn transform_dots_to_colon(text: &str) -> String {
    let re1 = Regex::new(r"\.{5,}").unwrap();
    let re2 = Regex::new(r"(?:\. ){5,}\.?").unwrap();

    let result = re1.replace_all(text, ": ");
    re2.replace_all(&result, ": ").to_string()
}

/// Adds preface section if document doesn't start with first section.
pub fn add_preface_if_needed(mut items: Vec<TocItem>) -> Vec<TocItem> {
    if items.is_empty() {
        return items;
    }

    if let Some(first) = items.first() {
        if first.physical_index.is_some_and(|idx| idx > 1) {
            items.insert(
                0,
                TocItem {
                    structure: Some("0".to_string()),
                    title: "Preface".to_string(),
                    physical_index: Some(1),
                    page: None,
                    appear_start: None,
                    list_index: None,
                },
            );
        }
    }

    items
}

/// Validates and removes TOC items with indices exceeding document length.
pub fn validate_and_truncate_physical_indices(
    items: Vec<TocItem>,
    page_count: usize,
    start_index: u32,
) -> Vec<TocItem> {
    let max_allowed = page_count as u32 + start_index - 1;

    items
        .into_iter()
        .map(|mut item| {
            if item.physical_index.is_some_and(|idx| idx > max_allowed) {
                tracing::warn!(
                    "Removing physical_index for '{}' (was {}, exceeds document length)",
                    item.title,
                    item.physical_index.unwrap()
                );
                item.physical_index = None;
            }
            item
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transform_dots_to_colon() {
        assert_eq!(
            transform_dots_to_colon("Chapter 1......10"),
            "Chapter 1: 10"
        );
        assert_eq!(transform_dots_to_colon("Title . . . . . . 5"), "Title : 5");
    }

    #[test]
    fn test_calculate_page_offset() {
        let pairs = vec![(5, 1), (10, 6), (15, 11)];
        assert_eq!(calculate_page_offset(&pairs), Some(4));
    }

    #[test]
    fn test_add_preface_if_needed() {
        let items = vec![TocItem::new("Chapter 1").with_physical_index(5)];
        let result = add_preface_if_needed(items);

        assert_eq!(result.len(), 2);
        assert_eq!(result[0].title, "Preface");
        assert_eq!(result[0].physical_index, Some(1));
    }

    #[test]
    fn test_validate_and_truncate() {
        let items = vec![
            TocItem::new("Valid").with_physical_index(5),
            TocItem::new("Invalid").with_physical_index(100),
        ];

        let result = validate_and_truncate_physical_indices(items, 10, 1);

        assert_eq!(result[0].physical_index, Some(5));
        assert_eq!(result[1].physical_index, None);
    }
}
