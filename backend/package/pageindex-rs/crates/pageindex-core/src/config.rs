//! Configuration management for PageIndex.
//!
//! This module handles loading configuration from YAML files, environment
//! variables, and programmatic overrides.

use crate::error::{PageIndexError, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Configuration for the PageIndex processing pipeline.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// LLM model to use (e.g., "gpt-4o-2024-11-20")
    #[serde(default = "default_model")]
    pub model: String,

    /// Number of pages to check for TOC detection
    #[serde(default = "default_toc_check_page_num")]
    pub toc_check_page_num: usize,

    /// Maximum pages per node before splitting
    #[serde(default = "default_max_page_num_each_node")]
    pub max_page_num_each_node: usize,

    /// Maximum tokens per node before splitting
    #[serde(default = "default_max_token_num_each_node")]
    pub max_token_num_each_node: usize,

    /// Whether to add unique IDs to each node
    #[serde(default = "default_true")]
    pub if_add_node_id: bool,

    /// Whether to add text content to each node
    #[serde(default)]
    pub if_add_node_text: bool,

    /// Whether to generate summaries for each node
    #[serde(default = "default_true")]
    pub if_add_node_summary: bool,

    /// Whether to generate a description for the document
    #[serde(default)]
    pub if_add_doc_description: bool,

    /// Maximum retries for fixing incorrect TOC entries
    #[serde(default = "default_max_fix_attempts")]
    pub max_fix_attempts: usize,

    /// Minimum token threshold for markdown tree thinning
    #[serde(default = "default_min_token_threshold")]
    pub min_token_threshold: usize,

    /// Token threshold for summary vs full text
    #[serde(default = "default_summary_token_threshold")]
    pub summary_token_threshold: usize,
}

fn default_model() -> String {
    "gpt-4o-2024-11-20".to_string()
}

fn default_toc_check_page_num() -> usize {
    20
}

fn default_max_page_num_each_node() -> usize {
    10
}

fn default_max_token_num_each_node() -> usize {
    20000
}

fn default_max_fix_attempts() -> usize {
    3
}

fn default_min_token_threshold() -> usize {
    5000
}

fn default_summary_token_threshold() -> usize {
    200
}

fn default_true() -> bool {
    true
}

impl Default for Config {
    fn default() -> Self {
        Self {
            model: default_model(),
            toc_check_page_num: default_toc_check_page_num(),
            max_page_num_each_node: default_max_page_num_each_node(),
            max_token_num_each_node: default_max_token_num_each_node(),
            if_add_node_id: true,
            if_add_node_text: false,
            if_add_node_summary: true,
            if_add_doc_description: false,
            max_fix_attempts: default_max_fix_attempts(),
            min_token_threshold: default_min_token_threshold(),
            summary_token_threshold: default_summary_token_threshold(),
        }
    }
}

impl Config {
    /// Creates a new configuration with default values.
    pub fn new() -> Self {
        Self::default()
    }

    /// Loads configuration from a YAML file.
    ///
    /// Values in the file override the defaults.
    pub fn from_yaml<P: AsRef<Path>>(path: P) -> Result<Self> {
        let content = std::fs::read_to_string(path.as_ref()).map_err(|e| {
            PageIndexError::ConfigError(format!(
                "Failed to read config file '{}': {}",
                path.as_ref().display(),
                e
            ))
        })?;

        Self::from_yaml_str(&content)
    }

    /// Parses configuration from a YAML string.
    pub fn from_yaml_str(content: &str) -> Result<Self> {
        serde_yaml::from_str(content)
            .map_err(|e| PageIndexError::ConfigError(format!("Failed to parse YAML: {}", e)))
    }

