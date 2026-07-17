//! Anthropic Claude client implementation.
//!
//! This module provides an implementation of `LlmClient` for Anthropic's Claude models.

use async_trait::async_trait;
use pageindex_core::llm::{
    ChatMessage, FinishReason, LlmClient, LlmError, LlmResponse, TokenUsage,
};

/// Client for Anthropic's Claude API.
#[derive(Debug, Clone)]
pub struct AnthropicClient {
    api_key: String,
    model: String,
}

impl AnthropicClient {
    /// Creates a new Anthropic client.
    pub fn new(api_key: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            model: model.into(),
        }
    }
}

#[async_trait]
impl LlmClient for AnthropicClient {
    async fn complete(&self, messages: &[ChatMessage]) -> Result<LlmResponse, LlmError> {
        // TODO: Implement Anthropic API call
        let _ = (messages, &self.api_key);
        Err(LlmError::ProviderError(
            "Anthropic client not yet implemented".to_string(),
        ))
    }

    fn model_name(&self) -> &str {
        &self.model
    }
}
