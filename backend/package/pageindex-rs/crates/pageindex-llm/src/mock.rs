//! Mock LLM client for testing.

use async_trait::async_trait;
use pageindex_core::error::Result;
use pageindex_core::llm::{ChatMessage, FinishReason, LlmClient, LlmResponse};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// A mock LLM client for testing.
///
/// Can be configured with preset responses for specific prompts,
/// or uses a default response for unmatched prompts.
pub struct MockClient {
    model: String,
    responses: Arc<Mutex<HashMap<String, String>>>,
    default_response: String,
    call_count: Arc<Mutex<usize>>,
}

impl MockClient {
    /// Creates a new mock client.
    pub fn new(model: impl Into<String>) -> Self {
        Self {
            model: model.into(),
            responses: Arc::new(Mutex::new(HashMap::new())),
            default_response: r#"{"answer": "yes", "thinking": "mock response"}"#.to_string(),
            call_count: Arc::new(Mutex::new(0)),
        }
    }

    /// Sets the default response for unmatched prompts.
    pub fn with_default_response(mut self, response: impl Into<String>) -> Self {
        self.default_response = response.into();
        self
    }

    /// Adds a response for a specific prompt pattern.
    ///
    /// If the prompt contains the pattern, this response is returned.
    pub fn with_response(self, pattern: impl Into<String>, response: impl Into<String>) -> Self {
        self.responses
            .lock()
            .unwrap()
            .insert(pattern.into(), response.into());
        self
    }

    /// Returns the number of times the client was called.
    pub fn call_count(&self) -> usize {
        *self.call_count.lock().unwrap()
    }

    /// Resets the call count.
    pub fn reset_call_count(&self) {
        *self.call_count.lock().unwrap() = 0;
    }

    fn get_response(&self, prompt: &str) -> String {
        let responses = self.responses.lock().unwrap();

        // Check for matching patterns
        for (pattern, response) in responses.iter() {
            if prompt.contains(pattern) {
                return response.clone();
            }
        }

        self.default_response.clone()
    }
}

impl Clone for MockClient {
    fn clone(&self) -> Self {
        Self {
            model: self.model.clone(),
            responses: Arc::clone(&self.responses),
            default_response: self.default_response.clone(),
            call_count: Arc::clone(&self.call_count),
        }
    }
}

#[async_trait]
impl LlmClient for MockClient {
    async fn complete(&self, prompt: &str) -> Result<String> {
        *self.call_count.lock().unwrap() += 1;

        // Add small delay to simulate network
        tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;

        Ok(self.get_response(prompt))
    }

    async fn complete_with_reason(&self, prompt: &str) -> Result<LlmResponse> {
        let content = self.complete(prompt).await?;
        Ok(LlmResponse::new(content, FinishReason::Stop, &self.model))
    }

    async fn complete_with_history(
        &self,
        prompt: &str,
        _history: &[ChatMessage],
    ) -> Result<String> {
        self.complete(prompt).await
    }

    fn model_name(&self) -> &str {
        &self.model
    }

    fn provider(&self) -> &str {
        "mock"
    }
}

/// Builder for creating mock clients with common test scenarios.
pub struct MockClientBuilder {
    client: MockClient,
}

impl MockClientBuilder {
    /// Creates a new builder.
    pub fn new() -> Self {
        Self {
            client: MockClient::new("mock-model"),
        }
    }

    /// Configures responses for TOC detection.
    pub fn with_toc_detection(self, has_toc: bool) -> Self {
        let response = if has_toc {
            r#"{"thinking": "page has TOC", "toc_detected": "yes"}"#
        } else {
            r#"{"thinking": "no TOC found", "toc_detected": "no"}"#
        };

        Self {
            client: self
                .client
                .with_response("detect if there is a table", response),
        }
    }

    /// Configures responses for page number detection.
    pub fn with_page_numbers(self, has_page_numbers: bool) -> Self {
        let response = if has_page_numbers {
            r#"{"thinking": "has page numbers", "page_index_given_in_toc": "yes"}"#
        } else {
            r#"{"thinking": "no page numbers", "page_index_given_in_toc": "no"}"#
        };

        Self {
            client: self.client.with_response("page numbers/indices", response),
        }
    }

    /// Configures responses for title appearance checks.
    pub fn with_title_checks(self, all_correct: bool) -> Self {
        let response = if all_correct {
            r#"{"thinking": "title appears", "answer": "yes"}"#
        } else {
            r#"{"thinking": "title not found", "answer": "no"}"#
        };

        Self {
            client: self
                .client
                .with_response("section appears or starts", response),
        }
    }

    /// Builds the configured mock client.
    pub fn build(self) -> MockClient {
        self.client
    }
}

impl Default for MockClientBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_client_default_response() {
        let client = MockClient::new("test");
        let response = client.complete("any prompt").await.unwrap();

        assert!(response.contains("yes"));
    }

    #[tokio::test]
    async fn test_mock_client_custom_response() {
        let client = MockClient::new("test").with_response("hello", r#"{"greeting": "world"}"#);

        let response = client.complete("hello there").await.unwrap();
        assert!(response.contains("world"));

        let default_response = client.complete("something else").await.unwrap();
        assert!(default_response.contains("yes"));
    }

    #[tokio::test]
    async fn test_mock_client_call_count() {
        let client = MockClient::new("test");

        assert_eq!(client.call_count(), 0);

        client.complete("test").await.unwrap();
        assert_eq!(client.call_count(), 1);

        client.complete("test").await.unwrap();
        assert_eq!(client.call_count(), 2);

        client.reset_call_count();
        assert_eq!(client.call_count(), 0);
    }

    #[tokio::test]
    async fn test_mock_client_builder() {
        let client = MockClientBuilder::new()
            .with_toc_detection(true)
            .with_title_checks(true)
            .build();

        let toc_response = client
            .complete("detect if there is a table of content")
            .await
            .unwrap();
        assert!(toc_response.contains("yes"));
    }
}
