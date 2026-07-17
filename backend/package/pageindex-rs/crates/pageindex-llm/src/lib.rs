//! LLM Provider Implementations for PageIndex
//!
//! This crate provides concrete implementations of the `LlmClient` trait
//! for various LLM providers including OpenAI, Anthropic, Ollama, and more.
//!
//! # Features
//!
//! - `openai` (default) - OpenAI GPT models
//! - `anthropic` - Anthropic Claude models
//! - `ollama` - Local Ollama models
//! - `gemini` - Google Gemini models
//! - `groq` - Groq fast inference
//! - `azure` - Azure OpenAI
//! - `mock` - Mock client for testing

#[cfg(feature = "openai")]
pub mod openai;

#[cfg(feature = "anthropic")]
pub mod anthropic;

#[cfg(feature = "ollama")]
pub mod ollama;

#[cfg(feature = "gemini")]
pub mod gemini;

#[cfg(feature = "groq")]
pub mod groq;

#[cfg(feature = "azure")]
pub mod azure;

#[cfg(feature = "mock")]
pub mod mock;

// Re-export the LlmClient trait
pub use pageindex_core::llm::{
    ChatMessage, ChatRole, FinishReason, LlmClient, LlmResponse, RetryConfig, RetryingClient,
    TokenUsage,
};

// Re-export main clients
#[cfg(feature = "openai")]
pub use openai::OpenAIClient;

#[cfg(feature = "anthropic")]
pub use anthropic::AnthropicClient;

#[cfg(feature = "ollama")]
pub use ollama::OllamaClient;

#[cfg(feature = "gemini")]
pub use gemini::GeminiClient;

#[cfg(feature = "groq")]
pub use groq::GroqClient;

#[cfg(feature = "azure")]
pub use azure::AzureOpenAIClient;

#[cfg(feature = "mock")]
pub use mock::MockClient;

/// Creates a client from environment configuration.
///
/// Checks environment variables to determine which provider to use:
/// - `OPENAI_API_KEY` - Use OpenAI
/// - `ANTHROPIC_API_KEY` - Use Anthropic
/// - `OLLAMA_HOST` - Use Ollama
/// - `GEMINI_API_KEY` - Use Gemini
/// - `GROQ_API_KEY` - Use Groq
/// - `AZURE_OPENAI_API_KEY` - Use Azure OpenAI
///
/// Returns the first available client.
#[cfg(feature = "openai")]
pub fn client_from_env(model: &str) -> Result<Box<dyn LlmClient>, String> {
    // Load .env file if present
    let _ = dotenvy::dotenv();

    if let Ok(key) = std::env::var("OPENAI_API_KEY") {
        return Ok(Box::new(OpenAIClient::new(key, model.to_string())));
    }

    #[cfg(feature = "anthropic")]
    if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
        return Ok(Box::new(AnthropicClient::new(key, model.to_string())));
    }

    #[cfg(feature = "ollama")]
    if std::env::var("OLLAMA_HOST").is_ok() {
        return Ok(Box::new(OllamaClient::new(model.to_string())));
    }

    #[cfg(feature = "gemini")]
    if let Ok(key) = std::env::var("GEMINI_API_KEY") {
        return Ok(Box::new(GeminiClient::new(key, model.to_string())));
    }

    #[cfg(feature = "groq")]
    if let Ok(key) = std::env::var("GROQ_API_KEY") {
        return Ok(Box::new(GroqClient::new(key, model.to_string())));
    }

    Err("No LLM API key found in environment".to_string())
}
