//! Markdown parsing and tree building.
//!
//! Extracts hierarchical structure from markdown documents based on headers.

use crate::config::Config;
use crate::error::{PageIndexError, Result};
use crate::llm::{format_prompt, LlmClient, GENERATE_NODE_SUMMARY_PROMPT};
use crate::model::{DocumentNode, DocumentStructure};
use crate::pdf::count_tokens;
use futures::future::join_all;
use regex::Regex;
use std::path::Path;

/// A node extracted from markdown headers.
#[derive(Debug, Clone)]
struct MarkdownNode {
    title: String,
    level: usize,
    line_num: u32,
    text: String,
    token_count: usize,
}

/// Extracts nodes from markdown headers.
fn extract_nodes_from_markdown(content: &str) -> Vec<MarkdownNode> {
    let header_pattern = Regex::new(r"^(#{1,6})\s+(.+)$").unwrap();
    let code_block_pattern = Regex::new(r"^```").unwrap();

    let mut nodes = Vec::new();
    let lines: Vec<_> = content.lines().collect();
    let mut in_code_block = false;

    for (line_num, line) in lines.iter().enumerate() {
        let stripped = line.trim();

        // Toggle code block state
        if code_block_pattern.is_match(stripped) {
            in_code_block = !in_code_block;
            continue;
        }

        // Skip if in code block or empty
        if in_code_block || stripped.is_empty() {
            continue;
        }

        // Check for header
        if let Some(caps) = header_pattern.captures(stripped) {
            let level = caps.get(1).unwrap().as_str().len();
            let title = caps.get(2).unwrap().as_str().trim().to_string();

            nodes.push(MarkdownNode {
                title,
                level,
                line_num: (line_num + 1) as u32,
                text: String::new(),
                token_count: 0,
            });
        }
    }

    nodes
}

/// Extracts text content for each node.
fn extract_node_text(nodes: &mut [MarkdownNode], lines: &[&str], model: &str) -> Result<()> {
    for i in 0..nodes.len() {
        let start_line = (nodes[i].line_num - 1) as usize;
        let end_line = if i + 1 < nodes.len() {
            (nodes[i + 1].line_num - 1) as usize
        } else {
            lines.len()
        };

        let text = lines[start_line..end_line].join("\n").trim().to_string();
        let token_count = count_tokens(&text, model)?;

        nodes[i].text = text;
        nodes[i].token_count = token_count;
    }

    Ok(())
}

/// Updates token counts to include all descendant content.
fn update_cumulative_token_counts(nodes: &mut [MarkdownNode], _model: &str) -> Result<()> {
    // Process from end to beginning so children are processed before parents
    for i in (0..nodes.len()).rev() {
        let current_level = nodes[i].level;

        // Find all descendants and sum their tokens
        let descendant_tokens: usize = nodes
            .iter()
            .skip(i + 1)
            .take_while(|node| node.level > current_level)
            .map(|node| node.token_count)
            .sum();

        nodes[i].token_count += descendant_tokens;
    }

    Ok(())
}

/// Thins the tree by merging small nodes into their parents.
fn tree_thinning(
    nodes: Vec<MarkdownNode>,
    min_tokens: usize,
    model: &str,
) -> Result<Vec<MarkdownNode>> {
    let mut result = nodes;
    let mut to_remove = std::collections::HashSet::new();

    for i in (0..result.len()).rev() {
        if to_remove.contains(&i) {
            continue;
        }

        if result[i].token_count < min_tokens {
            let current_level = result[i].level;

            // Find and mark all children for removal
            let mut children_text = Vec::new();
            for (j, node) in result.iter().enumerate().skip(i + 1) {
                if node.level <= current_level {
                    break;
                }
                if !to_remove.contains(&j) {
                    children_text.push(node.text.clone());
                    to_remove.insert(j);
                }
            }

            // Merge children text into parent
            if !children_text.is_empty() {
                result[i].text = format!("{}\n\n{}", result[i].text, children_text.join("\n\n"));
                result[i].token_count = count_tokens(&result[i].text, model)?;
            }
        }
    }

    // Remove marked nodes
    let filtered: Vec<_> = result
        .into_iter()
        .enumerate()
        .filter(|(i, _)| !to_remove.contains(i))
        .map(|(_, n)| n)
        .collect();

    Ok(filtered)
}

