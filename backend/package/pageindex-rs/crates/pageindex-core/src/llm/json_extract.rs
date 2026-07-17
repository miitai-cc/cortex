//! JSON extraction from LLM responses.
//!
//! LLM responses often contain JSON embedded in markdown code blocks or with
//! various formatting issues. This module provides robust extraction and parsing.

use crate::error::{PageIndexError, Result};
use regex::Regex;
use serde::de::DeserializeOwned;

/// Extracts and parses JSON from an LLM response.
///
/// This function handles common issues with LLM-generated JSON:
/// - Markdown code fences (```json ... ```)
/// - Python `None` instead of JSON `null`
/// - Trailing commas
/// - Excessive whitespace
///
/// # Type Parameters
///
/// * `T` - The type to deserialize into. Must implement `DeserializeOwned`.
///
/// # Arguments
///
/// * `content` - The raw LLM response that may contain JSON
///
/// # Returns
///
/// The parsed JSON value, or an error if parsing fails.
pub fn extract_json<T: DeserializeOwned>(content: &str) -> Result<T> {
    let cleaned = clean_json_response(content);

    match serde_json::from_str(&cleaned) {
        Ok(value) => Ok(value),
        Err(e) => {
            // Try additional cleanup
            let further_cleaned = aggressive_cleanup(&cleaned);
            serde_json::from_str(&further_cleaned).map_err(|_| {
                PageIndexError::JsonParseError(format!(
                    "Failed to parse JSON: {}. Content: {}",
                    e,
                    truncate_for_error(&cleaned)
                ))
            })
        }
    }
}

/// Extracts JSON as a generic serde_json::Value.
///
/// Useful when the structure is not known at compile time.
pub fn extract_json_value(content: &str) -> Result<serde_json::Value> {
    extract_json(content)
}

/// Extracts JSON array from response.
pub fn extract_json_array<T: DeserializeOwned>(content: &str) -> Result<Vec<T>> {
    extract_json(content)
}

/// Cleans up common issues in LLM-generated JSON.
fn clean_json_response(content: &str) -> String {
    let mut result = content.to_string();

    // Extract from markdown code fences
    if let Some(json_content) = extract_from_code_fence(&result) {
        result = json_content;
    }

    // Replace Python None with JSON null
    result = result.replace("None", "null");

    // Normalize whitespace (but preserve strings)
    result = normalize_whitespace(&result);

    result.trim().to_string()
}

/// Extracts content from markdown code fences.
fn extract_from_code_fence(content: &str) -> Option<String> {
    // Look for ```json ... ``` pattern
    let start_marker = "```json";
    let end_marker = "```";

    if let Some(start_idx) = content.find(start_marker) {
        let json_start = start_idx + start_marker.len();
        if let Some(end_idx) = content[json_start..].rfind(end_marker) {
            return Some(content[json_start..json_start + end_idx].trim().to_string());
        }
    }

    // Try plain ``` fences
    let plain_start = "```";
    if let Some(start_idx) = content.find(plain_start) {
        let after_fence = start_idx + plain_start.len();
        // Skip any language identifier on the same line
        let content_after = &content[after_fence..];
        let actual_start = content_after.find('\n').map(|i| after_fence + i + 1)?;

        if let Some(end_idx) = content[actual_start..].rfind(end_marker) {
            return Some(
                content[actual_start..actual_start + end_idx]
                    .trim()
                    .to_string(),
            );
        }
    }

    None
}

/// Normalizes whitespace while attempting to preserve string contents.
fn normalize_whitespace(content: &str) -> String {
    // Simple approach: replace multiple whitespace chars with single space
    // This works for most cases but may not perfectly preserve all strings
    let re = Regex::new(r"\s+").unwrap();
    re.replace_all(content, " ").to_string()
}

