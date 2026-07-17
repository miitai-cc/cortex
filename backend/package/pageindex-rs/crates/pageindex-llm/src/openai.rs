//! OpenAI GPT client implementation.

use async_openai::{
    config::OpenAIConfig,
    types::{
        ChatCompletionRequestMessage, ChatCompletionRequestSystemMessageArgs,
        ChatCompletionRequestUserMessageArgs, CreateChatCompletionRequestArgs,
    },
    Client,
};
use async_trait::async_trait;
use pageindex_core::error::{PageIndexError, Result};
use pageindex_core::llm::{
    ChatMessage, ChatRole, FinishReason, LlmClient, LlmResponse, TokenUsage,
};

/// OpenAI GPT client.
pub struct OpenAIClient {
    client: Client<OpenAIConfig>,
    model: String,
}

impl OpenAIClient {
    /// Creates a new OpenAI client.
    ///
    /// # Arguments
    ///
    /// * `api_key` - OpenAI API key
    /// * `model` - Model name (e.g., "gpt-4o-2024-11-20")
    pub fn new(api_key: impl Into<String>, model: impl Into<String>) -> Self {
        let config = OpenAIConfig::new().with_api_key(api_key);
        Self {
            client: Client::with_config(config),
            model: model.into(),
        }
    }

    /// Creates a client from environment.
    ///
    /// Uses `OPENAI_API_KEY` environment variable.
    pub fn from_env(model: impl Into<String>) -> Result<Self> {
        let api_key = std::env::var("OPENAI_API_KEY").map_err(|_| {
            PageIndexError::ConfigError("OPENAI_API_KEY environment variable not set".into())
        })?;
        Ok(Self::new(api_key, model))
    }

    /// Creates a client with custom base URL.
    ///
    /// Useful for OpenAI-compatible APIs (e.g., local models, proxies).
    pub fn with_base_url(
        api_key: impl Into<String>,
        base_url: impl Into<String>,
        model: impl Into<String>,
    ) -> Self {
        let config = OpenAIConfig::new()
            .with_api_key(api_key)
            .with_api_base(base_url);
        Self {
            client: Client::with_config(config),
            model: model.into(),
        }
    }

    fn convert_messages(messages: &[ChatMessage]) -> Vec<ChatCompletionRequestMessage> {
        messages
            .iter()
            .map(|msg| match msg.role {
                ChatRole::System => ChatCompletionRequestMessage::System(
                    ChatCompletionRequestSystemMessageArgs::default()
                        .content(msg.content.clone())
                        .build()
                        .unwrap(),
                ),
                ChatRole::User => ChatCompletionRequestMessage::User(
                    ChatCompletionRequestUserMessageArgs::default()
                        .content(msg.content.clone())
                        .build()
                        .unwrap(),
                ),
                ChatRole::Assistant => ChatCompletionRequestMessage::Assistant(
                    async_openai::types::ChatCompletionRequestAssistantMessageArgs::default()
                        .content(msg.content.clone())
                        .build()
                        .unwrap(),
                ),
            })
            .collect()
    }
}

#[async_trait]
impl LlmClient for OpenAIClient {
    async fn complete(&self, prompt: &str) -> Result<String> {
        let response = self.complete_with_reason(prompt).await?;
        Ok(response.content)
    }

    async fn complete_with_reason(&self, prompt: &str) -> Result<LlmResponse> {
        let request = CreateChatCompletionRequestArgs::default()
            .model(&self.model)
            .messages(vec![ChatCompletionRequestMessage::User(
                ChatCompletionRequestUserMessageArgs::default()
                    .content(prompt.to_string())
                    .build()
                    .map_err(|e| PageIndexError::llm(e.to_string()))?,
            )])
            .temperature(0.0)
            .build()
            .map_err(|e| PageIndexError::llm(e.to_string()))?;

        let response = self
            .client
            .chat()
            .create(request)
            .await
            .map_err(|e| PageIndexError::llm(e.to_string()))?;

        let choice = response
            .choices
            .first()
            .ok_or_else(|| PageIndexError::llm("No choices in response"))?;

        let content = choice.message.content.clone().unwrap_or_default();

        let finish_reason = choice
            .finish_reason
            .as_ref()
            .map(|r| match r {
                async_openai::types::FinishReason::Stop => FinishReason::Stop,
                async_openai::types::FinishReason::Length => FinishReason::Length,
                async_openai::types::FinishReason::ContentFilter => FinishReason::ContentFilter,
                async_openai::types::FinishReason::ToolCalls => FinishReason::ToolCalls,
                _ => FinishReason::Unknown,
            })
            .unwrap_or(FinishReason::Unknown);

        let usage = response.usage.map(|u| TokenUsage {
            prompt_tokens: u.prompt_tokens,
            completion_tokens: u.completion_tokens,
            total_tokens: u.total_tokens,
        });

        let mut result = LlmResponse::new(content, finish_reason, &self.model);
        if let Some(usage) = usage {
            result = result.with_usage(usage);
        }

        Ok(result)
    }

    async fn complete_with_history(&self, prompt: &str, history: &[ChatMessage]) -> Result<String> {
        let mut messages = Self::convert_messages(history);
        messages.push(ChatCompletionRequestMessage::User(
            ChatCompletionRequestUserMessageArgs::default()
                .content(prompt.to_string())
                .build()
                .map_err(|e| PageIndexError::llm(e.to_string()))?,
        ));

        let request = CreateChatCompletionRequestArgs::default()
            .model(&self.model)
            .messages(messages)
            .temperature(0.0)
            .build()
            .map_err(|e| PageIndexError::llm(e.to_string()))?;

        let response = self
            .client
            .chat()
            .create(request)
            .await
            .map_err(|e| PageIndexError::llm(e.to_string()))?;

        let content = response
            .choices
            .first()
            .and_then(|c| c.message.content.clone())
            .unwrap_or_default();

        Ok(content)
    }

    fn model_name(&self) -> &str {
        &self.model
    }

    fn provider(&self) -> &str {
        "openai"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg_attr(
        target_os = "macos",
        ignore = "requires macOS system configuration access in some sandboxed environments"
    )]
    #[test]
    fn test_client_creation() {
        let client = OpenAIClient::new("test-key", "gpt-4o");
        assert_eq!(client.model_name(), "gpt-4o");
        assert_eq!(client.provider(), "openai");
    }

    #[test]
    fn test_convert_messages() {
        let messages = vec![
            ChatMessage::system("You are helpful"),
            ChatMessage::user("Hello"),
            ChatMessage::assistant("Hi there"),
        ];

        let converted = OpenAIClient::convert_messages(&messages);
        assert_eq!(converted.len(), 3);
    }
}
