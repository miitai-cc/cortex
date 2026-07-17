#![allow(dead_code)]
use anyhow::Result;

pub async fn read_markdown(file_path: &str) -> Result<String> {
    let content = tokio::fs::read_to_string(file_path).await?;
    Ok(content)
}

pub async fn save_markdown(file_path: &str, content: &str) -> Result<()> {
    tokio::fs::write(file_path, content).await?;
    Ok(())
}

pub fn parse_markdown_tokens(content: &str) -> Vec<MarkdownToken> {
    let mut tokens = Vec::new();
    let parser = pulldown_cmark::Parser::new(content);

    for event in parser {
        match event {
            pulldown_cmark::Event::Start(tag) => {
                tokens.push(MarkdownToken::Start(match tag {
                    pulldown_cmark::Tag::Heading { level, .. } => MarkdownTag::Heading(level),
                    pulldown_cmark::Tag::Paragraph => MarkdownTag::Paragraph,
                    pulldown_cmark::Tag::CodeBlock(_) => MarkdownTag::CodeBlock,
                    pulldown_cmark::Tag::List(_) => MarkdownTag::List,
                    pulldown_cmark::Tag::Item => MarkdownTag::ListItem,
                    pulldown_cmark::Tag::Table(_) => MarkdownTag::Table,
                    pulldown_cmark::Tag::Link { .. } => MarkdownTag::Link,
                    _ => MarkdownTag::Other,
                }));
            }
            pulldown_cmark::Event::End(_) => {
                tokens.push(MarkdownToken::End);
            }
            pulldown_cmark::Event::Text(text) => {
                tokens.push(MarkdownToken::Text(text.to_string()));
            }
            pulldown_cmark::Event::Code(text) => {
                tokens.push(MarkdownToken::Code(text.to_string()));
            }
            _ => {}
        }
    }

    tokens
}

#[derive(Debug, Clone)]
pub enum MarkdownTag {
    Heading(pulldown_cmark::HeadingLevel),
    Paragraph,
    CodeBlock,
    List,
    ListItem,
    Table,
    Link,
    Other,
}

#[derive(Debug, Clone)]
pub enum MarkdownToken {
    Start(MarkdownTag),
    End,
    Text(String),
    Code(String),
}
