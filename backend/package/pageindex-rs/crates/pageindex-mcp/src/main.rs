//! PageIndex MCP Server
//!
//! Model Context Protocol server for AI assistant integration.
//! Provides tools for indexing, searching, and retrieving document content.

use anyhow::Result;
use pageindex_core::{Config, DocumentNode};
use pageindex_store::{DocumentMetadata, DocumentStore, SqliteStore};
use rmcp::{
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::{CallToolResult, Content, ServerCapabilities, ServerInfo},
    schemars::{self, JsonSchema},
    tool, tool_handler, tool_router,
    transport::stdio,
    ErrorData as McpError, ServerHandler, ServiceExt,
};
use serde::Deserialize;
use std::sync::Arc;
use tracing_subscriber::EnvFilter;

/// MCP Server state
#[derive(Clone)]
struct PageIndexServer {
    store: Arc<SqliteStore>,
    model: String,
    tool_router: ToolRouter<Self>,
}

// Tool input schemas

#[derive(Debug, Deserialize, JsonSchema)]
struct IndexDocumentInput {
    /// Path to the PDF or Markdown file
    path: String,
    /// Whether to include text content in nodes
    #[serde(default)]
    with_text: bool,
    /// Whether to generate summaries
    #[serde(default = "default_true")]
    with_summary: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize, JsonSchema)]
struct SearchDocumentsInput {
    /// Search query
    query: String,
    /// Maximum results
    #[serde(default = "default_limit")]
    limit: usize,
}

fn default_limit() -> usize {
    10
}

#[derive(Debug, Deserialize, JsonSchema)]
struct GetSectionInput {
    /// Document ID
    document_id: String,
    /// Node ID within the document
    node_id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct GetTocInput {
    /// Document ID
    document_id: String,
}

#[tool_router]
impl PageIndexServer {
    #[tool(description = "Index a PDF or Markdown file to extract its structure")]
    async fn index_document(
        &self,
        Parameters(input): Parameters<IndexDocumentInput>,
    ) -> Result<CallToolResult, McpError> {
        use pageindex_core::page_index;
        use pageindex_llm::{OpenAIClient, RetryingClient};
        use std::path::PathBuf;
        use std::time::SystemTime;

        let path = PathBuf::from(&input.path);

        if !path.exists() {
            return Ok(CallToolResult::error(vec![Content::text(format!(
                "File not found: {}",
                input.path
            ))]));
        }

        // Create config
        let config = Config::new()
            .with_model(&self.model)
            .with_node_text(input.with_text)
            .with_node_summary(input.with_summary);

        // Create LLM client
        let api_key = std::env::var("OPENAI_API_KEY")
            .map_err(|_| McpError::internal_error("OPENAI_API_KEY not set", None))?;

        let client = RetryingClient::with_defaults(OpenAIClient::new(api_key, &self.model));

        // Index document
        let result = page_index(&path, &client, &config)
            .await
            .map_err(|e| McpError::internal_error(e.to_string(), None))?;

        // Save to store
        let metadata = DocumentMetadata {
            source_path: Some(path.canonicalize().unwrap_or(path)),
            source_mtime: std::fs::metadata(&input.path)
                .ok()
                .and_then(|m| m.modified().ok()),
            source_size: std::fs::metadata(&input.path).ok().map(|m| m.len()),
            content_hash: String::new(),
            indexed_at: SystemTime::now(),
            config_hash: None,
        };

        let id = self
            .store
            .save(&result, metadata)
            .await
            .map_err(|e| McpError::internal_error(e.to_string(), None))?;

        let response = format!(
            "Indexed document '{}' with {} sections and {} total nodes. Document ID: {}",
            result.doc_name,
            result.structure.len(),
            result.node_count(),
            id
        );

        Ok(CallToolResult::success(vec![Content::text(response)]))
    }

    #[tool(description = "Search indexed documents by title or content")]
    async fn search_documents(
        &self,
        Parameters(input): Parameters<SearchDocumentsInput>,
    ) -> Result<CallToolResult, McpError> {
        let results = self
            .store
            .search(&input.query)
            .await
            .map_err(|e| McpError::internal_error(e.to_string(), None))?;

        if results.is_empty() {
            return Ok(CallToolResult::success(vec![Content::text(format!(
                "No results found for: {}",
                input.query
            ))]));
        }

        let mut response = format!("Found {} results:\n\n", results.len().min(input.limit));

        for (i, result) in results.iter().take(input.limit).enumerate() {
            response.push_str(&format!(
                "{}. {} (ID: {})\n",
                i + 1,
                result.document_name,
                result.document_id
            ));

            if let Some(ref title) = result.node_title {
                response.push_str(&format!(
                    "   Section: {} (Node: {})\n",
                    title,
                    result.node_id.as_deref().unwrap_or("?")
                ));
            }

            if let Some(ref snippet) = result.snippet {
                let truncated: String = snippet.chars().take(100).collect();
                response.push_str(&format!("   {}\n", truncated));
            }
            response.push('\n');
        }

        Ok(CallToolResult::success(vec![Content::text(response)]))
    }

