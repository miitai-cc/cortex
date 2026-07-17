# pageindex-store

Document storage and synchronization for PageIndex.

## Overview

This crate provides storage backends for indexed documents, file watching for
automatic re-indexing, and staleness detection.

## Features

| Feature      | Description                                      | Default |
| ------------ | ------------------------------------------------ | ------- |
| `sqlite`     | SQLite storage (concurrent-safe, default)        | Yes     |
| `json-store` | JSON file storage (human-readable, testing only) | No      |
| `watcher`    | File system watching                             | Yes     |

## Storage Backends

### SqliteStore (Default)

Stores documents in a SQLite database in the user's data directory:

```
~/.local/share/pageindex/
└── pageindex.sqlite     # SQLite database
```

Usage:

```rust
use pageindex_store::{SqliteStore, DocumentStore, DocumentMetadata};

let store = SqliteStore::default_location()?;

// Save a document
let id = store.save(&doc_structure, metadata).await?;

// Retrieve a document
let doc = store.get(&id).await?;

// List all documents
let docs = store.list().await?;

// Search documents
let results = store.search("query").await?;
```

### JsonStore (Testing Only)

JsonStore keeps human-readable JSON files on disk, but it is intended for
single-writer/testing scenarios only. For concurrent indexing or production
usage, prefer SqliteStore.

### Migration Note

SQLite is now the default backend. If you have existing JSON data, either
reindex documents or explicitly use JsonStore to access the previous files.

## File Watching

Watch directories for PDF/Markdown changes:

```rust
use pageindex_store::FileWatcher;

let mut watcher = FileWatcher::with_defaults()?;
watcher.watch("./documents")?;

loop {
    for event in watcher.wait() {
        match event {
            WatchEvent::Modified(path) => println!("Changed: {}", path.display()),
            WatchEvent::Deleted(path) => println!("Deleted: {}", path.display()),
            _ => {}
        }
    }
}
```

## Staleness Detection

Detect when indexed documents are out of sync:

```rust
use pageindex_store::StaleReason;

// Check single document
if let Some(reason) = store.check_stale(&id).await? {
    match reason {
        StaleReason::FileModified => println!("File was modified"),
        StaleReason::FileDeleted => println!("File was deleted"),
        StaleReason::HashMismatch => println!("Content changed"),
        StaleReason::ConfigChanged => println!("Config changed"),
    }
}

// Get all stale documents
let stale = store.list_stale().await?;
```

## DocumentStore Trait

Implement custom storage backends:

```rust
use async_trait::async_trait;
use pageindex_store::{DocumentStore, DocumentMetadata, StoreResult};

#[async_trait]
impl DocumentStore for MyStore {
    async fn save(&self, doc: &DocumentStructure, metadata: DocumentMetadata) -> StoreResult<String>;
    async fn get(&self, id: &str) -> StoreResult<Option<DocumentStructure>>;
    async fn list(&self) -> StoreResult<Vec<DocumentSummary>>;
    async fn delete(&self, id: &str) -> StoreResult<()>;
    async fn search(&self, query: &str) -> StoreResult<Vec<SearchResult>>;
    // ...
}
```

## License

MIT
