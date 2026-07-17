//! PageIndex CLI
//!
//! Command-line interface for indexing and querying documents.

use anyhow::Result;
use clap::{Parser, Subcommand};
use console::style;
use indicatif::{ProgressBar, ProgressStyle};
use pageindex_core::{page_index, Config};
use pageindex_llm::{OpenAIClient, RetryingClient};
use pageindex_store::{DocumentMetadata, DocumentStore, JsonStore, SqliteStore};
use std::path::PathBuf;
use std::time::SystemTime;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(name = "pageindex")]
#[command(about = "A vectorless, reasoning-based RAG document indexer", long_about = None)]
#[command(version)]
struct Cli {
    /// Increase verbosity
    #[arg(short, long, action = clap::ArgAction::Count)]
    verbose: u8,

    /// Storage backend (sqlite or json). JSON is for testing only.
    #[arg(long, value_enum, default_value_t = StoreBackend::Sqlite)]
    store: StoreBackend,

    #[command(subcommand)]
    command: Commands,
}

#[derive(clap::ValueEnum, Clone, Debug)]
enum StoreBackend {
    Sqlite,
    Json,
}

#[derive(Subcommand)]
enum Commands {
    /// Index a PDF or Markdown file
    Index {
        /// Path to the document
        path: PathBuf,

        /// LLM model to use
        #[arg(short, long, default_value = "gpt-4o-2024-11-20")]
        model: String,

        /// Add text content to nodes
        #[arg(long)]
        with_text: bool,

        /// Add summaries to nodes
        #[arg(long, default_value = "true")]
        with_summary: bool,

        /// Add document description
        #[arg(long)]
        with_description: bool,

        /// Output format (json, pretty)
        #[arg(short, long, default_value = "pretty")]
        output: String,
    },

    /// Search indexed documents
    Query {
        /// Search query
        query: String,

        /// Maximum results to show
        #[arg(short = 'n', long, default_value = "10")]
        limit: usize,
    },

    /// List all indexed documents
    List {
        /// Show detailed information
        #[arg(short, long)]
        detailed: bool,
    },

    /// Watch a directory for changes
    Watch {
        /// Directory to watch
        path: PathBuf,

        /// Model to use for indexing
        #[arg(short, long, default_value = "gpt-4o-2024-11-20")]
        model: String,
    },

    /// Export document structure
    Export {
        /// Document ID or name
        doc: String,

        /// Output format (json, markdown)
        #[arg(short, long, default_value = "json")]
        format: String,

        /// Output file (stdout if not specified)
        #[arg(short, long)]
        output: Option<PathBuf>,
    },

    /// Refresh stale documents
    Refresh {
        /// Refresh all documents
        #[arg(long)]
        all: bool,

        /// Specific document ID
        doc: Option<String>,

        /// Model to use
        #[arg(short, long, default_value = "gpt-4o-2024-11-20")]
        model: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    // Load environment variables
    let _ = dotenvy::dotenv();

    let cli = Cli::parse();

    // Set up logging
    let filter = match cli.verbose {
        0 => "warn",
        1 => "info",
        2 => "debug",
        _ => "trace",
    };

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(filter)),
        )
        .init();

    match cli.command {
        Commands::Index {
            path,
            model,
            with_text,
            with_summary,
            with_description,
            output,
        } => {
            cmd_index(
                path,
                model,
                with_text,
                with_summary,
                with_description,
                output,
                cli.store.clone(),
            )
            .await
        }
        Commands::Query { query, limit } => cmd_query(query, limit, cli.store.clone()).await,
        Commands::List { detailed } => cmd_list(detailed, cli.store.clone()).await,
        Commands::Watch { path, model } => cmd_watch(path, model).await,
        Commands::Export {
            doc,
            format,
            output,
        } => cmd_export(doc, format, output, cli.store.clone()).await,
        Commands::Refresh { all, doc, model } => cmd_refresh(all, doc, model, cli.store.clone()).await,
    }
}

