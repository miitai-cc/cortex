use anyhow::{bail, Context, Result};

const DEFAULT_MAX_SEGMENT_CHARS: usize = 400;

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
        tracing::debug!("[embed] 開始 embedding，text_len={}", text.len());
        let client = reqwest::Client::new();
        let api_key = std::env::var("OPENAI_API_KEY").unwrap_or_default();
        let port = std::env::var("AI_EMBEDDING_PORT").unwrap_or_else(|_| "18321".to_string());
        let host = std::env::var("AI_EMBEDDING_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let base_url = std::env::var("OPENAI_BASE_URL")
            .unwrap_or_else(|_| format!("http://{}:{}/v1", host, port));
        let api_url = format!("{}/embeddings", base_url.trim_end_matches('/'));
        let max_segment_chars = std::env::var("EMBEDDING_MAX_SEGMENT_CHARS")
            .ok()
            .and_then(|value| value.parse().ok())
            .filter(|value| *value > 0)
            .unwrap_or(DEFAULT_MAX_SEGMENT_CHARS);
        tracing::debug!(
            "[embed] 設定: api_url={}, model={}, max_segment_chars={}",
            api_url,
            self.model_name,
            max_segment_chars
        );

        // Some llama.cpp GGUF tokenizers fail on CR/LF and common full-width
        // punctuation. Normalize them to semantic ASCII equivalents.
        let normalized_text = normalize_embedding_text(text);
        let segments = split_text(&normalized_text, max_segment_chars);
        tracing::debug!("[embed] 分段完成，共 {} 段", segments.len());

        if segments.is_empty() {
            tracing::debug!("[embed] 無法 embedding 空文字，回傳錯誤");
            bail!("Cannot embed empty text");
        }

        // OpenAI-compatible APIs accept either one string or an array of strings.
        // Batching bounded segments avoids exceeding local models' small contexts.
        let input = if segments.len() == 1 {
            serde_json::Value::String(segments[0].to_string())
        } else {
            serde_json::Value::Array(
                segments
                    .iter()
                    .map(|segment| serde_json::Value::String((*segment).to_string()))
                    .collect(),
            )
        };
        let params = serde_json::json!({
            "model": self.model_name,
            "input": input,
        });

        tracing::debug!(
            "Calling Embedding API: URL: {}, model: {}, input_chars: {}, segments: {}",
            api_url,
            self.model_name,
            text.chars().count(),
            segments.len()
        );
        tracing::debug!(
            "[embed] 請求參數: model={}, input_type={}",
            self.model_name,
            if segments.len() == 1 {
                "string"
            } else {
                "array"
            }
        );

        let resp = client
            .post(&api_url)
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&params)
            .send()
            .await
            .with_context(|| format!("Failed to call embedding API at {api_url}"))?;

        let status = resp.status();
        let body_text = resp.text().await?;

        tracing::debug!(
            "Embedding API Result: Status: {}, response_bytes: {}",
            status,
            body_text.len()
        );

        if !status.is_success() {
            let upstream_message = serde_json::from_str::<serde_json::Value>(&body_text)
                .ok()
                .and_then(|body| body.pointer("/error/message")?.as_str().map(str::to_owned))
                .unwrap_or(body_text);
            tracing::debug!(
                "[embed] Embedding API 錯誤: status={}, message={}",
                status,
                upstream_message
            );
            bail!("Embedding API returned {status}: {upstream_message}");
        }

        let data: serde_json::Value =
            serde_json::from_str(&body_text).context("Embedding API returned invalid JSON")?;
        let rows = data["data"]
            .as_array()
            .context("Embedding API response is missing data")?;

        tracing::debug!("[embed] 回傳 {} 個 embedding 向量", rows.len());

        if rows.len() != segments.len() {
            tracing::debug!(
                "[embed] 向量數量不匹配: 回傳 {} vs 預期 {}",
                rows.len(),
                segments.len()
            );
            bail!(
                "Embedding API returned {} vectors for {} input segments",
                rows.len(),
                segments.len()
            );
        }

        let vectors = rows
            .iter()
            .map(|row| parse_vector(&row["embedding"]))
            .collect::<Result<Vec<_>>>()?;
        tracing::debug!(
            "[embed] 向量解析完成，每維度: {:?}",
            vectors.iter().map(|v| v.len()).collect::<Vec<_>>()
        );

        let result = average_and_normalize(&vectors)?;
        tracing::debug!(
            "[embed] 平均正規化完成，result_dim={}, 前 5 值: {:?}",
            result.len(),
            &result[..result.len().min(5)]
        );
        Ok(result)
    }
}

