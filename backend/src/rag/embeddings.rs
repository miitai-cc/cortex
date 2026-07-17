use anyhow::Result;

#[derive(Clone)]
pub struct EmbeddingService {
    model_name: String,
}

impl EmbeddingService {
    pub fn new(model_name: &str) -> Self {
        Self {
            model_name: model_name.to_string(),
        }
    }

    pub async fn embed(&self, text: &str) -> Result<Vec<f32>> {
        // 使用外部 API 或本機模型產生 embedding
        // 此處以 OpenAI-compatible API 為例
        let client = reqwest::Client::new();
        let api_key = std::env::var("OPENAI_API_KEY").unwrap_or_default();
        let port = std::env::var("AI_EMBEDDING_PORT").unwrap_or_else(|_| "18321".to_string());
        let host = std::env::var("AI_EMBEDDING_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let base_url = std::env::var("OPENAI_BASE_URL")
            .unwrap_or_else(|_| format!("http://{}:{}/v1", host, port));
        let api_url = format!("{}/embeddings", base_url);

        let params = serde_json::json!({
            "model": self.model_name,
            "input": text,
        });

        tracing::debug!(
            "Calling Embedding API: URL: {}, Host: {}, Port: {}, Params: {}",
            api_url, host, port, params
        );

        let resp = client
            .post(&api_url)
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&params)
            .send()
            .await?;

        let status = resp.status();
        let body_text = resp.text().await?;

        tracing::debug!(
            "Embedding API Result: Status: {}, Response: {}",
            status, body_text
        );

        let data: serde_json::Value = serde_json::from_str(&body_text)?;
        let embedding = data["data"][0]["embedding"]
            .as_array()
            .ok_or_else(|| anyhow::anyhow!("Failed to parse embedding"))?
            .iter()
            .map(|v| v.as_f64().unwrap_or(0.0) as f32)
            .collect();

        Ok(embedding)
    }
}
