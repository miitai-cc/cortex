//! TOC verification functionality.
//!
//! Verifies that extracted TOC items correctly map to their pages.

use crate::error::Result;
use crate::llm::{
    extract_json, format_prompt, LlmClient, CHECK_TITLE_APPEARANCE_IN_START_PROMPT,
    CHECK_TITLE_APPEARANCE_PROMPT,
};
use crate::model::{IncorrectTocItem, PageContent, TocItem, VerificationResult};
use futures::future::join_all;
use serde::Deserialize;

/// Checks if a title appears on the specified page.
pub async fn check_title_appearance<C: LlmClient>(
    item: &TocItem,
    pages: &[PageContent],
    start_index: u32,
    client: &C,
) -> Result<bool> {
    let physical_index = match item.physical_index {
        Some(idx) => idx,
        None => return Ok(false),
    };

    let page_idx = (physical_index - start_index) as usize;
    if page_idx >= pages.len() {
        return Ok(false);
    }

    let page_text = &pages[page_idx].text;
    let prompt = format_prompt(
        CHECK_TITLE_APPEARANCE_PROMPT,
        &[("title", &item.title), ("page_text", page_text)],
    );

    let response = client.complete(&prompt).await?;

    #[derive(Deserialize)]
    struct AppearanceResponse {
        answer: String,
    }

    let parsed: AppearanceResponse = extract_json(&response)?;
    Ok(parsed.answer.eq_ignore_ascii_case("yes"))
}

/// Checks if a title appears at the start of its page.
pub async fn check_title_appearance_in_start<C: LlmClient>(
    title: &str,
    page_text: &str,
    client: &C,
) -> Result<bool> {
    let prompt = format_prompt(
        CHECK_TITLE_APPEARANCE_IN_START_PROMPT,
        &[("title", title), ("page_text", page_text)],
    );

    let response = client.complete(&prompt).await?;

    #[derive(Deserialize)]
    struct StartResponse {
        start_begin: String,
    }

    let parsed: StartResponse = extract_json(&response)?;
    Ok(parsed.start_begin.eq_ignore_ascii_case("yes"))
}

/// Checks all items for title appearance in start position (concurrent).
pub async fn check_title_appearance_in_start_concurrent<C: LlmClient>(
    items: &mut [TocItem],
    pages: &[PageContent],
    client: &C,
) -> Result<()> {
    // Collect items that need checking
    let checks: Vec<_> = items
        .iter()
        .enumerate()
        .filter_map(|(idx, item)| {
            item.physical_index.map(|phys_idx| {
                let page_idx = (phys_idx - 1) as usize;
                (
                    idx,
                    item.title.clone(),
                    pages.get(page_idx).map(|p| p.text.clone()),
                )
            })
        })
        .filter_map(|(idx, title, page_text)| page_text.map(|text| (idx, title, text)))
        .collect();

    // Run checks concurrently
    let futures: Vec<_> = checks
        .iter()
        .map(|(_, title, page_text)| check_title_appearance_in_start(title, page_text, client))
        .collect();

    let results = join_all(futures).await;

    // Apply results
    for ((idx, _, _), result) in checks.iter().zip(results) {
        match result {
            Ok(true) => items[*idx].appear_start = Some("yes".to_string()),
            _ => items[*idx].appear_start = Some("no".to_string()),
        }
    }

    // Set "no" for items without physical_index
    for item in items.iter_mut() {
        if item.physical_index.is_none() && item.appear_start.is_none() {
            item.appear_start = Some("no".to_string());
        }
    }

    Ok(())
}

/// Verifies TOC items by checking if titles appear on their claimed pages.
///
/// # Arguments
///
/// * `items` - TOC items to verify
/// * `pages` - Document pages
/// * `start_index` - Starting page index (usually 1)
/// * `sample_count` - Number of items to sample (None = all)
/// * `client` - LLM client
///
/// # Returns
///
/// Verification result with accuracy and incorrect items.
pub async fn verify_toc<C: LlmClient>(
    items: &[TocItem],
    pages: &[PageContent],
    start_index: u32,
    sample_count: Option<usize>,
    client: &C,
) -> Result<VerificationResult> {
    // Filter items with valid physical indices
    let valid_items: Vec<_> = items
        .iter()
        .enumerate()
        .filter(|(_, item)| item.physical_index.is_some())
        .collect();

    if valid_items.is_empty() {
        return Ok(VerificationResult {
            accuracy: 0.0,
            incorrect_results: vec![],
        });
    }

    // Check if last physical index is reasonable
    let last_physical_index = items
        .iter()
        .rev()
        .find_map(|item| item.physical_index)
        .unwrap_or(0);

    if last_physical_index < pages.len() as u32 / 2 {
        // Last index is too early, likely all wrong
        return Ok(VerificationResult {
            accuracy: 0.0,
            incorrect_results: vec![],
        });
    }

    // Sample items to check
    let items_to_check: Vec<_> = match sample_count {
        Some(n) if n < valid_items.len() => {
            use rand::seq::SliceRandom;
            let mut rng = rand::thread_rng();
            let mut sampled = valid_items.clone();
            sampled.shuffle(&mut rng);
            sampled.into_iter().take(n).collect()
        }
        _ => valid_items,
    };

    // Run verification checks concurrently
    let futures: Vec<_> = items_to_check
        .iter()
        .map(|(idx, item)| async move {
            let appears = check_title_appearance(item, pages, start_index, client).await?;
            Ok::<_, crate::error::PageIndexError>((*idx, item, appears))
        })
        .collect();

    let results = join_all(futures).await;

    // Process results
    let mut correct_count = 0;
    let mut incorrect_results = Vec::new();

    for result in results {
        match result {
            Ok((_idx, _item, true)) => correct_count += 1,
            Ok((idx, item, false)) => {
                incorrect_results.push(IncorrectTocItem {
                    list_index: idx,
                    title: item.title.clone(),
                    page_number: item.physical_index,
                });
            }
            Err(e) => {
                tracing::warn!("Verification check failed: {}", e);
            }
        }
    }

    let total_checked = correct_count + incorrect_results.len();
    let accuracy = if total_checked > 0 {
        correct_count as f64 / total_checked as f64
    } else {
        0.0
    };

    tracing::info!(
        "Verification complete: {:.1}% accuracy ({}/{} correct)",
        accuracy * 100.0,
        correct_count,
        total_checked
    );

    Ok(VerificationResult {
        accuracy,
        incorrect_results,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_verification_result() {
        let result = VerificationResult {
            accuracy: 0.8,
            incorrect_results: vec![IncorrectTocItem {
                list_index: 5,
                title: "Chapter 6".to_string(),
                page_number: Some(50),
            }],
        };

        assert_eq!(result.accuracy, 0.8);
        assert_eq!(result.incorrect_results.len(), 1);
    }
}
