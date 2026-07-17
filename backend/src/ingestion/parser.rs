use anyhow::Result;
use tokio::io::AsyncReadExt;

pub async fn parse_file(file_path: &str) -> Result<String> {
    let extension = file_path.rsplit('.').next().unwrap_or("").to_lowercase();

    match extension.as_str() {
        "txt" | "md" => parse_text(file_path).await,
        "pdf" => parse_pdf(file_path).await,
        "docx" => parse_docx(file_path).await,
        _ => Err(anyhow::anyhow!("Unsupported file type: {}", extension)),
    }
}

async fn parse_text(file_path: &str) -> Result<String> {
    let mut file = tokio::fs::File::open(file_path).await?;
    let mut content = String::new();
    file.read_to_string(&mut content).await?;
    Ok(content)
}

async fn parse_pdf(file_path: &str) -> Result<String> {
    let bytes = tokio::fs::read(file_path).await?;
    let text = pdf_extract::extract_text_from_mem(&bytes)?;
    Ok(text)
}

async fn parse_docx(file_path: &str) -> Result<String> {
    // Simple docx parsing using zip + xml parsing
    let bytes = tokio::fs::read(file_path).await?;
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor)?;

    let mut content = String::new();
    if let Ok(mut file) = archive.by_name("word/document.xml") {
        use std::io::Read;
        let mut xml_content = String::new();
        file.read_to_string(&mut xml_content)?;
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
    }

    Ok(content)
}
