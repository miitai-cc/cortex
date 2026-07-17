//! LLM client abstraction and utilities.
//!
//! This module defines the `LlmClient` trait that all LLM providers must implement,
//! as well as utilities for prompt templating and JSON extraction from responses.

mod json_extract;
mod prompts;

pub use json_extract::{
    extract_json, extract_json_array, extract_json_value, parse_physical_index,
};
pub use prompts::*;

use crate::error::Result;
use async_trait::async_trait;

/// Reason for completion of an LLM response.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FinishReason {
    /// Normal completion
    Stop,
    /// Hit token limit
    Length,
    /// Content filter triggered
    ContentFilter,
    /// Tool/function call
    ToolCalls,
    /// Unknown reason
    Unknown,
}

impl FinishReason {
    /// Returns true if the response completed normally.
    pub fn is_complete(&self) -> bool {
        matches!(self, Self::Stop)
    }

    /// Returns true if the response was truncated due to length.
    pub fn is_truncated(&self) -> bool {
        matches!(self, Self::Length)
    }
}

impl From<&str> for FinishReason {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "stop" | "finished" => Self::Stop,
            "length" | "max_output_reached" => Self::Length,
            "content_filter" => Self::ContentFilter,
            "tool_calls" | "function_call" => Self::ToolCalls,
            _ => Self::Unknown,
        }
    }
}

/// Response from an LLM completion request.
#[derive(Debug, Clone)]
pub struct LlmResponse {
    /// The generated text content
    pub content: String,

    /// Why the response ended
    pub finish_reason: FinishReason,

    /// Model that generated the response
    pub model: String,

    /// Token usage information (if available)
    pub usage: Option<TokenUsage>,
}

impl LlmResponse {
    /// Creates a new LLM response.
    pub fn new(
        content: impl Into<String>,
        finish_reason: FinishReason,
        model: impl Into<String>,
    ) -> Self {
        Self {
            content: content.into(),
            finish_reason,
            model: model.into(),
            usage: None,
        }
    }

    /// Adds token usage information.
    pub fn with_usage(mut self, usage: TokenUsage) -> Self {
        self.usage = Some(usage);
        self
    }
}

/// Token usage statistics.
#[derive(Debug, Clone, Copy, Default)]
pub struct TokenUsage {
    /// Tokens in the prompt
    pub prompt_tokens: u32,
    /// Tokens in the completion
    pub completion_tokens: u32,
    /// Total tokens used
    pub total_tokens: u32,
}

/// A message in a chat conversation.
#[derive(Debug, Clone)]
pub struct ChatMessage {
    /// Role of the message sender
    pub role: ChatRole,
    /// Content of the message
    pub content: String,
}

impl ChatMessage {
    /// Creates a user message.
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: ChatRole::User,
            content: content.into(),
        }
    }

    /// Creates an assistant message.
    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: ChatRole::Assistant,
            content: content.into(),
        }
    }

    /// Creates a system message.
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: ChatRole::System,
            content: content.into(),
        }
    }
}

/// Role in a chat conversation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChatRole {
    /// System instructions
    System,
    /// User input
    User,
    /// Assistant response
    Assistant,
}

impl ChatRole {
    /// Returns the string representation used by most APIs.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::System => "system",
            Self::User => "user",
            Self::Assistant => "assistant",
        }
    }
}

/// Trait for LLM providers.
///
/// Implement this trait to add support for new LLM providers.
/// The trait is designed to be simple and easy to implement while
/// providing enough flexibility for different provider APIs.
#[async_trait]
pub trait LlmClient: Send + Sync {
    /// Performs a chat completion request.
    ///
    /// # Arguments
    ///
    /// * `prompt` - The user prompt
    ///
    /// # Returns
    ///
    /// The generated text response.
    async fn complete(&self, prompt: &str) -> Result<String>;

    /// Performs a chat completion request with finish reason.
    ///
    /// # Arguments
    ///
    /// * `prompt` - The user prompt
    ///
    /// # Returns
    ///
    /// The full response including finish reason.
    async fn complete_with_reason(&self, prompt: &str) -> Result<LlmResponse>;

    /// Performs a chat completion with history.
    ///
    /// # Arguments
    ///
    /// * `prompt` - The new user prompt
    /// * `history` - Previous messages in the conversation
    ///
    /// # Returns
    ///
    /// The generated text response.
    async fn complete_with_history(&self, prompt: &str, history: &[ChatMessage]) -> Result<String>;

