use anyhow::Result;

pub async fn read_word(file_path: &str) -> Result<String> {
    let bytes = tokio::fs::read(file_path).await?;
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor)?;

    let mut content = String::new();
    if let Ok(mut file) = archive.by_name("word/document.xml") {
        use std::io::Read;
        let mut xml_content = String::new();
        file.read_to_string(&mut xml_content)?;
        content = extract_text_from_xml(&xml_content);
    }

    Ok(content)
}

pub async fn create_word(content: &str, output_path: &str) -> Result<()> {
    use std::io::Write;
    let mut archive = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));

    let opts = zip::write::FileOptions::<()>::default();
    archive.add_directory("_rels/", opts)?;
    archive.add_directory("word/", opts)?;
    archive.add_directory("docProps/", opts)?;

    archive.start_file("[Content_Types].xml", opts)?;
    archive.write_all(
        br#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
            <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
            <Default Extension="xml" ContentType="application/xml"/>
            <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
        </Types>"#
    )?;

    archive.start_file("word/document.xml", opts)?;
    let doc_xml = format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:body>
                <w:p><w:r><w:t>{}</w:t></w:r></w:p>
            </w:body>
        </w:document>"#,
        content.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
    );
    archive.write_all(doc_xml.as_bytes())?;

    let cursor = archive.finish()?;
    let bytes = cursor.into_inner();
    tokio::fs::write(output_path, bytes).await?;

    Ok(())
}

pub async fn word_to_pdf(word_path: &str, pdf_path: &str) -> Result<()> {
    let content = read_word(word_path).await?;
    let pdf_content = format!(
        r#"<html><body><pre>{}</pre></body></html>"#,
        content.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
    );
    tokio::fs::write(pdf_path, pdf_content).await?;
    Ok(())
}

fn extract_text_from_xml(xml: &str) -> String {
    let mut text = String::new();
    let mut in_tag = false;
    let mut in_t_tag = false;
    let mut tag_buffer = String::new();
    let mut content_buffer = String::new();

    for ch in xml.chars() {
        if ch == '<' {
            in_tag = true;
            tag_buffer.clear();
            content_buffer.clear();
            continue;
        }
        if ch == '>' {
            in_tag = false;
            if tag_buffer.starts_with("w:t") || tag_buffer.starts_with("/w:t") {
                in_t_tag = tag_buffer.starts_with("w:t");
            }
            if tag_buffer == "w:p" || tag_buffer == "/w:p" {
                text.push('\n');
            }
            continue;
        }
        if in_tag {
            tag_buffer.push(ch);
        } else if in_t_tag {
            text.push(ch);
        }
    }

    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_text() {
        let xml = r#"<w:document><w:body><w:p><w:r><w:t>Hello World</w:t></w:r></w:p></w:body></w:document>"#;
        let text = extract_text_from_xml(xml);
        assert_eq!(text.trim(), "Hello World");
    }
}
