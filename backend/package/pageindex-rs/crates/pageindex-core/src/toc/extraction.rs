//! TOC extraction and transformation.
//!
//! Converts raw TOC text into structured TocItem format.

use crate::error::Result;
use crate::llm::{
    extract_json, extract_json_value, format_prompt, parse_physical_index, LlmClient,
    ADD_PAGE_NUMBER_TO_TOC_PROMPT, CONTINUE_TOC_TRANSFORMATION_PROMPT,
    GENERATE_TOC_CONTINUE_PROMPT, GENERATE_TOC_INIT_PROMPT, TOC_INDEX_EXTRACTOR_PROMPT,
    TOC_TRANSFORMATION_COMPLETE_PROMPT, TOC_TRANSFORMER_PROMPT,
};
use crate::model::TocItem;
use serde::Deserialize;

/// Transforms raw TOC content into structured JSON format.
pub async fn transform_toc<C: LlmClient>(toc_content: &str, client: &C) -> Result<Vec<TocItem>> {
    let prompt = format!(
        "{}\n Given table of contents\n:{}",
        TOC_TRANSFORMER_PROMPT, toc_content
    );

    let response = client.complete_with_reason(&prompt).await?;

    // Check if transformation is complete
    let is_complete = check_transformation_complete(toc_content, &response.content, client).await?;

    if is_complete && response.finish_reason.is_complete() {
        return parse_toc_response(&response.content);
    }

    // Need to continue the transformation
    let mut combined = extract_json_content(&response.content);

    let mut attempts = 0;
    const MAX_ATTEMPTS: usize = 5;

    while attempts < MAX_ATTEMPTS {
        let is_complete = check_transformation_complete(toc_content, &combined, client).await?;

        if is_complete {
            break;
        }

        // Continue the transformation
        let continue_prompt = format_prompt(
            CONTINUE_TOC_TRANSFORMATION_PROMPT,
            &[("raw_toc", toc_content), ("incomplete_toc", &combined)],
        );

        let continuation = client.complete_with_reason(&continue_prompt).await?;

        // Append new content
        let new_content = extract_json_content(&continuation.content);
        combined = merge_json_content(&combined, &new_content);

        if continuation.finish_reason.is_complete() {
            break;
        }

        attempts += 1;
    }

    parse_toc_response(&combined)
}

/// Checks if TOC transformation is complete.
async fn check_transformation_complete<C: LlmClient>(
    raw_toc: &str,
    transformed: &str,
    client: &C,
) -> Result<bool> {
    let prompt = format!(
        "{}\n Raw Table of contents:\n{}\n Cleaned Table of contents:\n{}",
        TOC_TRANSFORMATION_COMPLETE_PROMPT, raw_toc, transformed
    );

    let response = client.complete(&prompt).await?;

    #[derive(Deserialize)]
    struct CompleteResponse {
        completed: String,
    }

    let parsed: CompleteResponse = extract_json(&response)?;
    Ok(parsed.completed.eq_ignore_ascii_case("yes"))
}

/// Extracts physical indices by matching TOC items to document pages.
pub async fn extract_toc_indices<C: LlmClient>(
    toc: &[TocItem],
    content: &str,
    client: &C,
) -> Result<Vec<TocItem>> {
    let toc_json = serde_json::to_string(toc)?;
    let prompt = format!(
        "{}\nTable of contents:\n{}\nDocument pages:\n{}",
        TOC_INDEX_EXTRACTOR_PROMPT, toc_json, content
    );

    let response = client.complete(&prompt).await?;
    parse_toc_response(&response)
}

/// Adds page numbers to TOC by scanning document content.
pub async fn add_page_numbers_to_toc<C: LlmClient>(
    content: &str,
    structure: &[TocItem],
    client: &C,
) -> Result<Vec<TocItem>> {
    let structure_json = serde_json::to_string(structure)?;
    let prompt = format!(
        "{}\n\nCurrent Partial Document:\n{}\n\nGiven Structure\n{}",
        ADD_PAGE_NUMBER_TO_TOC_PROMPT, content, structure_json
    );

    let response = client.complete(&prompt).await?;
    let mut items = parse_toc_response(&response)?;

    // Remove 'start' field from response (it's temporary)
    for _item in &mut items {
        // The 'start' field would be in the raw JSON but TocItem doesn't have it
        // so it's automatically ignored during deserialization
    }

    Ok(items)
}

/// Generates initial TOC structure when no TOC is present.
pub async fn generate_toc_init<C: LlmClient>(content: &str, client: &C) -> Result<Vec<TocItem>> {
    let prompt = format!("{}\nGiven text\n:{}", GENERATE_TOC_INIT_PROMPT, content);

    let response = client.complete_with_reason(&prompt).await?;

    if response.finish_reason.is_complete() {
        return parse_toc_response(&response.content);
    }

    Err(crate::error::PageIndexError::TocExtractionError(format!(
        "TOC generation incomplete: {:?}",
        response.finish_reason
    )))
}

/// Continues TOC structure generation for subsequent content.
pub async fn generate_toc_continue<C: LlmClient>(
    previous_toc: &[TocItem],
    content: &str,
    client: &C,
) -> Result<Vec<TocItem>> {
    let previous_json = serde_json::to_string(previous_toc)?;
    let prompt = format!(
        "{}\nGiven text\n:{}\nPrevious tree structure\n:{}",
        GENERATE_TOC_CONTINUE_PROMPT, content, previous_json
    );

    let response = client.complete_with_reason(&prompt).await?;

    if response.finish_reason.is_complete() {
        return parse_toc_response(&response.content);
    }

    Err(crate::error::PageIndexError::TocExtractionError(format!(
        "TOC continuation incomplete: {:?}",
        response.finish_reason
    )))
}

