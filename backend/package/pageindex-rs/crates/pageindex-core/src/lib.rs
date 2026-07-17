//! PageIndex Core Library
//!
//! A vectorless, reasoning-based RAG system that builds hierarchical tree indices
//! from PDF documents using LLM reasoning instead of vector similarity.
//!
//! # Overview
//!
//! This library provides the core functionality for:
//! - Extracting text and structure from PDF documents
//! - Detecting and parsing tables of contents (TOC)
//! - Building hierarchical document trees
//! - Verifying and fixing TOC mappings
//!
//! # Example
//!
//! ```rust,ignore
//! use pageindex_core::{Config, page_index};
//!
//! let config = Config::default();
//! let result = page_index("document.pdf", config).await?;
//! ```

pub mod config;
pub mod error;
pub mod llm;
#[cfg(feature = "markdown")]
pub mod markdown;
pub mod model;
pub mod pdf;
pub mod pipeline;
pub mod toc;
pub mod tree;

pub use config::Config;
pub use error::{PageIndexError, Result};
pub use llm::{FinishReason, LlmClient};
pub use model::{DocumentNode, DocumentStructure, PageContent, TocItem};
pub use pipeline::page_index;
