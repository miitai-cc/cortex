use async_trait::async_trait;
use pageindex_core::error::{PageIndexError, Result};
use pageindex_core::llm::{ChatMessage, FinishReason, LlmClient, LlmResponse};

pub struct PageIndexApiClient {
    client: reqwest::Client,
    api_key: String,
    base_url: String,
    model: String,
}

impl PageIndexApiClient {
    pub fn new(api_key: String, base_url: String, model: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key,
            base_url: base_url.trim_end_matches('/').to_string(),
            model,
        }
    }

    async fn request(&self, messages: serde_json::Value) -> Result<LlmResponse> {
        let url = format!("{}/chat/completions", self.base_url);
        let response = self
            .client
            .post(&url)
            .bearer_auth(&self.api_key)
            .json(&serde_json::json!({
                "model": self.model,
                "messages": messages,
                "temperature": 0.0
            }))
            .send()
            .await
            .map_err(|error| {
                PageIndexError::llm(format!("PageIndex API request failed: {error}"))
            })?;
        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|error| PageIndexError::llm(error.to_string()))?;
        if !status.is_success() {
            return Err(PageIndexError::llm(format!(
                "PageIndex API returned {status}: {body}"
            )));
        }

        let value: serde_json::Value = serde_json::from_str(&body)
            .map_err(|error| PageIndexError::llm(format!("Invalid PageIndex API JSON: {error}")))?;
        let choice = value["choices"]
            .as_array()
            .and_then(|choices| choices.first())
            .ok_or_else(|| PageIndexError::llm("PageIndex API returned no choices"))?;
        let content = choice["message"]["content"]
            .as_str()
            .ok_or_else(|| PageIndexError::llm("PageIndex API response has no message content"))?;
        let finish_reason = choice["finish_reason"]
            .as_str()
            .map(FinishReason::from)
            .unwrap_or(FinishReason::Unknown);
        Ok(LlmResponse::new(content, finish_reason, &self.model))
    }
}

#[async_trait]
impl LlmClient for PageIndexApiClient {
    async fn complete(&self, prompt: &str) -> Result<String> {
        Ok(self.complete_with_reason(prompt).await?.content)
    }

    async fn complete_with_reason(&self, prompt: &str) -> Result<LlmResponse> {
        self.request(serde_json::json!([{"role": "user", "content": prompt}]))
            .await
    }

    async fn complete_with_history(&self, prompt: &str, history: &[ChatMessage]) -> Result<String> {
        let mut messages = history
            .iter()
            .map(|message| {
                serde_json::json!({
                    "role": message.role.as_str(),
                    "content": message.content
                })
            })
            .collect::<Vec<_>>();
        messages.push(serde_json::json!({"role": "user", "content": prompt}));
        Ok(self
            .request(serde_json::Value::Array(messages))
            .await?
            .content)
    }

    fn model_name(&self) -> &str {
        &self.model
    }

    fn provider(&self) -> &str {
        "openai-compatible"
    }
}