    /// Loads configuration with environment variable overrides.
    ///
    /// Environment variables are prefixed with `PAGEINDEX_`:
    /// - `PAGEINDEX_MODEL` - LLM model name
    /// - `PAGEINDEX_TOC_CHECK_PAGE_NUM` - Pages to check for TOC
    /// - etc.
    pub fn with_env_overrides(mut self) -> Self {
        if let Ok(model) = std::env::var("PAGEINDEX_MODEL") {
            self.model = model;
        }
        if let Ok(val) = std::env::var("PAGEINDEX_TOC_CHECK_PAGE_NUM") {
            if let Ok(num) = val.parse() {
                self.toc_check_page_num = num;
            }
        }
        if let Ok(val) = std::env::var("PAGEINDEX_MAX_PAGE_NUM_EACH_NODE") {
            if let Ok(num) = val.parse() {
                self.max_page_num_each_node = num;
            }
        }
        if let Ok(val) = std::env::var("PAGEINDEX_MAX_TOKEN_NUM_EACH_NODE") {
            if let Ok(num) = val.parse() {
                self.max_token_num_each_node = num;
            }
        }
        if let Ok(val) = std::env::var("PAGEINDEX_ADD_NODE_ID") {
            self.if_add_node_id = val.eq_ignore_ascii_case("true") || val == "1";
        }
        if let Ok(val) = std::env::var("PAGEINDEX_ADD_NODE_TEXT") {
            self.if_add_node_text = val.eq_ignore_ascii_case("true") || val == "1";
        }
        if let Ok(val) = std::env::var("PAGEINDEX_ADD_NODE_SUMMARY") {
            self.if_add_node_summary = val.eq_ignore_ascii_case("true") || val == "1";
        }
        if let Ok(val) = std::env::var("PAGEINDEX_ADD_DOC_DESCRIPTION") {
            self.if_add_doc_description = val.eq_ignore_ascii_case("true") || val == "1";
        }
        self
    }

    /// Builder pattern: sets the model.
    pub fn with_model(mut self, model: impl Into<String>) -> Self {
        self.model = model.into();
        self
    }

    /// Builder pattern: sets the TOC check page count.
    pub fn with_toc_check_page_num(mut self, num: usize) -> Self {
        self.toc_check_page_num = num;
        self
    }

    /// Builder pattern: sets max pages per node.
    pub fn with_max_page_num_each_node(mut self, num: usize) -> Self {
        self.max_page_num_each_node = num;
        self
    }

    /// Builder pattern: sets max tokens per node.
    pub fn with_max_token_num_each_node(mut self, num: usize) -> Self {
        self.max_token_num_each_node = num;
        self
    }

    /// Builder pattern: enables/disables node IDs.
    pub fn with_node_id(mut self, enabled: bool) -> Self {
        self.if_add_node_id = enabled;
        self
    }

    /// Builder pattern: enables/disables node text.
    pub fn with_node_text(mut self, enabled: bool) -> Self {
        self.if_add_node_text = enabled;
        self
    }

    /// Builder pattern: enables/disables node summaries.
    pub fn with_node_summary(mut self, enabled: bool) -> Self {
        self.if_add_node_summary = enabled;
        self
    }

    /// Builder pattern: enables/disables document description.
    pub fn with_doc_description(mut self, enabled: bool) -> Self {
        self.if_add_doc_description = enabled;
        self
    }

    /// Validates the configuration.
    pub fn validate(&self) -> Result<()> {
        if self.model.is_empty() {
            return Err(PageIndexError::ConfigError(
                "Model name cannot be empty".into(),
            ));
        }
        if self.toc_check_page_num == 0 {
            return Err(PageIndexError::ConfigError(
                "toc_check_page_num must be > 0".into(),
            ));
        }
        if self.max_page_num_each_node == 0 {
            return Err(PageIndexError::ConfigError(
                "max_page_num_each_node must be > 0".into(),
            ));
        }
        if self.max_token_num_each_node == 0 {
            return Err(PageIndexError::ConfigError(
                "max_token_num_each_node must be > 0".into(),
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert_eq!(config.model, "gpt-4o-2024-11-20");
        assert_eq!(config.toc_check_page_num, 20);
        assert!(config.if_add_node_id);
        assert!(config.if_add_node_summary);
        assert!(!config.if_add_node_text);
        assert!(!config.if_add_doc_description);
    }

    #[test]
    fn test_config_from_yaml() {
        let yaml = r#"
model: "gpt-4o"
toc_check_page_num: 30
if_add_node_id: false
"#;
        let config = Config::from_yaml_str(yaml).unwrap();
        assert_eq!(config.model, "gpt-4o");
        assert_eq!(config.toc_check_page_num, 30);
        assert!(!config.if_add_node_id);
        // Defaults should still apply
        assert!(config.if_add_node_summary);
    }

    #[test]
    fn test_config_builder() {
        let config = Config::new()
            .with_model("claude-3-5-sonnet")
            .with_toc_check_page_num(50)
            .with_node_text(true);

        assert_eq!(config.model, "claude-3-5-sonnet");
        assert_eq!(config.toc_check_page_num, 50);
        assert!(config.if_add_node_text);
    }

    #[test]
    fn test_config_validation() {
        let valid = Config::default();
        assert!(valid.validate().is_ok());

        let invalid = Config {
            model: "".to_string(),
            ..Default::default()
        };
        assert!(invalid.validate().is_err());
    }
}