    /// Returns the model name used by this client.
    fn model_name(&self) -> &str;

    /// Returns the provider name (e.g., "openai", "anthropic").
    fn provider(&self) -> &str;
}

/// Configuration for retry behavior.
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// Maximum number of retries
    pub max_retries: u32,
    /// Base delay between retries (in milliseconds)
    pub base_delay_ms: u64,
    /// Maximum delay between retries (in milliseconds)
    pub max_delay_ms: u64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 10,
            base_delay_ms: 1000,
            max_delay_ms: 30000,
        }
    }
}

/// Wraps an LLM client with retry logic.
pub struct RetryingClient<C> {
    inner: C,
    config: RetryConfig,
}

impl<C: LlmClient> RetryingClient<C> {
    /// Creates a new retrying client wrapper.
    pub fn new(client: C, config: RetryConfig) -> Self {
        Self {
            inner: client,
            config,
        }
    }

    /// Creates a new retrying client with default configuration.
    pub fn with_defaults(client: C) -> Self {
        Self::new(client, RetryConfig::default())
    }

    /// Executes a function with retry logic.
    async fn with_retry<F, Fut, T>(&self, f: F) -> Result<T>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<T>>,
    {
        let mut last_error = None;

        for attempt in 0..=self.config.max_retries {
            match f().await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    if !e.is_retryable() || attempt == self.config.max_retries {
                        return Err(e);
                    }

                    let delay = std::cmp::min(
                        self.config.base_delay_ms * 2u64.pow(attempt),
                        self.config.max_delay_ms,
                    );

                    tracing::warn!(
                        "LLM request failed (attempt {}/{}): {}. Retrying in {}ms",
                        attempt + 1,
                        self.config.max_retries,
                        e,
                        delay
                    );

                    tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                    last_error = Some(e);
                }
            }
        }

        Err(last_error.unwrap_or_else(|| crate::error::PageIndexError::llm("Unknown error")))
    }
}

#[async_trait]
impl<C: LlmClient> LlmClient for RetryingClient<C> {
    async fn complete(&self, prompt: &str) -> Result<String> {
        let prompt = prompt.to_string();
        self.with_retry(|| async { self.inner.complete(&prompt).await })
            .await
    }

    async fn complete_with_reason(&self, prompt: &str) -> Result<LlmResponse> {
        let prompt = prompt.to_string();
        self.with_retry(|| async { self.inner.complete_with_reason(&prompt).await })
            .await
    }

    async fn complete_with_history(&self, prompt: &str, history: &[ChatMessage]) -> Result<String> {
        let prompt = prompt.to_string();
        let history = history.to_vec();
        self.with_retry(|| async { self.inner.complete_with_history(&prompt, &history).await })
            .await
    }

    fn model_name(&self) -> &str {
        self.inner.model_name()
    }

    fn provider(&self) -> &str {
        self.inner.provider()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_finish_reason_from_str() {
        assert_eq!(FinishReason::from("stop"), FinishReason::Stop);
        assert_eq!(FinishReason::from("finished"), FinishReason::Stop);
        assert_eq!(FinishReason::from("length"), FinishReason::Length);
        assert_eq!(
            FinishReason::from("max_output_reached"),
            FinishReason::Length
        );
        assert_eq!(FinishReason::from("unknown"), FinishReason::Unknown);
    }

    #[test]
    fn test_finish_reason_checks() {
        assert!(FinishReason::Stop.is_complete());
        assert!(!FinishReason::Length.is_complete());
        assert!(FinishReason::Length.is_truncated());
    }

    #[test]
    fn test_chat_message_constructors() {
        let user = ChatMessage::user("Hello");
        assert_eq!(user.role, ChatRole::User);
        assert_eq!(user.content, "Hello");

        let assistant = ChatMessage::assistant("Hi there");
        assert_eq!(assistant.role, ChatRole::Assistant);

        let system = ChatMessage::system("You are a helpful assistant");
        assert_eq!(system.role, ChatRole::System);
    }

    #[test]
    fn test_chat_role_as_str() {
        assert_eq!(ChatRole::System.as_str(), "system");
        assert_eq!(ChatRole::User.as_str(), "user");
        assert_eq!(ChatRole::Assistant.as_str(), "assistant");
    }
}
