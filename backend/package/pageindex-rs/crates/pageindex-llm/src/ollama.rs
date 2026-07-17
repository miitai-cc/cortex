//! Ollama client implementation.
//!
//! This module provides an implementation of `LlmClient` for local Ollama models.

use async_trait::async_trait;
use pageindex_core::llm::{ChatMessage, LlmClient, LlmError, LlmResponse};

/// Client for local Ollama API.
#[derive(Debug, Clone)]
pub struct OllamaClient {
    host: String,
    model: String,
}

impl OllamaClient {
    /// Creates a new Ollama client with default host.
    pub fn new(model: impl Into<String>) -> Self {
        Self {
            host: std::env::var("OLLAMA_HOST").unwrap_or_else(|_| "http://localhost:11434".into()),
            model: model.into(),
        }
    }

    /// Creates a new Ollama client with custom host.
    pub fn with_host(host: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            host: host.into(),
            model: model.into(),
        }
    }
}

#[async_trait]
impl LlmClient for OllamaClient {
    async fn complete(&self, messages: &[ChatMessage]) -> Result<LlmResponse, LlmError> {
        // TODO: Implement Ollama API call
        let _ = (messages, &self.host);
        Err(LlmError::ProviderError(
            "Ollama client not yet implemented".to_string(),
        ))
    }

    fn model_name(&self) -> &str {
        &self.model
    }
}
