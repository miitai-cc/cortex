#![allow(dead_code)]
use chrono::Utc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

#[derive(Default)]
pub struct QueryMetrics {
    pub total_queries: AtomicU64,
    pub total_errors: AtomicU64,
    pub total_documents: AtomicU64,
    pub total_chunks: AtomicU64,
    pub average_latency_ms: AtomicU64,
}

impl QueryMetrics {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    pub fn increment_queries(&self) {
        self.total_queries.fetch_add(1, Ordering::Relaxed);
    }

    pub fn increment_errors(&self) {
        self.total_errors.fetch_add(1, Ordering::Relaxed);
    }

    pub fn set_document_count(&self, count: u64) {
        self.total_documents.store(count, Ordering::Relaxed);
    }

    pub fn set_chunk_count(&self, count: u64) {
        self.total_chunks.store(count, Ordering::Relaxed);
    }

    pub fn record_latency(&self, latency_ms: u64) {
        self.average_latency_ms.store(latency_ms, Ordering::Relaxed);
    }

    pub fn snapshot(&self) -> serde_json::Value {
        serde_json::json!({
            "total_queries": self.total_queries.load(Ordering::Relaxed),
            "total_errors": self.total_errors.load(Ordering::Relaxed),
            "total_documents": self.total_documents.load(Ordering::Relaxed),
            "total_chunks": self.total_chunks.load(Ordering::Relaxed),
            "average_latency_ms": self.average_latency_ms.load(Ordering::Relaxed),
            "timestamp": Utc::now().to_rfc3339(),
        })
    }
}
