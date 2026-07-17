//! TOC fixing functionality.
//!
//! Corrects incorrect page mappings in TOC items.

use crate::config::Config;
use crate::error::Result;
use crate::llm::{extract_json, parse_physical_index, LlmClient, SINGLE_TOC_ITEM_FIXER_PROMPT};
use crate::model::{IncorrectTocItem, PageContent, TocItem};
use serde::Deserialize;

/// Fixes a single TOC item's page index.
pub async fn fix_single_toc_item<C: LlmClient>(
    title: &str,
    content: &str,
    client: &C,
) -> Result<Option<u32>> {
    let prompt = format!(
        "{}\nSection Title:\n{}\nDocument pages:\n{}",
        SINGLE_TOC_ITEM_FIXER_PROMPT, title, content
    );

    let response = client.complete(&prompt).await?;

    #[derive(Deserialize)]
    struct FixerResponse {
        physical_index: serde_json::Value,
    }

    let parsed: FixerResponse = extract_json(&response)?;
    Ok(parse_physical_index(&parsed.physical_index))
}

/// Fixes incorrect TOC items by re-scanning document content.
pub async fn fix_incorrect_toc<C: LlmClient>(
    toc: &mut [TocItem],
    pages: &[PageContent],
    incorrect_results: &[IncorrectTocItem],
    start_index: u32,
    client: &C,
) -> Result<Vec<IncorrectTocItem>> {
    if incorrect_results.is_empty() {
        return Ok(vec![]);
    }

    let incorrect_indices: std::collections::HashSet<_> =
        incorrect_results.iter().map(|r| r.list_index).collect();

    let end_index = pages.len() as u32 + start_index - 1;

    // Process each incorrect item
    let mut still_incorrect = Vec::new();

    for incorrect in incorrect_results {
        let list_index = incorrect.list_index;

        if list_index >= toc.len() {
            still_incorrect.push(incorrect.clone());
            continue;
        }

        // Find range to search in
        let prev_correct = (0..list_index)
            .rev()
            .filter(|i| !incorrect_indices.contains(i))
            .find_map(|i| toc.get(i).and_then(|item| item.physical_index))
            .unwrap_or(start_index.saturating_sub(1));

        let next_correct = (list_index + 1..toc.len())
            .filter(|i| !incorrect_indices.contains(i))
            .find_map(|i| toc.get(i).and_then(|item| item.physical_index))
            .unwrap_or(end_index);

        // Build content for the range
        let content: String = ((prev_correct.saturating_sub(start_index)) as usize
            ..=(next_correct.saturating_sub(start_index)) as usize)
            .filter_map(|idx| pages.get(idx))
            .map(|p| p.with_tags())
            .collect();

        // Try to fix
        match fix_single_toc_item(&incorrect.title, &content, client).await {
            Ok(Some(new_index)) => {
                // Verify the fix
                let mut temp_item = toc[list_index].clone();
                temp_item.physical_index = Some(new_index);

                let appears = super::check_title_appearance(&temp_item, pages, start_index, client)
                    .await
                    .unwrap_or(false);

                if appears {
                    toc[list_index].physical_index = Some(new_index);
                    tracing::debug!(
                        "Fixed '{}': {} -> {}",
                        incorrect.title,
                        incorrect.page_number.unwrap_or(0),
                        new_index
                    );
                } else {
                    still_incorrect.push(IncorrectTocItem {
                        list_index,
                        title: incorrect.title.clone(),
                        page_number: Some(new_index),
                    });
                }
            }
            Ok(None) => {
                still_incorrect.push(incorrect.clone());
            }
            Err(e) => {
                tracing::warn!("Failed to fix '{}': {}", incorrect.title, e);
                still_incorrect.push(incorrect.clone());
            }
        }
    }

    Ok(still_incorrect)
}

/// Fixes incorrect TOC items with retries.
pub async fn fix_incorrect_toc_with_retries<C: LlmClient>(
    toc: &mut [TocItem],
    pages: &[PageContent],
    incorrect_results: Vec<IncorrectTocItem>,
    start_index: u32,
    max_attempts: usize,
    client: &C,
) -> Result<Vec<IncorrectTocItem>> {
    let mut current_incorrect = incorrect_results;
    let mut attempt = 0;

    while !current_incorrect.is_empty() && attempt < max_attempts {
        tracing::info!(
            "Fix attempt {}/{}: {} items to fix",
            attempt + 1,
            max_attempts,
            current_incorrect.len()
        );

        current_incorrect =
            fix_incorrect_toc(toc, pages, &current_incorrect, start_index, client).await?;

        attempt += 1;
    }

    if !current_incorrect.is_empty() {
        tracing::warn!(
            "Could not fix {} items after {} attempts",
            current_incorrect.len(),
            max_attempts
        );
    }

    Ok(current_incorrect)
}

/// Main entry point for verification and fixing.
pub async fn verify_and_fix_toc<C: LlmClient>(
    mut items: Vec<TocItem>,
    pages: &[PageContent],
    start_index: u32,
    client: &C,
    config: &Config,
) -> Result<Vec<TocItem>> {
    // Filter out items without physical_index
    items.retain(|item| item.physical_index.is_some());

    // Validate physical indices
    items = super::validate_and_truncate_physical_indices(items, pages.len(), start_index);

    // Verify TOC
    let verification = super::verify_toc(&items, pages, start_index, None, client).await?;

    if verification.accuracy == 1.0 && verification.incorrect_results.is_empty() {
        tracing::info!("TOC verification passed with 100% accuracy");
        return Ok(items);
    }

    if verification.accuracy > 0.6 && !verification.incorrect_results.is_empty() {
        // Try to fix incorrect items
        let still_incorrect = fix_incorrect_toc_with_retries(
            &mut items,
            pages,
            verification.incorrect_results,
            start_index,
            config.max_fix_attempts,
            client,
        )
        .await?;

        if !still_incorrect.is_empty() {
            tracing::warn!(
                "Some items could not be fixed: {:?}",
                still_incorrect.iter().map(|i| &i.title).collect::<Vec<_>>()
            );
        }

        return Ok(items);
    }

    // Accuracy too low - might need to fallback to different method
    tracing::warn!(
        "TOC verification accuracy too low: {:.1}%",
        verification.accuracy * 100.0
    );

    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_incorrect_toc_item() {
        let item = IncorrectTocItem {
            list_index: 3,
            title: "Chapter 4".to_string(),
            page_number: Some(25),
        };

        assert_eq!(item.list_index, 3);
        assert_eq!(item.title, "Chapter 4");
    }
}