fn split_text(text: &str, max_chars: usize) -> Vec<&str> {
    tracing::debug!(
        "[split_text] 開始分段 text_len={}, max_chars={}",
        text.len(),
        max_chars
    );
    let mut segments = Vec::new();
    let mut start = 0;
    let mut chars = 0;

    for (index, _) in text.char_indices() {
        if chars == max_chars {
            segments.push(&text[start..index]);
            start = index;
            chars = 0;
        }
        chars += 1;
    }

    if start < text.len() {
        segments.push(&text[start..]);
    }
    tracing::debug!("[split_text] 分段完成，共 {} 段", segments.len());
    segments
}

fn normalize_embedding_text(text: &str) -> String {
    text.chars()
        .map(|character| match character {
            '\r' | '\n' => ' ',
            '，' => ',',
            '：' => ':',
            '；' => ';',
            '！' => '!',
            '？' => '?',
            '（' => '(',
            '）' => ')',
            other => other,
        })
        .collect()
}

fn parse_vector(value: &serde_json::Value) -> Result<Vec<f32>> {
    let values = value
        .as_array()
        .context("Embedding API response is missing an embedding vector")?;
    if values.is_empty() {
        bail!("Embedding API returned an empty vector");
    }
    values
        .iter()
        .map(|value| {
            value
                .as_f64()
                .map(|number| number as f32)
                .context("Embedding vector contains a non-numeric value")
        })
        .collect()
}

fn average_and_normalize(vectors: &[Vec<f32>]) -> Result<Vec<f32>> {
    let dimensions = vectors
        .first()
        .context("No embedding vectors returned")?
        .len();
    if vectors.iter().any(|vector| vector.len() != dimensions) {
        bail!("Embedding API returned vectors with inconsistent dimensions");
    }

    let mut average = vec![0.0_f32; dimensions];
    for vector in vectors {
        for (total, value) in average.iter_mut().zip(vector) {
            *total += value;
        }
    }
    let count = vectors.len() as f32;
    average.iter_mut().for_each(|value| *value /= count);

    let norm = average
        .iter()
        .map(|value| value * value)
        .sum::<f32>()
        .sqrt();
    if norm > 0.0 {
        average.iter_mut().for_each(|value| *value /= norm);
    }
    Ok(average)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_text_respects_unicode_character_boundaries() {
        assert_eq!(split_text("甲乙丙丁戊", 2), vec!["甲乙", "丙丁", "戊"]);
    }

    #[test]
    fn normalizes_llama_cpp_incompatible_markdown_characters() {
        assert_eq!(
            normalize_embedding_text("# 標題：第一行，測試！（是）\r\n第二行？"),
            "# 標題:第一行,測試!(是)  第二行?"
        );
    }

    #[test]
    fn averages_and_normalizes_segment_vectors() {
        let result = average_and_normalize(&[vec![1.0, 0.0], vec![0.0, 1.0]]).unwrap();
        let expected = 1.0_f32 / 2.0_f32.sqrt();
        assert!((result[0] - expected).abs() < 1e-6);
        assert!((result[1] - expected).abs() < 1e-6);
    }

    #[test]
    fn rejects_inconsistent_vector_dimensions() {
        assert!(average_and_normalize(&[vec![1.0], vec![1.0, 2.0]]).is_err());
    }
}
