//! Tree building and manipulation.
//!
//! Converts flat TOC items into hierarchical document structure.

use crate::config::Config;
use crate::error::Result;
use crate::llm::{
    format_prompt, LlmClient, GENERATE_DOC_DESCRIPTION_PROMPT, GENERATE_NODE_SUMMARY_PROMPT,
};
use crate::model::{DocumentNode, PageContent, TocItem};
use futures::future::join_all;
use std::collections::HashMap;

/// Converts a flat list of TOC items into a hierarchical tree structure.
pub fn list_to_tree(items: &[TocItem], total_pages: u32) -> Vec<DocumentNode> {
    if items.is_empty() {
        return vec![];
    }

    // First pass: assign start_index and end_index
    let processed: Vec<_> = items
        .iter()
        .enumerate()
        .map(|(i, item)| {
            let start_index = item.physical_index.unwrap_or(1);

            // End index is next item's start - 1 (or adjusted for appear_start)
            let end_index = if i < items.len() - 1 {
                let next_start = items[i + 1].physical_index.unwrap_or(total_pages);
                if items[i + 1].appear_start.as_deref() == Some("yes") {
                    next_start.saturating_sub(1)
                } else {
                    next_start
                }
            } else {
                total_pages
            };

            (item, start_index, end_index)
        })
        .collect();

    // Build tree based on structure indices
    let mut structure_paths: HashMap<String, Vec<usize>> = HashMap::new();
    let mut root_nodes = Vec::new();

    for (item, start_index, end_index) in &processed {
        let node = DocumentNode {
            node_id: None,
            structure: item.structure.clone(),
            title: item.title.clone(),
            start_index: *start_index,
            end_index: *end_index,
            text: None,
            summary: None,
            prefix_summary: None,
            line_num: None,
            nodes: Vec::new(),
        };

        if let Some(ref structure) = item.structure {
            // Find parent by structure path if available
            if let Some(parent_structure) = get_parent_structure(structure) {
                if let Some(parent_path) = structure_paths.get(&parent_structure).cloned() {
                    if let Some(parent) = get_node_mut(&mut root_nodes, &parent_path) {
                        parent.nodes.push(node);
                        let mut new_path = parent_path;
                        new_path.push(parent.nodes.len() - 1);
                        structure_paths.insert(structure.clone(), new_path);
                        continue;
                    }
                }
            }

            root_nodes.push(node);
            structure_paths.insert(structure.clone(), vec![root_nodes.len() - 1]);
            continue;
        }

        root_nodes.push(node);
    }

    // Clean up empty nodes arrays
    clean_empty_nodes(&mut root_nodes);

    root_nodes
}

/// Gets the parent structure index.
fn get_parent_structure(structure: &str) -> Option<String> {
    let parts: Vec<_> = structure.split('.').collect();
    if parts.len() > 1 {
        Some(parts[..parts.len() - 1].join("."))
    } else {
        None
    }
}

/// Removes empty nodes arrays recursively.
fn clean_empty_nodes(nodes: &mut [DocumentNode]) {
    for node in nodes.iter_mut() {
        if !node.nodes.is_empty() {
            clean_empty_nodes(&mut node.nodes);
        }
    }
}

/// Post-processes TOC items into document nodes.
pub fn post_processing(items: Vec<TocItem>, total_pages: u32) -> Vec<DocumentNode> {
    // Filter items with valid physical_index
    let valid_items: Vec<_> = items
        .into_iter()
        .filter(|item| item.physical_index.is_some())
        .collect();

    if valid_items.is_empty() {
        return vec![];
    }

    list_to_tree(&valid_items, total_pages)
}

/// Writes unique node IDs to all nodes in the tree.
pub fn write_node_ids(nodes: &mut [DocumentNode]) -> u32 {
    let mut counter = 0;
    write_node_ids_recursive(nodes, &mut counter);
    counter
}

