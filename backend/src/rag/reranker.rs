use anyhow::Result;

#[derive(Clone)]
pub struct RerankerService {
    model_name: String,
}

impl RerankerService {
    pub fn new(model_name: &str) -> Self {
        Self {
            model_name: model_name.to_string(),
        }
    }

    pub async fn rerank(&self, query: &str, texts: &[&str]) -> Result<Vec<f64>> {
        // 使用外部 API 或本機模型進行 reranking
        let client = reqwest::Client::new();
        let api_key = std::env::var("OPENAI_API_KEY").unwrap_or_default();
        let base_url = std::env::var("OPENAI_BASE_URL")
            .unwrap_or_else(|_| "https://api.openai.com/v1".to_string());

        let resp = client
            .post(format!("{}/rerank", base_url))
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&serde_json::json!({
                "model": self.model_name,
                "query": query,
                "documents": texts,
            }))
            .send()
            .await?;

        let data: serde_json::Value = resp.json().await?;
        let results = data["results"]
            .as_array()
            .ok_or_else(|| anyhow::anyhow!("Failed to parse rerank results"))?;

        let mut scores = vec![0.0_f64; texts.len()];
        for item in results {
            let index = item["index"].as_u64().unwrap_or(0) as usize;
            let relevance_score = item["relevance_score"].as_f64().unwrap_or(0.0);
            if index < scores.len() {
                scores[index] = relevance_score;
            }
        }

        Ok(scores)
    }
}
