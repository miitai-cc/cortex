//! Core data structures for document indexing.
//!
//! This module contains all the types used to represent document structure,
//! table of contents items, and processing results.

use serde::{Deserialize, Serialize};

/// Represents a single item in the table of contents.
///
/// This is the intermediate representation extracted from the TOC,
/// before being converted into the hierarchical document tree.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TocItem {
    /// Hierarchical structure index (e.g., "1.2.3")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub structure: Option<String>,

    /// Title of the section
    pub title: String,

    /// Physical page index (1-based)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub physical_index: Option<u32>,

    /// Logical page number as listed in the TOC
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<u32>,

    /// Whether this section appears at the start of its page
    #[serde(skip_serializing_if = "Option::is_none")]
    pub appear_start: Option<String>,

    /// Index in the original list (used for verification)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub list_index: Option<usize>,
}

impl TocItem {
    /// Creates a new TOC item with just a title.
    pub fn new(title: impl Into<String>) -> Self {
        Self {
            structure: None,
            title: title.into(),
            physical_index: None,
            page: None,
            appear_start: None,
            list_index: None,
        }
    }

    /// Sets the structure index.
    pub fn with_structure(mut self, structure: impl Into<String>) -> Self {
        self.structure = Some(structure.into());
        self
    }

    /// Sets the physical page index.
    pub fn with_physical_index(mut self, index: u32) -> Self {
        self.physical_index = Some(index);
        self
    }

    /// Sets the logical page number.
    pub fn with_page(mut self, page: u32) -> Self {
        self.page = Some(page);
        self
    }
}

/// Represents a node in the document structure tree.
///
/// Each node corresponds to a section in the document, potentially
/// containing nested subsections.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DocumentNode {
    /// Unique identifier for this node (e.g., "0001", "0002")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,

    /// Hierarchical structure index (e.g., "1.2.3")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub structure: Option<String>,

    /// Title of this section
    pub title: String,

    /// Starting page index (1-based, inclusive)
    pub start_index: u32,

    /// Ending page index (1-based, inclusive)
    pub end_index: u32,

    /// Full text content of this section
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,

    /// Summary of this section's content
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,

    /// Summary of the prefix content (for nodes with children)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prefix_summary: Option<String>,

    /// Line number in the source file (for markdown)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_num: Option<u32>,

    /// Child sections
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub nodes: Vec<DocumentNode>,
}

impl DocumentNode {
    /// Creates a new document node with the required fields.
    pub fn new(title: impl Into<String>, start_index: u32, end_index: u32) -> Self {
        Self {
            node_id: None,
            structure: None,
            title: title.into(),
            start_index,
            end_index,
            text: None,
            summary: None,
            prefix_summary: None,
            line_num: None,
            nodes: Vec::new(),
        }
    }

    /// Returns true if this node has no children.
    pub fn is_leaf(&self) -> bool {
        self.nodes.is_empty()
    }

    /// Returns the total number of pages this node spans.
    pub fn page_count(&self) -> u32 {
        self.end_index.saturating_sub(self.start_index) + 1
    }

    /// Recursively collects all nodes (including this one) into a flat list.
    pub fn flatten(&self) -> Vec<&DocumentNode> {
        let mut nodes = vec![self];
        for child in &self.nodes {
            nodes.extend(child.flatten());
        }
        nodes
    }

    /// Recursively collects all leaf nodes.
    pub fn leaf_nodes(&self) -> Vec<&DocumentNode> {
        if self.is_leaf() {
            vec![self]
        } else {
            self.nodes.iter().flat_map(|n| n.leaf_nodes()).collect()
        }
    }

    /// Finds a node by its ID.
    pub fn find_by_id(&self, node_id: &str) -> Option<&DocumentNode> {
        if self.node_id.as_deref() == Some(node_id) {
            return Some(self);
        }
        for child in &self.nodes {
            if let Some(found) = child.find_by_id(node_id) {
                return Some(found);
            }
        }
        None
    }
}

/// The complete document structure with metadata.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DocumentStructure {
    /// Name of the document (filename without extension)
    pub doc_name: String,

    /// Brief description of the document
    #[serde(skip_serializing_if = "Option::is_none")]
    pub doc_description: Option<String>,

    /// Root-level sections
    pub structure: Vec<DocumentNode>,
}

impl DocumentStructure {
    /// Creates a new document structure.
    pub fn new(doc_name: impl Into<String>, structure: Vec<DocumentNode>) -> Self {
        Self {
            doc_name: doc_name.into(),
            doc_description: None,
            structure,
        }
    }

    /// Returns all nodes in the document as a flat list.
    pub fn all_nodes(&self) -> Vec<&DocumentNode> {
        self.structure.iter().flat_map(|n| n.flatten()).collect()
    }