fn write_node_ids_recursive(nodes: &mut [DocumentNode], counter: &mut u32) {
    for node in nodes {
        node.node_id = Some(format!("{:04}", counter));
        *counter += 1;
        write_node_ids_recursive(&mut node.nodes, counter);
    }
}

/// Adds text content to all nodes from page data.
pub fn add_node_text(nodes: &mut [DocumentNode], pages: &[PageContent]) {
    for node in nodes {
        let start_idx = (node.start_index.saturating_sub(1)) as usize;
        let end_idx = node.end_index as usize;

        let text: String = pages[start_idx..end_idx.min(pages.len())]
            .iter()
            .map(|p| p.text.as_str())
            .collect::<Vec<_>>()
            .join("");

        node.text = Some(text);

        add_node_text(&mut node.nodes, pages);
    }
}

/// Generates summaries for all nodes in the structure.
pub async fn generate_summaries<C: LlmClient>(
    nodes: &mut [DocumentNode],
    client: &C,
) -> Result<()> {
    // Collect paths to all nodes
    let paths = collect_node_indices(nodes);

    // Collect texts and metadata for each node
    let node_data: Vec<_> = paths
        .iter()
        .filter_map(|path| {
            let node = get_node_ref(nodes, path)?;
            node.text
                .as_ref()
                .map(|text| (path.clone(), text.clone(), node.nodes.is_empty()))
        })
        .collect();

    // Generate summaries concurrently
    let futures: Vec<_> = node_data
        .iter()
        .map(|(_, text, _)| {
            let prompt = format_prompt(GENERATE_NODE_SUMMARY_PROMPT, &[("text", text.as_str())]);
            async move { client.complete(&prompt).await }
        })
        .collect();

    let summaries = join_all(futures).await;

    // Apply summaries
    for ((path, _, is_leaf), summary_result) in node_data.into_iter().zip(summaries) {
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

/// Generates a document description from structure.
pub async fn generate_doc_description<C: LlmClient>(
    structure: &[DocumentNode],
    client: &C,
) -> Result<String> {
    // Create a clean structure for description
    let clean_structure: Vec<_> = structure
        .iter()
        .map(create_clean_node_for_description)
        .collect();

    let structure_json = serde_json::to_string_pretty(&clean_structure)?;
    let prompt = format_prompt(
        GENERATE_DOC_DESCRIPTION_PROMPT,
        &[("structure", &structure_json)],
    );

    client.complete(&prompt).await
}

/// Creates a clean node representation for description generation.
fn create_clean_node_for_description(node: &DocumentNode) -> serde_json::Value {
    let mut obj = serde_json::Map::new();

    obj.insert("title".to_string(), serde_json::json!(node.title));

    if let Some(ref id) = node.node_id {
        obj.insert("node_id".to_string(), serde_json::json!(id));
    }

    if let Some(ref summary) = node.summary {
        obj.insert("summary".to_string(), serde_json::json!(summary));
    }

    if let Some(ref prefix_summary) = node.prefix_summary {
        obj.insert(
            "prefix_summary".to_string(),
            serde_json::json!(prefix_summary),
        );
    }

    if !node.nodes.is_empty() {
        let children: Vec<_> = node
            .nodes
            .iter()
            .map(create_clean_node_for_description)
            .collect();
        obj.insert("nodes".to_string(), serde_json::json!(children));
    }

    serde_json::Value::Object(obj)
}

/// Processes large nodes by recursively splitting them.
pub fn process_large_nodes<'a, C: LlmClient>(
    nodes: &'a mut [DocumentNode],
    pages: &'a [PageContent],
    client: &'a C,
    config: &'a Config,
) -> futures::future::BoxFuture<'a, Result<()>> {
    Box::pin(async move {
        use crate::toc;

        for node in nodes.iter_mut() {
            let page_span = node.end_index.saturating_sub(node.start_index) + 1;
            let start_idx = (node.start_index.saturating_sub(1)) as usize;
            let end_idx = (node.end_index as usize).min(pages.len());

            let token_count: usize = pages[start_idx..end_idx]
                .iter()
                .map(|p| p.token_count)
                .sum();

            // Check if node is too large
            if page_span > config.max_page_num_each_node as u32
                && token_count >= config.max_token_num_each_node
            {
                tracing::info!(
                    "Splitting large node '{}': {} pages, {} tokens",
                    node.title,
                    page_span,
                    token_count
                );

                // Extract pages for this node
                let node_pages: Vec<_> = pages[start_idx..end_idx].to_vec();

                // Generate sub-structure
                let sub_toc =
                    toc::process_no_toc(&node_pages, node.start_index, client, config).await?;

                // Check start appearances
                let mut sub_toc_with_appear = sub_toc;
                toc::check_title_appearance_in_start_concurrent(
                    &mut sub_toc_with_appear,
                    pages,
                    client,
                )
                .await?;

                // Filter and convert to nodes
                let valid_items: Vec<_> = sub_toc_with_appear
                    .into_iter()
                    .filter(|item| item.physical_index.is_some())
                    .collect();

                if !valid_items.is_empty() {
                    // Check if first item matches this node
                    if valid_items[0].title.trim() == node.title.trim() {
                        node.nodes = post_processing(valid_items[1..].to_vec(), node.end_index);
                        if let Some(first_child) = node.nodes.first() {
                            node.end_index = first_child.start_index;
                        }
                    } else {
                        node.nodes = post_processing(valid_items, node.end_index);
                        if let Some(first_child) = node.nodes.first() {
                            node.end_index = first_child.start_index;
                        }
                    }
                }
            }

            // Recursively process children
            if !node.nodes.is_empty() {
                process_large_nodes(&mut node.nodes, pages, client, config).await?;
            }
        }

        Ok(())
    })
}