async fn cmd_index(
    path: PathBuf,
    model: String,
    with_text: bool,
    with_summary: bool,
    with_description: bool,
    output: String,
    store_backend: StoreBackend,
) -> Result<()> {
    // Verify file exists
    if !path.exists() {
        eprintln!(
            "{} File not found: {}",
            style("Error:").red().bold(),
            path.display()
        );
        std::process::exit(1);
    }

    println!("{} {}", style("Indexing:").green().bold(), path.display());

    // Create config
    let config = Config::new()
        .with_model(&model)
        .with_node_text(with_text)
        .with_node_summary(with_summary)
        .with_doc_description(with_description);

    // Create LLM client
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| anyhow::anyhow!("OPENAI_API_KEY environment variable not set"))?;

    let client = RetryingClient::with_defaults(OpenAIClient::new(api_key, &model));

    // Create progress bar
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.green} {msg}")
            .unwrap(),
    );
    pb.set_message("Processing document...");
    pb.enable_steady_tick(std::time::Duration::from_millis(100));

    // Index the document
    let result = page_index(&path, &client, &config).await?;

    pb.finish_with_message("Done!");

    // Output result
    match output.as_str() {
        "json" => {
            println!("{}", serde_json::to_string(&result)?);
        }
        _ => {
            println!("\n{}", style("Document Structure:").cyan().bold());
            println!("  Name: {}", result.doc_name);
            if let Some(ref desc) = result.doc_description {
                println!("  Description: {}", desc);
            }
            println!("  Sections: {}", result.structure.len());
            println!("  Total nodes: {}", result.node_count());

            println!("\n{}", style("Table of Contents:").cyan().bold());
            print_toc(&result.structure, 0);
        }
    }

    // Save to store
    let store = open_store(store_backend)?;
    let metadata = DocumentMetadata {
        source_path: Some(path.canonicalize()?),
        source_mtime: std::fs::metadata(&path)?.modified().ok(),
        source_size: Some(std::fs::metadata(&path)?.len()),
        content_hash: "".to_string(), // Will be computed by store
        indexed_at: SystemTime::now(),
        config_hash: None,
    };

    let id = store.save(&result, metadata).await?;
    println!(
        "\n{} Document saved with ID: {}",
        style("Stored:").green().bold(),
        id
    );

    Ok(())
}

fn print_toc(nodes: &[pageindex_core::DocumentNode], indent: usize) {
    for node in nodes {
        let prefix = "  ".repeat(indent + 1);
        let id = node.node_id.as_deref().unwrap_or("");
        println!("{}[{}] {}", prefix, id, node.title);
        if !node.nodes.is_empty() {
            print_toc(&node.nodes, indent + 1);
        }
    }
}

async fn cmd_query(query: String, limit: usize, store_backend: StoreBackend) -> Result<()> {
    let store = open_store(store_backend)?;
    let results = store.search(&query).await?;

    if results.is_empty() {
        println!("No results found for: {}", query);
        return Ok(());
    }

    println!("{} results for \"{}\":\n", results.len().min(limit), query);

    for (i, result) in results.iter().take(limit).enumerate() {
        println!(
            "{}. {} {}",
            i + 1,
            style(&result.document_name).cyan().bold(),
            style(format!("({})", result.document_id)).dim()
        );

        if let Some(ref title) = result.node_title {
            println!("   Section: {}", title);
        }

        if let Some(ref snippet) = result.snippet {
            let truncated: String = snippet.chars().take(100).collect();
            println!("   {}", style(truncated).dim());
        }

        println!();
    }

    Ok(())
}

async fn cmd_list(detailed: bool, store_backend: StoreBackend) -> Result<()> {
    let store = open_store(store_backend)?;
    let docs = store.list().await?;

    if docs.is_empty() {
        println!("No indexed documents found.");
        return Ok(());
    }

    println!("{} indexed documents:\n", docs.len());

    for doc in docs {
        let stale_marker = if doc.is_stale {
            style(" [STALE]").yellow().to_string()
        } else {
            String::new()
        };

        println!(
            "  {} {}{}",
            style(&doc.id[..8]).cyan(),
            doc.name,
            stale_marker
        );

        if detailed {
            if let Some(ref path) = doc.source_path {
                println!("    Source: {}", path.display());
            }
            println!("    Nodes: {}", doc.node_count);
            println!();
        }
    }

    Ok(())
}

