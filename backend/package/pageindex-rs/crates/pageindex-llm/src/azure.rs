//! Azure OpenAI client implementation.
//!
//! This module provides an implementation of `LlmClient` for Azure OpenAI Service.

use async_trait::async_trait;
use pageindex_core::llm::{ChatMessage, LlmClient, LlmError, LlmResponse};

/// Client for Azure OpenAI Service.
#[derive(Debug, Clone)]
pub struct AzureOpenAIClient {
    api_key: String,
    endpoint: String,
    deployment: String,
    api_version: String,
}

impl AzureOpenAIClient {
    /// Creates a new Azure OpenAI client.
    pub fn new(
        api_key: impl Into<String>,
        endpoint: impl Into<String>,
        deployment: impl Into<String>,
    ) -> Self {
        Self {
            api_key: api_key.into(),
            endpoint: endpoint.into(),
            deployment: deployment.into(),
            api_version: "2024-02-15-preview".to_string(),
        }
    }

    /// Sets the API version.
    pub fn with_api_version(mut self, version: impl Into<String>) -> Self {
        self.api_version = version.into();
        self
    }
}

#[async_trait]
impl LlmClient for AzureOpenAIClient {
    async fn complete(&self, messages: &[ChatMessage]) -> Result<LlmResponse, LlmError> {
        // TODO: Implement Azure OpenAI API call
        let _ = (messages, &self.api_key, &self.endpoint);
        Err(LlmError::ProviderError(
            "Azure OpenAI client not yet implemented".to_string(),
        ))
    }

    fn model_name(&self) -> &str {
        &self.deployment
    }
}