/// Fixes TOC items that are missing physical indices.
pub async fn fix_none_page_numbers<C: LlmClient>(
    items: Vec<TocItem>,
    pages: &[crate::model::PageContent],
    start_index: u32,
    client: &C,
) -> Result<Vec<TocItem>> {
    let mut result = items;

    for i in 0..result.len() {
        if result[i].physical_index.is_some() {
            continue;
        }

        // Find previous and next valid physical indices
        let prev_index = result[..i]
            .iter()
            .rev()
            .find_map(|item| item.physical_index)
            .unwrap_or(start_index);

        let next_index = result[i + 1..]
            .iter()
            .find_map(|item| item.physical_index)
            .unwrap_or(pages.len() as u32 + start_index - 1);

        // Build content for the range
        let content: String = ((prev_index - start_index) as usize
            ..(next_index - start_index + 1) as usize)
            .filter_map(|idx| pages.get(idx))
            .map(|p| p.with_tags())
            .collect();

        // Ask LLM to find the correct page
        let single_item = vec![result[i].clone()];
        let fixed = add_page_numbers_to_toc(&content, &single_item, client).await?;

        if let Some(fixed_item) = fixed.first() {
            result[i].physical_index = fixed_item.physical_index;
        }
    }

    Ok(result)
}

/// Parses TOC response which may be wrapped in table_of_contents.
fn parse_toc_response(content: &str) -> Result<Vec<TocItem>> {
    let mut value = extract_json_value(content)?;

    if value.is_array() {
        if let Some(items) = value.as_array_mut() {
            normalize_physical_indices(items);
        }
        return serde_json::from_value(value).map_err(|e| {
            crate::error::PageIndexError::JsonParseError(format!(
                "Failed to parse TOC response: {}",
                e
            ))
        });
    }

    if let Some(obj) = value.as_object_mut() {
        if let Some(items_value) = obj.get_mut("table_of_contents") {
            if let Some(items) = items_value.as_array_mut() {
                normalize_physical_indices(items);
            } else {
                return Err(crate::error::PageIndexError::JsonParseError(
                    "table_of_contents must be an array".into(),
                ));
            }

            return serde_json::from_value(items_value.clone()).map_err(|e| {
                crate::error::PageIndexError::JsonParseError(format!(
                    "Failed to parse TOC response: {}",
                    e
                ))
            });
        }
    }

    Err(crate::error::PageIndexError::JsonParseError(
        "Failed to parse TOC response".into(),
    ))
}

fn normalize_physical_indices(items: &mut [serde_json::Value]) {
    for item in items.iter_mut() {
        if let Some(obj) = item.as_object_mut() {
            if let Some(value) = obj.get("physical_index").cloned() {
                if let Some(parsed) = parse_physical_index(&value) {
                    obj.insert(
                        "physical_index".to_string(),
                        serde_json::Value::Number(parsed.into()),
                    );
                } else if !value.is_null() {
                    obj.insert("physical_index".to_string(), serde_json::Value::Null);
                }
            }
        }
    }
}

/// Extracts JSON content from markdown fence or returns as-is.
fn extract_json_content(content: &str) -> String {
    if let Some(start) = content.find("```json") {
        let start = start + 7;
        if let Some(end) = content[start..].rfind("```") {
            return content[start..start + end].trim().to_string();
        }
    }
    content.trim().to_string()
}

/// Merges two partial JSON contents.
fn merge_json_content(first: &str, second: &str) -> String {
    // Find the last complete object in first
    if let Some(pos) = first.rfind('}') {
        let mut result = first[..=pos].to_string();

        // Append second content, handling the array continuation
        let second_trimmed = second.trim();
        if let Some(stripped) = second_trimmed.strip_prefix('[') {
            // Remove the opening [ and merge
            result.push_str(stripped);
        } else {
            result.push_str(second_trimmed);
        }

        return result;
    }

    format!("{}{}", first, second)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_toc_response_array() {
        let content = r#"[
            {"structure": "1", "title": "Chapter 1", "physical_index": 1},
            {"structure": "2", "title": "Chapter 2", "physical_index": 10}
        ]"#;

        let result = parse_toc_response(content).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].title, "Chapter 1");
    }

    #[test]
    fn test_parse_toc_response_wrapped() {
        let content = r#"{
            "table_of_contents": [
                {"structure": "1", "title": "Intro", "page": 1}
            ]
        }"#;

        let result = parse_toc_response(content).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].title, "Intro");
    }

    #[test]
    fn test_parse_toc_response_physical_index_string() {
        let content = r#"[
            {"structure": "1", "title": "Chapter 1", "physical_index": "<physical_index_3>"},
            {"structure": "2", "title": "Chapter 2", "physical_index": "physical_index_7"}
        ]"#;

        let result = parse_toc_response(content).unwrap();
        assert_eq!(result[0].physical_index, Some(3));
        assert_eq!(result[1].physical_index, Some(7));
    }

    #[test]
    fn test_extract_json_content() {
        let content = "Here's the result:\n```json\n{\"key\": \"value\"}\n```\nDone.";
        let extracted = extract_json_content(content);
        assert_eq!(extracted, "{\"key\": \"value\"}");
    }
}