async fn cmd_watch(path: PathBuf, _model: String) -> Result<()> {
    use pageindex_store::FileWatcher;

    if !path.is_dir() {
        eprintln!(
            "{} Not a directory: {}",
            style("Error:").red().bold(),
            path.display()
        );
        std::process::exit(1);
    }

    println!("{} {}", style("Watching:").green().bold(), path.display());
    println!("Press Ctrl+C to stop.\n");

    let mut watcher = FileWatcher::with_defaults()?;
    watcher.watch(&path)?;

    loop {
        let events = watcher.wait();

        for event in events {
            match event {
                pageindex_store::WatchEvent::Modified(p)
                | pageindex_store::WatchEvent::Created(p) => {
                    println!("{} {}", style("Changed:").yellow(), p.display());
                    // TODO: Re-index the file
                }
                pageindex_store::WatchEvent::Deleted(p) => {
                    println!("{} {}", style("Deleted:").red(), p.display());
                }
                pageindex_store::WatchEvent::Error(e) => {
                    eprintln!("{} {}", style("Error:").red(), e);
                }
                _ => {}
            }
        }
    }
}

async fn cmd_export(
    doc: String,
    format: String,
    output: Option<PathBuf>,
    store_backend: StoreBackend,
) -> Result<()> {
    let store = open_store(store_backend)?;

    // Try to find document by ID or name
    let doc_structure = if let Ok(Some(structure)) = store.get(&doc).await {
        structure
    } else {
        // Search by name
        let results = store.search(&doc).await?;
        if results.is_empty() {
            eprintln!(
                "{} Document not found: {}",
                style("Error:").red().bold(),
                doc
            );
            std::process::exit(1);
        }
        store.get(&results[0].document_id).await?.unwrap()
    };

    let content = match format.as_str() {
        "json" => serde_json::to_string_pretty(&doc_structure)?,
        "markdown" => {
            let mut md = format!("# {}\n\n", doc_structure.doc_name);
            if let Some(ref desc) = doc_structure.doc_description {
                md.push_str(&format!("{}\n\n", desc));
            }
            md.push_str("## Table of Contents\n\n");
            export_toc_markdown(&doc_structure.structure, &mut md, 0);
            md
        }
        _ => {
            eprintln!(
                "{} Unknown format: {}",
                style("Error:").red().bold(),
                format
            );
            std::process::exit(1);
        }
    };

    match output {
        Some(path) => {
            std::fs::write(&path, &content)?;
            println!("Exported to: {}", path.display());
        }
        None => {
            println!("{}", content);
        }
    }

    Ok(())
}

fn export_toc_markdown(nodes: &[pageindex_core::DocumentNode], md: &mut String, level: usize) {
    for node in nodes {
        let indent = "  ".repeat(level);
        md.push_str(&format!("{}- {}\n", indent, node.title));
        if !node.nodes.is_empty() {
            export_toc_markdown(&node.nodes, md, level + 1);
        }
    }
}

async fn cmd_refresh(
    all: bool,
    doc: Option<String>,
    _model: String,
    store_backend: StoreBackend,
) -> Result<()> {
    let store = open_store(store_backend)?;

    if all {
        let stale = store.list_stale().await?;
        if stale.is_empty() {
            println!("No stale documents found.");
            return Ok(());
        }

        println!("Found {} stale documents:", stale.len());
        for (id, reason) in &stale {
            println!("  {} - {:?}", &id[..8], reason);
        }

        // TODO: Re-index stale documents
        println!("\nRefresh not yet implemented.");
    } else if let Some(doc_id) = doc {
        if let Some(reason) = store.check_stale(&doc_id).await? {
            println!("Document {} is stale: {:?}", doc_id, reason);
            // TODO: Re-index
            println!("Refresh not yet implemented.");
        } else {
            println!("Document {} is up to date.", doc_id);
        }
    } else {
        eprintln!("Specify --all or a document ID");
        std::process::exit(1);
    }

    Ok(())
}

fn open_store(backend: StoreBackend) -> Result<Box<dyn DocumentStore>> {
    match backend {
        StoreBackend::Sqlite => Ok(Box::new(SqliteStore::default_location()?)),
        StoreBackend::Json => Ok(Box::new(JsonStore::default_location()?)),
    }
}
