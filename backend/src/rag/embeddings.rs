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
        let base_url = std::env::var("OPENAI_BASE_URL")
            .unwrap_or_else(|_| "https://api.openai.com/v1".to_string());

        let resp = client
            .post(format!("{}/embeddings", base_url))
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&serde_json::json!({
                "model": self.model_name,
                "input": text,
            }))
            .send()
            .await?;

        let data: serde_json::Value = resp.json().await?;
        let embedding = data["data"][0]["embedding"]
            .as_array()
            .ok_or_else(|| anyhow::anyhow!("Failed to parse embedding"))?
            .iter()
            .map(|v| v.as_f64().unwrap_or(0.0) as f32)
            .collect();

        Ok(embedding)
    }
}