/// Aggressive cleanup for stubborn JSON.
fn aggressive_cleanup(content: &str) -> String {
    let mut result = content.to_string();

    // Remove trailing commas before } or ]
    let trailing_comma_re = Regex::new(r",\s*([}\]])").unwrap();
    result = trailing_comma_re.replace_all(&result, "$1").to_string();

    // Fix common LLM mistakes
    result = result.replace(r#"\"#, ""); // Remove escaped backslashes
    result = result.replace("True", "true");
    result = result.replace("False", "false");

    result
}

/// Truncates content for error messages.
fn truncate_for_error(content: &str) -> String {
    if content.len() > 200 {
        format!("{}...", &content[..200])
    } else {
        content.to_string()
    }
}

/// Extracts a specific field from a JSON response.
///
/// Useful for responses like `{"answer": "yes", "thinking": "..."}`
/// where you only need one field.
#[allow(dead_code)]
pub fn extract_field<T: DeserializeOwned>(content: &str, field: &str) -> Result<T> {
    let value: serde_json::Value = extract_json(content)?;

    value
        .get(field)
        .cloned()
        .ok_or_else(|| {
            PageIndexError::JsonParseError(format!("Field '{}' not found in response", field))
        })
        .and_then(|v| {
            serde_json::from_value(v).map_err(|e| {
                PageIndexError::JsonParseError(format!("Failed to parse field '{}': {}", field, e))
            })
        })
}

/// Extracts a yes/no answer from a JSON response.
///
/// Handles various formats:
/// - `{"answer": "yes"}`
/// - `{"result": "no"}`
/// - Plain "yes" or "no"
#[allow(dead_code)]
pub fn extract_yes_no(content: &str, field: &str) -> Result<bool> {
    // Try to parse as JSON first
    if let Ok(value) = extract_json_value(content) {
        if let Some(answer) = value.get(field).and_then(|v| v.as_str()) {
            return Ok(answer.eq_ignore_ascii_case("yes"));
        }
    }

    // Fall back to checking the raw content
    let lower = content.to_lowercase();
    if lower.contains("\"yes\"") || lower.contains("'yes'") {
        return Ok(true);
    }
    if lower.contains("\"no\"") || lower.contains("'no'") {
        return Ok(false);
    }

    Err(PageIndexError::JsonParseError(
        "Could not extract yes/no answer from response".to_string(),
    ))
}

/// Converts physical_index strings to integers.
///
/// Handles formats like:
/// - `"<physical_index_5>"`
/// - `"physical_index_5"`
/// - `5` (already an integer)
pub fn parse_physical_index(value: &serde_json::Value) -> Option<u32> {
    match value {
        serde_json::Value::Number(n) => n.as_u64().map(|n| n as u32),
        serde_json::Value::String(s) => {
            // Try to extract number from <physical_index_X> or physical_index_X
            let re = Regex::new(r"physical_index_(\d+)").unwrap();
            if let Some(caps) = re.captures(s) {
                caps.get(1).and_then(|m| m.as_str().parse().ok())
            } else {
                // Try parsing as plain number
                s.trim().parse().ok()
            }
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Debug, Deserialize, PartialEq)]
    struct TestStruct {
        answer: String,
        #[serde(default)]
        thinking: Option<String>,
    }

    #[test]
    fn test_extract_json_simple() {
        let content = r#"{"answer": "yes", "thinking": "because..."}"#;
        let result: TestStruct = extract_json(content).unwrap();
        assert_eq!(result.answer, "yes");
    }

    #[test]
    fn test_extract_json_from_code_fence() {
        let content = r#"
Here's the result:

```json
{"answer": "no", "thinking": "test"}
```

That's all.
"#;
        let result: TestStruct = extract_json(content).unwrap();
        assert_eq!(result.answer, "no");
    }

    #[test]
    fn test_extract_json_with_none() {
        let content = r#"{"answer": "yes", "value": None}"#;
        let result: serde_json::Value = extract_json(content).unwrap();
        assert!(result.get("value").unwrap().is_null());
    }

    #[test]
    fn test_extract_json_array() {
        let content = r#"[{"answer": "a"}, {"answer": "b"}]"#;
        let result: Vec<TestStruct> = extract_json_array(content).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].answer, "a");
    }

    #[test]
    fn test_extract_field() {
        let content = r#"{"toc_detected": "yes", "thinking": "..."}"#;
        let detected: String = extract_field(content, "toc_detected").unwrap();
        assert_eq!(detected, "yes");
    }

    #[test]
    fn test_extract_yes_no() {
        assert!(extract_yes_no(r#"{"answer": "yes"}"#, "answer").unwrap());
        assert!(!extract_yes_no(r#"{"answer": "no"}"#, "answer").unwrap());
        assert!(extract_yes_no(r#"{"answer": "YES"}"#, "answer").unwrap());
    }

    #[test]
    fn test_parse_physical_index() {
        use serde_json::json;

        assert_eq!(parse_physical_index(&json!(5)), Some(5));
        assert_eq!(
            parse_physical_index(&json!("<physical_index_10>")),
            Some(10)
        );
        assert_eq!(parse_physical_index(&json!("physical_index_3")), Some(3));
        assert_eq!(parse_physical_index(&json!("42")), Some(42));
        assert_eq!(parse_physical_index(&json!(null)), None);
    }

    #[test]
    fn test_aggressive_cleanup() {
        let content = r#"{"items": [1, 2, 3,], "value": True,}"#;
        let cleaned = aggressive_cleanup(content);
        assert!(!cleaned.contains(",]"));
        assert!(!cleaned.contains(",}"));
        assert!(cleaned.contains("true"));
    }
}
