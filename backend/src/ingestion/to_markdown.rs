use anyhow::{bail, Result};

pub async fn convert_to_markdown(
    source_path: &str,
    source_extension: &str,
    original_filename: &str,
) -> Result<String> {
    let extension = source_extension
        .trim_start_matches('.')
        .to_ascii_lowercase();
    if extension == "md" || extension == "markdown" || extension == "txt" {
        return Ok(source_path.to_string());
    }

    let title = std::path::Path::new(original_filename)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Document");
    let markdown = match extension.as_str() {
        "pdf" => pdf_to_markdown(source_path, title).await?,
        "docx" => {
            let content = crate::office::word::read_word(source_path).await?;
            format!("# {title}\n\n{}\n", content.trim())
        }
        "xlsx" => excel_to_markdown(source_path, title).await?,
        "pptx" => powerpoint_to_markdown(source_path, title).await?,
        _ => bail!("Unsupported file type for Markdown conversion: {extension}"),
    };

    let output_path = format!("{source_path}.converted.md");
    tokio::fs::write(&output_path, markdown).await?;
    Ok(output_path)
}

async fn pdf_to_markdown(source_path: &str, title: &str) -> Result<String> {
    let path = source_path.to_string();
    let pages =
        tokio::task::spawn_blocking(move || pageindex_core::pdf::get_page_tokens(&path, "gpt-4o"))
            .await??;
    let mut markdown = format!("# {title}\n\n");
    for (index, page) in pages.iter().enumerate() {
        markdown.push_str(&format!(
            "## Page {}\n\n{}\n\n",
            index + 1,
            page.text.trim()
        ));
    }
    Ok(markdown)
}

async fn excel_to_markdown(source_path: &str, title: &str) -> Result<String> {
    let rows = crate::office::excel::read_excel(source_path).await?;
    let width = rows.iter().map(Vec::len).max().unwrap_or(0);
    let mut markdown = format!("# {title}\n\n## Spreadsheet data\n\n");
    if width == 0 {
        return Ok(markdown);
    }

    for (index, row) in rows.iter().enumerate() {
        markdown.push('|');
        for column in 0..width {
            let value = row.get(column).map(String::as_str).unwrap_or("");
            markdown.push_str(&format!(" {} |", escape_table_cell(value)));
        }
        markdown.push('\n');
        if index == 0 {
            markdown.push('|');
            for _ in 0..width {
                markdown.push_str(" --- |");
            }
            markdown.push('\n');
        }
    }
    Ok(markdown)
}

async fn powerpoint_to_markdown(source_path: &str, title: &str) -> Result<String> {
    let slides = crate::office::powerpoint::read_powerpoint(source_path).await?;
    let mut markdown = format!("# {title}\n\n");
    for (index, slide) in slides.iter().enumerate() {
        markdown.push_str(&format!("## Slide {}\n\n{}\n\n", index + 1, slide.trim()));
    }
    Ok(markdown)
}

fn escape_table_cell(value: &str) -> String {
    value.replace('|', "\\|").replace(['\r', '\n'], " ")
}

#[cfg(test)]
mod tests {
    use super::{convert_to_markdown, escape_table_cell};

    #[test]
    fn escapes_markdown_table_cells() {
        assert_eq!(escape_table_cell("a|b\nnext"), "a\\|b next");
    }

    #[tokio::test]
    async fn converts_office_formats_to_markdown() {
        let test_dir = std::env::temp_dir().join(format!("cortex-md-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir_all(&test_dir).await.unwrap();

        let docx = test_dir.join("sample.docx");
        crate::office::word::create_word("Word content", docx.to_str().unwrap())
            .await
            .unwrap();
        let docx_md = convert_to_markdown(docx.to_str().unwrap(), "docx", "sample.docx")
            .await
            .unwrap();
        assert!(tokio::fs::read_to_string(docx_md)
            .await
            .unwrap()
            .contains("Word content"));

        let xlsx = test_dir.join("sample.xlsx");
        crate::office::excel::create_excel(
            vec![
                vec!["Name".into(), "Value".into()],
                vec!["A".into(), "1".into()],
            ],
            xlsx.to_str().unwrap(),
        )
        .await
        .unwrap();
        let xlsx_md = convert_to_markdown(xlsx.to_str().unwrap(), "xlsx", "sample.xlsx")
            .await
            .unwrap();
        assert!(tokio::fs::read_to_string(xlsx_md)
            .await
            .unwrap()
            .contains("| Name | Value |"));

        let pptx = test_dir.join("sample.pptx");
        crate::office::powerpoint::create_powerpoint(
            vec!["Slide content".into()],
            pptx.to_str().unwrap(),
        )
        .await
        .unwrap();
        let pptx_md = convert_to_markdown(pptx.to_str().unwrap(), "pptx", "sample.pptx")
            .await
            .unwrap();
        assert!(tokio::fs::read_to_string(pptx_md)
            .await
            .unwrap()
            .contains("## Slide 1"));

        tokio::fs::remove_dir_all(test_dir).await.unwrap();
    }
}
