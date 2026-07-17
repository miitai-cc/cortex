use anyhow::Result;
use salvo::sse::SseEvent;
use tokio::sync::mpsc;

#[derive(Clone)]
pub struct LLMService {
    api_key: Option<String>,
    base_url: String,
}

impl LLMService {
    pub fn new(api_key: Option<&str>, base_url: &str) -> Self {
        Self {
            api_key: api_key.map(|s| s.to_string()),
            base_url: base_url.to_string(),
        }
    }

    pub async fn generate(&self, query: &str, context: &str) -> Result<String> {
        let api_key = self.api_key.as_deref().unwrap_or_default();

        let client = reqwest::Client::new();
        let resp = client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&serde_json::json!({
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一個專業的 RAG 助手。請基於提供的上下文來回答使用者的問題。如果你不確定答案，請誠實地說你不知道。請使用繁體中文回答。"
                    },
                    {
                        "role": "user",
                        "content": format!("上下文：\n{}\n\n問題：{}", context, query)
                    }
                ],
                "temperature": 0.7,
                "max_tokens": 1024,
            }))
            .send()
            .await?;

        let data: serde_json::Value = resp.json().await?;
        let answer = data["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        Ok(answer)
    }

    pub async fn generate_with_messages(&self, messages: &[serde_json::Value]) -> Result<String> {
        let api_key = self.api_key.as_deref().unwrap_or_default();

        let client = reqwest::Client::new();
        let resp = client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&serde_json::json!({
                "model": "gpt-4o-mini",
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 2048,
            }))
            .send()
            .await?;

        let data: serde_json::Value = resp.json().await?;
        let answer = data["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        Ok(answer)
    }

    pub async fn generate_streaming_sse(
        &self,
        messages: &[serde_json::Value],
        tx: mpsc::Sender<SseEvent>,
    ) -> Result<()> {
        let api_key = self.api_key.as_deref().unwrap_or_default();

        let client = reqwest::Client::new();
        let mut resp = client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&serde_json::json!({
                "model": "gpt-4o-mini",
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 2048,
                "stream": true,
            }))
            .send()
            .await?;

        while let Some(chunk) = resp.chunk().await? {
            let chunk_str = String::from_utf8_lossy(&chunk);
            for line in chunk_str.lines() {
                let line = line.trim();
                if line.is_empty() || line == "data: [DONE]" {
                    continue;
                }
                if let Some(data) = line.strip_prefix("data: ") {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                        if let Some(content) = json["choices"][0]["delta"]["content"].as_str() {
                            let event = SseEvent::default()
                                .name("token")
                                .json(serde_json::json!({ "content": content }))
                                .unwrap_or_default();
                            let _ = tx.send(event).await;
                        }
                    }
                }
            }
        }

        Ok(())
    }
}
