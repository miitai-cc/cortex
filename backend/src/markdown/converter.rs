use anyhow::Result;
use comrak::{markdown_to_html, ComrakOptions};

pub fn markdown_to_html_str(markdown: &str) -> String {
    let mut options = ComrakOptions::default();
    options.extension.table = true;
    options.extension.strikethrough = true;
    options.extension.tasklist = true;
    options.render.unsafe_ = true;
    markdown_to_html(markdown, &options)
}

pub async fn convert_to_html(markdown: &str, output_path: &str) -> Result<()> {
    let html = markdown_to_html_str(markdown);
    let full_html = format!(
        r#"<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><title>Converted Document</title>
<style>
body {{ max-width: 800px; margin: 0 auto; padding: 20px; font-family: system-ui, sans-serif; line-height: 1.6; }}
table {{ border-collapse: collapse; width: 100%; }}
th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
pre {{ background: #f5f5f5; padding: 16px; border-radius: 4px; overflow-x: auto; }}
code {{ background: #f5f5f5; padding: 2px 4px; border-radius: 2px; }}
</style></head><body>{}</body></html>"#,
        html
    );
    tokio::fs::write(output_path, full_html).await?;
    Ok(())
}

pub async fn convert_to_pdf(markdown: &str, output_path: &str) -> Result<()> {
    let html = markdown_to_html_str(markdown);
    let full_html = format!(
        r#"<html><head><meta charset="UTF-8">
<style>body {{ font-family: system-ui, sans-serif; line-height: 1.6; padding: 20px; }}</style>
</head><body>{}</body></html>"#,
        html
    );
    tokio::fs::write(output_path, full_html).await?;
    Ok(())
}

pub async fn convert_to_word(markdown: &str, output_path: &str) -> Result<()> {
    let html = markdown_to_html_str(markdown);
    let plain_text = strip_html_tags(&html);
    crate::office::word::create_word(&plain_text, output_path).await
}

pub async fn convert_to_excel(markdown: &str, output_path: &str) -> Result<()> {
    let mut data = Vec::new();
    for line in markdown.lines() {
        if line.starts_with('|') && line.ends_with('|') {
            let row: Vec<String> = line
                .trim_matches('|')
                .split('|')
                .map(|s| s.trim().to_string())
                .collect();
            if !row.iter().all(|s| s.contains("---")) {
                data.push(row);
            }
        }
    }
    crate::office::excel::create_excel(data, output_path).await
}

pub async fn convert_to_powerpoint(markdown: &str, output_path: &str) -> Result<()> {
    let mut titles = Vec::new();
    for line in markdown.lines() {
        if line.starts_with("# ") {
            titles.push(line.trim_start_matches("# ").to_string());
        }
    }
    if titles.is_empty() {
        titles.push("Presentation".to_string());
    }
    crate::office::powerpoint::create_powerpoint(titles, output_path).await
}

fn strip_html_tags(html: &str) -> String {
    let mut text = String::new();
    let mut in_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                text.push(' ');
            }
            _ if !in_tag => text.push(ch),
            _ => {}
        }
    }
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_markdown_to_html() {
        let md = "# Hello\n\nThis is **bold** text.";
        let html = markdown_to_html_str(md);
        assert!(html.contains("<h1>"));
        assert!(html.contains("<strong>"));
    }

    #[test]
    fn test_strip_html() {
        let html = "<p>Hello <strong>World</strong></p>";
        let text = strip_html_tags(html);
        assert_eq!(text.trim(), "Hello  World");
    }
}