/// Builds a tree from flat markdown nodes.
fn build_tree_from_nodes(nodes: Vec<MarkdownNode>) -> Vec<DocumentNode> {
    if nodes.is_empty() {
        return vec![];
    }

    let mut stack: Vec<(DocumentNode, usize)> = Vec::new();
    let mut root_nodes = Vec::new();

    for node in nodes {
        let tree_node = DocumentNode {
            node_id: None,
            structure: None,
            title: node.title,
            start_index: node.line_num,
            end_index: node.line_num, // Will be updated
            text: Some(node.text),
            summary: None,
            prefix_summary: None,
            line_num: Some(node.line_num),
            nodes: Vec::new(),
        };

        // Pop nodes from stack that are same or higher level
        while !stack.is_empty() && stack.last().unwrap().1 >= node.level {
            let (completed, _) = stack.pop().unwrap();

            if stack.is_empty() {
                root_nodes.push(completed);
            } else {
                stack.last_mut().unwrap().0.nodes.push(completed);
            }
        }

        stack.push((tree_node, node.level));
    }

    // Empty remaining stack
    while let Some((completed, _)) = stack.pop() {
        if stack.is_empty() {
            root_nodes.push(completed);
        } else {
            stack.last_mut().unwrap().0.nodes.push(completed);
        }
    }

    root_nodes
}

/// Generates summaries for markdown nodes.
async fn generate_summaries<C: LlmClient>(
    nodes: &mut [DocumentNode],
    summary_token_threshold: usize,
    client: &C,
    model: &str,
) -> Result<()> {
    // Collect paths to all nodes
    let paths = collect_node_indices(nodes);

    // Collect texts and metadata for each node
    let node_data: Vec<_> = paths
        .iter()
        .filter_map(|path| {
            let node = get_node_ref(nodes, path)?;
            node.text.as_ref().map(|text| {
                let token_count = count_tokens(text, model).unwrap_or(0);
                let should_summarize = token_count >= summary_token_threshold;
                (
                    path.clone(),
                    text.clone(),
                    node.nodes.is_empty(),
                    should_summarize,
                )
            })
        })
        .collect();

    // Generate summaries concurrently
    let futures: Vec<_> = node_data
        .iter()
        .map(|(_, text, _, should_summarize)| {
            let text = text.clone();
            let should_summarize = *should_summarize;
            async move {
                if should_summarize {
                    let prompt =
                        format_prompt(GENERATE_NODE_SUMMARY_PROMPT, &[("text", text.as_str())]);
                    client.complete(&prompt).await
                } else {
                    Ok(text)
                }
            }
        })
        .collect();

    let summaries = join_all(futures).await;

    // Apply summaries
    for ((path, _, is_leaf, _), summary_result) in node_data.into_iter().zip(summaries) {
        if let Ok(summary) = summary_result {
            if let Some(node) = get_node_mut(nodes, &path) {
                if is_leaf {
                    node.summary = Some(summary);
                } else {
                    node.prefix_summary = Some(summary);
                }
            }
        }
    }

    Ok(())
}

/// Collects node indices that need processing.
fn collect_node_indices(nodes: &[DocumentNode]) -> Vec<Vec<usize>> {
    let mut paths = Vec::new();
    for (i, node) in nodes.iter().enumerate() {
        paths.push(vec![i]);
        for child_path in collect_node_indices(&node.nodes) {
            let mut full_path = vec![i];
            full_path.extend(child_path);
            paths.push(full_path);
        }
    }
    paths
}

/// Gets a mutable reference to a node by path.
fn get_node_mut<'a>(nodes: &'a mut [DocumentNode], path: &[usize]) -> Option<&'a mut DocumentNode> {
    if path.is_empty() {
        return None;
    }

    let mut current = nodes.get_mut(path[0])?;
    for &idx in &path[1..] {
        current = current.nodes.get_mut(idx)?;
    }
    Some(current)
}

/// Gets an immutable reference to a node by path.
fn get_node_ref<'a>(nodes: &'a [DocumentNode], path: &[usize]) -> Option<&'a DocumentNode> {
    if path.is_empty() {
        return None;
    }

    let mut current = nodes.get(path[0])?;
    for &idx in &path[1..] {
        current = current.nodes.get(idx)?;
    }
    Some(current)
}