    #[tool(description = "Get the content of a specific section by node ID")]
    async fn get_section(
        &self,
        Parameters(input): Parameters<GetSectionInput>,
    ) -> Result<CallToolResult, McpError> {
        let doc = self
            .store
            .get(&input.document_id)
            .await
            .map_err(|e| McpError::internal_error(e.to_string(), None))?
            .ok_or_else(|| {
                McpError::invalid_params(format!("Document not found: {}", input.document_id), None)
            })?;

        let node = doc.find_by_id(&input.node_id).ok_or_else(|| {
            McpError::invalid_params(format!("Node not found: {}", input.node_id), None)
        })?;

        let mut response = format!("# {}\n\n", node.title);

        if let Some(ref summary) = node.summary {
            response.push_str(&format!("**Summary:** {}\n\n", summary));
        }

        if let Some(ref text) = node.text {
            response.push_str(&format!("**Content:**\n{}\n", text));
        }

        if !node.nodes.is_empty() {
            response.push_str("\n**Subsections:**\n");
            for child in &node.nodes {
                response.push_str(&format!(
                    "- {} (Node: {})\n",
                    child.title,
                    child.node_id.as_deref().unwrap_or("?")
                ));
            }
        }

        Ok(CallToolResult::success(vec![Content::text(response)]))
    }

    #[tool(description = "Get the table of contents for a document")]
    async fn get_toc(
        &self,
        Parameters(input): Parameters<GetTocInput>,
    ) -> Result<CallToolResult, McpError> {
        let doc = self
            .store
            .get(&input.document_id)
            .await
            .map_err(|e| McpError::internal_error(e.to_string(), None))?
            .ok_or_else(|| {
                McpError::invalid_params(format!("Document not found: {}", input.document_id), None)
            })?;

        let mut response = format!("# Table of Contents: {}\n\n", doc.doc_name);

        if let Some(ref desc) = doc.doc_description {
            response.push_str(&format!("{}\n\n", desc));
        }

        fn format_toc(nodes: &[DocumentNode], depth: usize, response: &mut String) {
            for node in nodes {
                let indent = "  ".repeat(depth);
                let id = node.node_id.as_deref().unwrap_or("?");
                response.push_str(&format!("{}- [{}] {}\n", indent, id, node.title));
                if !node.nodes.is_empty() {
                    format_toc(&node.nodes, depth + 1, response);
                }
            }
        }

        format_toc(&doc.structure, 0, &mut response);

        Ok(CallToolResult::success(vec![Content::text(response)]))
    }

    #[tool(description = "List all indexed documents")]
    async fn list_documents(&self) -> Result<CallToolResult, McpError> {
        let docs = self
            .store
            .list()
            .await
            .map_err(|e| McpError::internal_error(e.to_string(), None))?;

        if docs.is_empty() {
            return Ok(CallToolResult::success(vec![Content::text(
                "No indexed documents found.".to_string(),
            )]));
        }

        let mut response = format!("Indexed documents ({}):\n\n", docs.len());

        for doc in docs {
            let stale = if doc.is_stale { " [STALE]" } else { "" };
            response.push_str(&format!(
                "- {} (ID: {}){}\n  Nodes: {}\n",
                doc.name, doc.id, stale, doc.node_count
            ));

            if let Some(ref path) = doc.source_path {
                response.push_str(&format!("  Source: {}\n", path.display()));
            }
            response.push('\n');
        }

        Ok(CallToolResult::success(vec![Content::text(response)]))
    }
}

impl PageIndexServer {
    fn new(store: SqliteStore, model: String) -> Self {
        Self {
            store: Arc::new(store),
            model,
            tool_router: Self::tool_router(),
        }
    }
}

#[tool_handler]
impl ServerHandler for PageIndexServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            instructions: Some(
                "PageIndex MCP server for indexing and searching PDF/Markdown documents. \
                 Use index_document to add documents, search_documents to find content, \
                 get_toc for structure, and get_section for specific content."
                    .to_string(),
            ),
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            ..Default::default()
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Load environment variables
    let _ = dotenvy::dotenv();

    // Set up logging to stderr (stdout is for MCP communication)
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("pageindex=info".parse()?))
        .with_writer(std::io::stderr)
        .init();

    tracing::info!("Starting PageIndex MCP Server");

    // Create store
    let store = SqliteStore::default_location()?;

    // Get model from environment or use default
    let model =
        std::env::var("PAGEINDEX_MODEL").unwrap_or_else(|_| "gpt-4o-2024-11-20".to_string());

    // Create server
    let server = PageIndexServer::new(store, model);

    // Run with stdio transport
    let service = server.serve(stdio()).await.inspect_err(|e| {
        tracing::error!("serving error: {:?}", e);
    })?;

    service.waiting().await?;

    Ok(())
}
