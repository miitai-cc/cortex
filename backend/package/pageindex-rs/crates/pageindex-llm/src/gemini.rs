//! Google Gemini client implementation.
//!
//! This module provides an implementation of `LlmClient` for Google's Gemini models.

use async_trait::async_trait;
use pageindex_core::llm::{ChatMessage, LlmClient, LlmError, LlmResponse};

/// Client for Google Gemini API.
#[derive(Debug, Clone)]
pub struct GeminiClient {
    api_key: String,
    model: String,
}

impl GeminiClient {
    /// Creates a new Gemini client.
    pub fn new(api_key: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            model: model.into(),
        }
    }
}

#[async_trait]
impl LlmClient for GeminiClient {
    async fn complete(&self, messages: &[ChatMessage]) -> Result<LlmResponse, LlmError> {
        // TODO: Implement Gemini API call
        let _ = (messages, &self.api_key);
        Err(LlmError::ProviderError(
            "Gemini client not yet implemented".to_string(),
        ))
    }

    fn model_name(&self) -> &str {
        &self.model
    }
}