/// Main entry point for markdown to tree conversion.
///
/// # Arguments
///
/// * `path` - Path to the markdown file
/// * `client` - LLM client for summary generation
/// * `config` - Configuration options
pub async fn md_to_tree<P: AsRef<Path>, C: LlmClient>(
    path: P,
    client: &C,
    config: &Config,
) -> Result<DocumentStructure> {
    let path = path.as_ref();

    // Read file
    let content = std::fs::read_to_string(path)
        .map_err(|e| PageIndexError::MarkdownError(format!("Failed to read file: {}", e)))?;

    let doc_name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string();

    md_to_tree_from_content(&content, doc_name, client, config).await
}

/// Converts markdown content to tree structure.
pub async fn md_to_tree_from_content<C: LlmClient>(
    content: &str,
    doc_name: String,
    client: &C,
    config: &Config,
) -> Result<DocumentStructure> {
    let lines: Vec<_> = content.lines().collect();

    // Extract nodes from headers
    let mut nodes = extract_nodes_from_markdown(content);

    if nodes.is_empty() {
        return Err(PageIndexError::MarkdownError(
            "No headers found in markdown".into(),
        ));
    }

    // Extract text content
    extract_node_text(&mut nodes, &lines, &config.model)?;

    // Update cumulative token counts
    update_cumulative_token_counts(&mut nodes, &config.model)?;

    // Apply tree thinning if configured
    if config.min_token_threshold > 0 {
        nodes = tree_thinning(nodes, config.min_token_threshold, &config.model)?;
    }

    // Build tree structure
    let mut structure = build_tree_from_nodes(nodes);

    // Write node IDs if requested
    if config.if_add_node_id {
        crate::tree::write_node_ids(&mut structure);
    }

    // Generate summaries if requested
    if config.if_add_node_summary {
        generate_summaries(
            &mut structure,
            config.summary_token_threshold,
            client,
            &config.model,
        )
        .await?;

        // Remove text if not requested
        if !config.if_add_node_text {
            crate::tree::remove_text(&mut structure);
        }
    } else if !config.if_add_node_text {
        // Remove text if not requested
        crate::tree::remove_text(&mut structure);
    }

    // Generate document description if requested
    let doc_description = if config.if_add_doc_description {
        Some(crate::tree::generate_doc_description(&structure, client).await?)
    } else {
        None
    };

    Ok(DocumentStructure {
        doc_name,
        doc_description,
        structure,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_MD: &str = r#"
# Chapter 1

Introduction text here.

## Section 1.1

Some content.

### Subsection 1.1.1

Detailed content.

## Section 1.2

More content.

# Chapter 2

Another chapter.
"#;

    #[test]
    fn test_extract_nodes() {
        let nodes = extract_nodes_from_markdown(SAMPLE_MD);

        assert_eq!(nodes.len(), 5);
        assert_eq!(nodes[0].title, "Chapter 1");
        assert_eq!(nodes[0].level, 1);
        assert_eq!(nodes[1].title, "Section 1.1");
        assert_eq!(nodes[1].level, 2);
        assert_eq!(nodes[2].title, "Subsection 1.1.1");
        assert_eq!(nodes[2].level, 3);
    }

    #[test]
    fn test_extract_nodes_ignores_code_blocks() {
        let md = r#"
# Real Header

```markdown
# This is not a header
## Neither is this
```

## Another Real Header
"#;
        let nodes = extract_nodes_from_markdown(md);

        assert_eq!(nodes.len(), 2);
        assert_eq!(nodes[0].title, "Real Header");
        assert_eq!(nodes[1].title, "Another Real Header");
    }

    #[test]
    fn test_build_tree() {
        let nodes = vec![
            MarkdownNode {
                title: "Chapter 1".to_string(),
                level: 1,
                line_num: 1,
                text: "Chapter text".to_string(),
                token_count: 10,
            },
            MarkdownNode {
                title: "Section 1.1".to_string(),
                level: 2,
                line_num: 5,
                text: "Section text".to_string(),
                token_count: 10,
            },
            MarkdownNode {
                title: "Chapter 2".to_string(),
                level: 1,
                line_num: 10,
                text: "Another chapter".to_string(),
                token_count: 10,
            },
        ];

        let tree = build_tree_from_nodes(nodes);

        assert_eq!(tree.len(), 2);
        assert_eq!(tree[0].title, "Chapter 1");
        assert_eq!(tree[0].nodes.len(), 1);
        assert_eq!(tree[0].nodes[0].title, "Section 1.1");
        assert_eq!(tree[1].title, "Chapter 2");
    }
}