/// Removes text content from all nodes.
pub fn remove_text(nodes: &mut [DocumentNode]) {
    for node in nodes {
        node.text = None;
        remove_text(&mut node.nodes);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_toc_items() -> Vec<TocItem> {
        vec![
            TocItem::new("Chapter 1")
                .with_structure("1")
                .with_physical_index(1),
            TocItem::new("Section 1.1")
                .with_structure("1.1")
                .with_physical_index(3),
            TocItem::new("Section 1.2")
                .with_structure("1.2")
                .with_physical_index(5),
            TocItem::new("Chapter 2")
                .with_structure("2")
                .with_physical_index(10),
        ]
    }

    #[test]
    fn test_list_to_tree() {
        let items = make_toc_items();
        let tree = list_to_tree(&items, 20);

        assert_eq!(tree.len(), 2); // Two chapters
        assert_eq!(tree[0].title, "Chapter 1");
        assert_eq!(tree[0].nodes.len(), 2);
        assert_eq!(tree[0].nodes[0].title, "Section 1.1");
        assert_eq!(tree[0].nodes[1].title, "Section 1.2");
    }

    #[test]
    fn test_write_node_ids() {
        let mut nodes = vec![
            DocumentNode::new("Root", 1, 10),
            DocumentNode::new("Another", 11, 20),
        ];
        nodes[0].nodes.push(DocumentNode::new("Child", 1, 5));

        let count = write_node_ids(&mut nodes);

        assert_eq!(count, 3);
        assert_eq!(nodes[0].node_id, Some("0000".to_string()));
        assert_eq!(nodes[0].nodes[0].node_id, Some("0001".to_string()));
        assert_eq!(nodes[1].node_id, Some("0002".to_string()));
    }

    #[test]
    fn test_get_parent_structure() {
        assert_eq!(get_parent_structure("1.2.3"), Some("1.2".to_string()));
        assert_eq!(get_parent_structure("1.2"), Some("1".to_string()));
        assert_eq!(get_parent_structure("1"), None);
    }
}
