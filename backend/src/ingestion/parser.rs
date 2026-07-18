use anyhow::Result;
use tokio::io::AsyncReadExt;

pub async fn parse_file(file_path: &str) -> Result<String> {
    tracing::debug!("[parse_file] 開始解析文件 file_path={}", file_path);
    let extension = file_path.rsplit('.').next().unwrap_or("").to_lowercase();
    tracing::debug!("[parse_file] 偵測到副檔名: '{}'", extension);

    match extension.as_str() {
        "txt" | "md" => {
            tracing::debug!("[parse_file] → 分派到 parse_text (txt/md)");
            let result = parse_text(file_path).await;
            match &result {
                Ok(content) => tracing::debug!(
                    "[parse_file] parse_text 完成，content_len={}",
                    content.len()
                ),
                Err(e) => tracing::debug!("[parse_file] parse_text 失敗: {:?}", e),
            }
            result
        }
        "pdf" => {
            tracing::debug!("[parse_file] → 分派到 parse_pdf");
            let result = parse_pdf(file_path).await;
            match &result {
                Ok(content) => tracing::debug!(
                    "[parse_file] parse_pdf 完成，content_len={}",
                    content.len()
                ),
                Err(e) => tracing::debug!("[parse_file] parse_pdf 失敗: {:?}", e),
            }
            result
        }
        "docx" => {
            tracing::debug!("[parse_file] → 分派到 parse_docx");
            let result = parse_docx(file_path).await;
            match &result {
                Ok(content) => tracing::debug!(
                    "[parse_file] parse_docx 完成，content_len={}",
                    content.len()
                ),
                Err(e) => tracing::debug!("[parse_file] parse_docx 失敗: {:?}", e),
            }
            result
        }
        _ => {
            tracing::debug!("[parse_file] 不支援的副檔名 '{}', file_path={}", extension, file_path);
            Err(anyhow::anyhow!("Unsupported file type: {}", extension))
        }
    }
}

async fn parse_text(file_path: &str) -> Result<String> {
    tracing::debug!("[parse_text] 開啟文字文件 file_path={}", file_path);
    let mut file = tokio::fs::File::open(file_path).await?;
    let mut content = String::new();
    file.read_to_string(&mut content).await?;
    tracing::debug!(
        "[parse_text] 讀取完成，content_len={}, 前 100 字元: {:?}",
        content.len(),
        &content[..content.len().min(100)]
    );
    Ok(content)
}

async fn parse_pdf(file_path: &str) -> Result<String> {
    tracing::debug!("[parse_pdf] 讀取 PDF 檔案 file_path={}", file_path);
    let bytes = tokio::fs::read(file_path).await?;
    tracing::debug!("[parse_pdf] 讀取完成，byte_len={}", bytes.len());
    tracing::debug!("[parse_pdf] 呼叫 pdf_extract::extract_text_from_mem...");
    let text = pdf_extract::extract_text_from_mem(&bytes)?;
    tracing::debug!(
        "[parse_pdf] 提取完成，text_len={}, 前 100 字元: {:?}",
        text.len(),
        &text[..text.len().min(100)]
    );
    Ok(text)
}

async fn parse_docx(file_path: &str) -> Result<String> {
    tracing::debug!("[parse_docx] 讀取 docx 檔案 file_path={}", file_path);
    // Simple docx parsing using zip + xml parsing
    let bytes = tokio::fs::read(file_path).await?;
    tracing::debug!("[parse_docx] 讀取完成，byte_len={}", bytes.len());

    tracing::debug!("[parse_docx] 開啟 zip archive...");
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor)?;

    let mut content = String::new();
    tracing::debug!("[parse_docx] 嘗試讀取 word/document.xml...");
    if let Ok(mut file) = archive.by_name("word/document.xml") {
        use std::io::Read;
        let mut xml_content = String::new();
        file.read_to_string(&mut xml_content)?;
        tracing::debug!(
            "[parse_docx] XML 讀取完成，xml_len={}",
            xml_content.len()
        );
        // Simple XML tag stripping for text extraction
        content = xml_content
            .replace("<w:p>", "\n")
            .replace("<w:r>", "")
            .replace("</w:r>", "")
            .replace("<w:t>", "")
            .replace("</w:t>", "\n")
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .collect::<Vec<_>>()
            .join("\n");
        tracing::debug!(
            "[parse_docx] XML 解析完成，content_len={}, 前 100 字元: {:?}",
            content.len(),
            &content[..content.len().min(100)]
        );
    } else {
        tracing::debug!("[parse_docx] word/document.xml 不存在於 archive 中");
    }

    Ok(content)
}
