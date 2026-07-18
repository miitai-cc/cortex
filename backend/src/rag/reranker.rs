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
        let port = std::env::var("AI_RERANKING_PORT").unwrap_or_else(|_| "18322".to_string());
        let host = std::env::var("AI_RERANKING_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let base_url = std::env::var("OPENAI_BASE_URL")
            .unwrap_or_else(|_| format!("http://{}:{}/v1", host, port));
        let api_url = format!("{}/rerank", base_url);

        let params = serde_json::json!({
            "model": self.model_name,
            "query": query,
            "documents": texts,
        });

        tracing::debug!(
            "Calling Reranking API: URL: {}, Host: {}, Port: {}, Params: {}",
            api_url,
            host,
            port,
            params
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
            "Reranking API Result: Status: {}, Response: {}",
            status,
            body_text
        );

        let data: serde_json::Value = serde_json::from_str(&body_text)?;
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
