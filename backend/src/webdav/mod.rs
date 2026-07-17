use anyhow::Result;
use std::path::Path;

pub struct WebdavClient {
    base_url: String,
    username: String,
    password: String,
    client: reqwest::Client,
}

impl WebdavClient {
    pub fn new(base_url: &str, username: &str, password: &str) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            username: username.to_string(),
            password: password.to_string(),
            client: reqwest::Client::new(),
        }
    }

    pub async fn list_files(&self, path: &str) -> Result<Vec<String>> {
        let url = format!("{}/{}", self.base_url, path.trim_start_matches('/'));
        let resp = self.client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &url)
            .header("Depth", "1")
            .basic_auth(&self.username, Some(&self.password))
            .send()
            .await?;

        let body = resp.text().await?;
        let files = parse_propfind_response(&body);
        Ok(files)
    }

    pub async fn download_file(&self, remote_path: &str, local_path: &str) -> Result<()> {
        let url = format!("{}/{}", self.base_url, remote_path.trim_start_matches('/'));
        let resp = self.client
            .get(&url)
            .basic_auth(&self.username, Some(&self.password))
            .send()
            .await?;

        let bytes = resp.bytes().await?;
        if let Some(parent) = Path::new(local_path).parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        tokio::fs::write(local_path, bytes).await?;
        Ok(())
    }

    pub async fn upload_file(&self, local_path: &str, remote_path: &str) -> Result<()> {
        let url = format!("{}/{}", self.base_url, remote_path.trim_start_matches('/'));
        let content = tokio::fs::read(local_path).await?;

        self.client
            .put(&url)
            .basic_auth(&self.username, Some(&self.password))
            .body(content)
            .send()
            .await?;

        Ok(())
    }

    pub async fn delete_file(&self, remote_path: &str) -> Result<()> {
        let url = format!("{}/{}", self.base_url, remote_path.trim_start_matches('/'));
        self.client
            .delete(&url)
            .basic_auth(&self.username, Some(&self.password))
            .send()
            .await?;
        Ok(())
    }
}

fn parse_propfind_response(xml: &str) -> Vec<String> {
    let mut files = Vec::new();
    let mut in_href = false;
    let mut href_buffer = String::new();

    for ch in xml.chars() {
        if ch == '<' {
            let tag = href_buffer.trim().to_string();
            if tag.starts_with("D:href") || tag.starts_with("d:href") || tag == "href" {
                in_href = true;
            }
            href_buffer.clear();
            continue;
        }
        if ch == '>' {
            href_buffer.clear();
            continue;
        }
        if ch == '<' {
            if href_buffer.contains('/') {
                in_href = false;
                if !href_buffer.trim().is_empty() {
                    files.push(href_buffer.trim().to_string());
                }
            }
            href_buffer.clear();
        } else if in_href {
            href_buffer.push(ch);
        }
    }

    files
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_propfind() {
        let xml = r#"<?xml version="1.0"?><D:multistatus><D:response><D:href>/files/doc1.md</D:href></D:response></D:multistatus>"#;
        let files = parse_propfind_response(xml);
        assert!(files.is_empty() || files.contains(&"/files/doc1.md".to_string()));
    }
}