    /// Returns all leaf nodes in the document.
    pub fn leaf_nodes(&self) -> Vec<&DocumentNode> {
        self.structure.iter().flat_map(|n| n.leaf_nodes()).collect()
    }

    /// Finds a node by its ID.
    pub fn find_by_id(&self, node_id: &str) -> Option<&DocumentNode> {
        for node in &self.structure {
            if let Some(found) = node.find_by_id(node_id) {
                return Some(found);
            }
        }
        None
    }

    /// Returns the total number of nodes in the document.
    pub fn node_count(&self) -> usize {
        self.all_nodes().len()
    }
}

/// Represents a single page's content with its token count.
#[derive(Debug, Clone)]
pub struct PageContent {
    /// The extracted text content
    pub text: String,

    /// Number of tokens in the text
    pub token_count: usize,

    /// Page number (1-based)
    pub page_number: u32,
}

impl PageContent {
    /// Creates a new page content.
    pub fn new(text: impl Into<String>, token_count: usize, page_number: u32) -> Self {
        Self {
            text: text.into(),
            token_count,
            page_number,
        }
    }

    /// Wraps the text with physical index tags.
    pub fn with_tags(&self) -> String {
        format!(
            "<physical_index_{}>\n{}\n<physical_index_{}>\n\n",
            self.page_number, self.text, self.page_number
        )
    }
}

/// Result of TOC detection.
#[derive(Debug, Clone)]
pub struct TocDetectionResult {
    /// Raw TOC content extracted from pages
    pub toc_content: Option<String>,

    /// Page indices that contain the TOC
    pub toc_page_list: Vec<usize>,

    /// Whether page numbers are included in the TOC
    pub page_index_given_in_toc: bool,
}

impl TocDetectionResult {
    /// Returns true if a TOC was detected.
    pub fn has_toc(&self) -> bool {
        !self.toc_page_list.is_empty() && self.toc_content.is_some()
    }
}

/// Result of TOC verification.
#[derive(Debug, Clone)]
pub struct VerificationResult {
    /// Accuracy of the verification (0.0 to 1.0)
    pub accuracy: f64,

    /// List of incorrect items that need fixing
    pub incorrect_results: Vec<IncorrectTocItem>,
}

/// An item that failed verification.
#[derive(Debug, Clone)]
pub struct IncorrectTocItem {
    /// Index in the TOC list
    pub list_index: usize,

    /// Title of the section
    pub title: String,

    /// The (possibly incorrect) physical page index
    pub page_number: Option<u32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_toc_item_builder() {
        let item = TocItem::new("Introduction")
            .with_structure("1")
            .with_physical_index(5)
            .with_page(1);

        assert_eq!(item.title, "Introduction");
        assert_eq!(item.structure, Some("1".to_string()));
        assert_eq!(item.physical_index, Some(5));
        assert_eq!(item.page, Some(1));
    }

    #[test]
    fn test_document_node_flatten() {
        let mut root = DocumentNode::new("Root", 1, 10);
        let child1 = DocumentNode::new("Child 1", 1, 5);
        let mut child2 = DocumentNode::new("Child 2", 6, 10);
        let grandchild = DocumentNode::new("Grandchild", 6, 8);

        child2.nodes.push(grandchild);
        root.nodes.push(child1);
        root.nodes.push(child2);

        let flattened = root.flatten();
        assert_eq!(flattened.len(), 4);
        assert_eq!(flattened[0].title, "Root");
        assert_eq!(flattened[1].title, "Child 1");
        assert_eq!(flattened[2].title, "Child 2");
        assert_eq!(flattened[3].title, "Grandchild");
    }

    #[test]
    fn test_document_node_leaf_nodes() {
        let mut root = DocumentNode::new("Root", 1, 10);
        let child1 = DocumentNode::new("Child 1", 1, 5);
        let mut child2 = DocumentNode::new("Child 2", 6, 10);
        let grandchild = DocumentNode::new("Grandchild", 6, 8);

        child2.nodes.push(grandchild);
        root.nodes.push(child1);
        root.nodes.push(child2);

        let leaves = root.leaf_nodes();
        assert_eq!(leaves.len(), 2);
        assert_eq!(leaves[0].title, "Child 1");
        assert_eq!(leaves[1].title, "Grandchild");
    }

    #[test]
    fn test_page_content_with_tags() {
        let page = PageContent::new("Hello world", 2, 1);
        let tagged = page.with_tags();

        assert!(tagged.contains("<physical_index_1>"));
        assert!(tagged.contains("Hello world"));
    }

    #[test]
    fn test_document_structure_serialization() {
        let structure =
            DocumentStructure::new("test-doc", vec![DocumentNode::new("Chapter 1", 1, 10)]);

        let json = serde_json::to_string(&structure).unwrap();
        assert!(json.contains("test-doc"));
        assert!(json.contains("Chapter 1"));

        let parsed: DocumentStructure = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.doc_name, "test-doc");
    }
}
