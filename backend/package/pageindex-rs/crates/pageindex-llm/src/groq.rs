//! Groq client implementation.
//!
//! This module provides an implementation of `LlmClient` for Groq's fast inference API.

use async_trait::async_trait;
use pageindex_core::llm::{ChatMessage, LlmClient, LlmError, LlmResponse};

/// Client for Groq API.
#[derive(Debug, Clone)]
pub struct GroqClient {
    api_key: String,
    model: String,
}

impl GroqClient {
    /// Creates a new Groq client.
    pub fn new(api_key: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            model: model.into(),
        }
    }
}

#[async_trait]
impl LlmClient for GroqClient {
    async fn complete(&self, messages: &[ChatMessage]) -> Result<LlmResponse, LlmError> {
        // TODO: Implement Groq API call
        let _ = (messages, &self.api_key);
        Err(LlmError::ProviderError(
            "Groq client not yet implemented".to_string(),
        ))
    }

    fn model_name(&self) -> &str {
        &self.model
    }
}
