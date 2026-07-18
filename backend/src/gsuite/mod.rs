#![allow(dead_code)]
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct GscriptRequest {
    pub function: String,
    pub parameters: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GscriptResponse {
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

pub struct GsuiteClient {
    api_key: String,
    script_id: String,
    client: reqwest::Client,
}

impl GsuiteClient {
    pub fn new(api_key: &str, script_id: &str) -> Self {
        Self {
            api_key: api_key.to_string(),
            script_id: script_id.to_string(),
            client: reqwest::Client::new(),
        }
    }

    pub async fn run_function(
        &self,
        function: &str,
        parameters: Vec<serde_json::Value>,
    ) -> Result<GscriptResponse> {
        let url = format!(
            "https://script.googleapis.com/v1/scripts/{}/run?key={}",
            self.script_id, self.api_key
        );

        let resp = self
            .client
            .post(&url)
            .json(&serde_json::json!({
                "function": function,
                "parameters": parameters,
                "devMode": true,
            }))
            .send()
            .await?;

        let data: serde_json::Value = resp.json().await?;
        Ok(GscriptResponse {
            result: data.get("response").and_then(|r| r.get("result")).cloned(),
            error: data
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .map(|s| s.to_string()),
        })
    }

    pub async fn create_document(&self, title: &str) -> Result<String> {
        let result = self
            .run_function("createDocument", vec![serde_json::json!(title)])
            .await?;
        result
            .result
            .and_then(|r| r.as_str().map(|s| s.to_string()))
            .ok_or_else(|| anyhow::anyhow!("Failed to create document"))
    }

    pub async fn append_to_sheet(
        &self,
        spreadsheet_id: &str,
        values: Vec<Vec<String>>,
    ) -> Result<()> {
        let values_json: Vec<serde_json::Value> = values
            .into_iter()
            .map(|row| serde_json::json!(row))
            .collect();

        self.run_function(
            "appendToSheet",
            vec![
                serde_json::json!(spreadsheet_id),
                serde_json::json!(values_json),
            ],
        )
        .await?;

        Ok(())
    }

    pub async fn send_email(&self, to: &str, subject: &str, body: &str) -> Result<()> {
        self.run_function(
            "sendEmail",
            vec![
                serde_json::json!(to),
                serde_json::json!(subject),
                serde_json::json!(body),
            ],
        )
        .await?;
        Ok(())
    }
}
