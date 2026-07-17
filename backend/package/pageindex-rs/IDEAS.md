# Ideas

Notes on external projects and potential product directions for PageIndex.

## Shortlist

Focused on retrieval, indexing, or hybrid ideas that map to PageIndex.

| Repo                                       | Why it might be interesting                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| [LEANN](#leann)                            | 97% storage savings via on-demand embedding recomputation and graph pruning. |
| [mgrep](#mgrep)                            | CLI-native semantic grep with background sync and agent integrations.        |
| [LightRAG](#lightrag)                      | Multiple retrieval modes with knowledge graph integration.                   |
| [infinity](#infinity)                      | Hybrid search engine with pluggable fusion scoring (RRF, weighted sum).      |
| [automem](#automem)                        | Graph + vector memory with 9-component weighted recall signals.              |
| [FalkorDB](#falkordb)                      | GraphBLAS-based graph DB for multi-hop RAG traversals.                       |
| [qdrant](#qdrant)                          | Production vector DB with strong filtering and hybrid patterns.              |
| [milvus](#milvus)                          | Scalable ANN vector store for performance baselines.                         |
| [Quivr](#quivr)                            | End-to-end RAG app with pluggable vector backends and Megaparse.             |
| [khoj](#khoj)                              | "Second brain" app with multi-client unified knowledge access.               |
| [VectifyAI/PageIndex](#pageindex-upstream) | Original vectorless approach; track deltas vs upstream.                      |

---

## LEANN

[GitHub: yichuan-w/LEANN](https://github.com/yichuan-w/LEANN)

LEANN positions itself as a vector database that dramatically reduces storage by
computing embeddings on-demand and pruning the graph while preserving
high-degree nodes. It emphasizes local-first privacy and claims no accuracy loss
at much smaller index sizes.

**Ideas to explore:**

- **High-Degree Preserving Graph Pruning**: Retain only the top 2% of "hub"
  nodes as anchors for navigation while pruning edges. In hierarchical document
  indexing, identify sections that frequently lead to relevant results and
  prioritize their retention.
- **On-Demand Embedding Recomputation**: Store a compact proximity graph (4 GB
  instead of 188 GB) and recompute embeddings at query time. Trade sub-100ms
  latency for 97% storage reduction—acceptable when LLM inference dominates.
- **Two-Level Search with Product Quantization**: Use PQ for ~1.4× speedup via
  approximate filtering before full distance computation.
- **Dynamic Batching for GPU Utilization**: Batch embedding computations for
  ~1.8× GPU utilization gains during on-the-fly recomputation.
- **Disk-Friendly Index Formats**: LEANN references HNSW/DiskANN backends with
  portable, low-footprint storage suitable for local-first deployments.

---

## mgrep

[GitHub: mixedbread-ai/mgrep](https://github.com/mixedbread-ai/mgrep)

mgrep is a CLI-native semantic search tool that complements grep rather than
replacing it. It emphasizes natural-language search, background indexing, and
agent-friendly workflows.

**Ideas to explore:**

- **Background File Sync Loop**: Persistent `watch` process continuously indexes
  file changes with proactive token refresh (every 5 min before 15-min expiry).
  Decouples indexing from search for low-latency queries.
- **Multi-Modal Chunk Abstraction**: Discriminated unions for text, image,
  audio, video chunks with unified search interface. Store metadata (path, hash,
  mtime) for cache invalidation.
- **CLI-Native Agent Integration via MCP**: Plugin marketplace for Claude Code,
  MCP protocol for Codex, config-file registration for OpenCode. Unified tool
  format that adapts to agent runtime.
- **Dry-Run + Quota Awareness**: `--dry-run` validation before indexing with
  specific error types (`MaxFileCountExceededError`). Progress callbacks for
  real-time agent feedback.
- **Git-Integrated FileSystem Abstraction**: `.mgrepignore` overrides
  `.gitignore`, delta sync via xxhash, external file IDs for efficient updates.

---

## LightRAG

[GitHub: HKUDS/LightRAG](https://github.com/HKUDS/LightRAG)

LightRAG is a "light" RAG framework with multiple retrieval modes and knowledge
graph integration for staged retrieval strategies.

**Ideas to explore:**

- **Multiple Retrieval Modes**: `naive`, `local`, `global`, and `hybrid` modes
  for different query types. Local focuses on entity neighborhoods, global on
  high-level summaries.
- **Knowledge Graph Extraction**: Automatic entity and relationship extraction
  from documents to build a property graph alongside text chunks.
- **Token-Budgeted Context Building**: Progressive context assembly that
  respects token limits, prioritizing high-relevance nodes.
- **Multi-Tenant Workspace Isolation**: Separate graph instances per workspace
  with independent indexing and search.
- **Ollama-Compatible API**: WebUI with chat interface that simulates an Ollama
  model, enabling integration with existing AI tools.

---

## infinity

[GitHub: infiniflow/infinity](https://github.com/infiniflow/infinity)

Infinity is a hybrid search engine supporting dense, sparse, full-text, and
multi-vector search with pluggable scoring mechanisms.

**Ideas to explore:**

- **Pluggable Normalization for Score Fusion**: Multiple methods (`kNone`,
  `kAtan`, `kMinMax`, `kL2`) to normalize scores before RRF/weighted-sum fusion.
  Critical for combining dense similarity with sparse BM25 scores.
- **Multi-Method Fusion Operators**: RRF, weighted_sum, and max operators with
  configurable `rank_constant` (default 60) and `window_size` for candidate
  limiting.
- **Multi-Vector (Tensor) Search**: `MatchTensorExpr` enables MaxSim scoring
  across multiple embeddings per document, representing different semantic
  aspects.
- **Cost-Aware Query Optimization**: Evaluate selectivity per modality and
  early-terminate branches with diminishing returns.
- **Expression-Level Field Weights**: Per-term/phrase weights in BM25 plus field
  boosts (e.g., `body^5`) combined with per-modality fusion weights.

---

## automem

[GitHub: verygoodplugins/automem](https://github.com/verygoodplugins/automem)

AutoMem is a Flask-based memory service using FalkorDB for graph storage and
Qdrant for vector search, with neuroscience-inspired consolidation cycles.

**Ideas to explore:**

- **9-Component Hybrid Scoring**: Vector similarity (25%) + keyword TF-IDF (15%)
  - graph relationship strength (25%) + direct token overlap (25%) + temporal
    alignment (15%) + tag matching (10%) + importance (5%) + confidence (5%) +
    recency (10%). Equal weight to structure and semantics.
- **Multi-Hop Bridge Discovery**: Traverse relationships to find connecting
  "bridge" memories. Tunable `expand_relations`, `relation_limit` (depth), and
  `expansion_limit` (breadth).
- **11 Typed Relationship Edges**: `LEADS_TO` (causal), `PRECEDED_BY`
  (temporal), `PREFERS_OVER` (preference), `EXEMPLIFIES` (pattern),
  `CONTRADICTS` (conflicting). Each edge carries strength, context, reason
  metadata.
- **Consolidation Cycles**: Decay (daily exponential relevance), Creative
  (weekly "REM-like" connection discovery), Clustering (monthly semantic
  grouping), Forget (optional archival).
- **Entity-Aware Multi-Hop Expansion**: Extract entities (people, orgs, tools)
  as tags (`entity:people:amanda`), bridge property graph with semantic search.

---

## FalkorDB

[GitHub: FalkorDB/FalkorDB](https://github.com/FalkorDB/FalkorDB)

FalkorDB is a high-performance, in-memory property graph database using
GraphBLAS sparse matrices for linear algebra-powered traversals.

**Ideas to explore:**

- **GraphBLAS Matrix Traversal**: Represent adjacency as sparse matrices,
  perform multi-hop queries via matrix multiplication (`F² = F × F` for
  friends-of-friends). Sub-millisecond latency without pointer-chasing.
- **Hybrid Retrieval Pipeline**: Vector indexing (HNSW), BM25 full-text, and
  property graph traversal in a single query. "Tri-modal" RAG.
- **Dynamic Graph Compression**: Label propagation and community detection
  compress communities into "super-nodes" for hierarchical context windows.
- **Property Graph for Document Metadata**: Nodes with `embedding`,
  `confidence`, `source_document`, `section_hierarchy` properties; edges for
  semantic, structural, and metadata relationships.
- **Low-Latency Distributed Indexing**: Sparse matrix representation enables
  real-time ingestion without batch reprocessing.

---

## qdrant

[GitHub: qdrant/qdrant](https://github.com/qdrant/qdrant)

Qdrant is a production vector database with strong filtering, payloads, and
hybrid retrieval patterns.

**Ideas to explore:**

- **Payload Filtering**: Attach structured metadata to vectors, filter during
  search without post-filtering penalty.
- **Sparse Vector Support**: Native BM25-style sparse vectors alongside dense,
  with configurable fusion.
- **Collection Aliases**: Zero-downtime index migrations via alias swapping.
- **Quantization Options**: Scalar and product quantization for memory-latency
  tradeoffs.
- **Multi-Tenancy via Namespaces**: Logical isolation within a single cluster.

---

## milvus

[GitHub: milvus-io/milvus](https://github.com/milvus-io/milvus)

Milvus is a scalable ANN vector store useful for performance baselines against
vectorless approaches.

**Ideas to explore:**

- **Distributed Architecture**: Separation of compute (query/index nodes) and
  storage (object store) for independent scaling.
- **Index Type Zoo**: HNSW, IVF_FLAT, IVF_PQ, DISKANN, GPU_IVF_FLAT for
  workload-specific tradeoffs.
- **Dynamic Schema**: Add fields without reindexing existing data.
- **Benchmark Suite**: Standard datasets and metrics for comparing retrieval
  quality and latency.

---

## Quivr

[GitHub: QuivrHQ/quivr](https://github.com/QuivrHQ/quivr)

Quivr is an opinionated RAG framework with pluggable vector backends, Megaparse
document parsing, and declarative workflow configuration.

**Ideas to explore:**

- **Pluggable Vector Backend Abstraction**: Clean interface supporting PGVector
  (relational + vectors), Faiss (fast similarity). Seamless backend switching
  without app code changes.
- **Megaparse Modular Parsing**: Composable blocks for header/footer detection,
  table extraction, image handling, intelligent chunking. "No information loss"
  philosophy.
- **Knowledge Base as First-Class Primitive ("Brains")**: Multi-tenant knowledge
  spaces with content sharing/linking via KMS. Query across multiple brains.
- **Declarative LangGraph Workflows**: Stateful graph (START → filter_history →
  rewrite → retrieve → generate_rag → END) with configurable, swappable nodes.
  A/B testing retrieval strategies.
- **Dual-Mode UX**: Chat-centric homepage with drag-drop knowledge upload and @
  mentions for brain selection.

---

## khoj

[GitHub: khoj-ai/khoj](https://github.com/khoj-ai/khoj)

Khoj is a "second brain" application spanning web, desktop, mobile, Obsidian,
and Emacs with unified knowledge access.

**Ideas to explore:**

- **Agent-as-Personalized-Interface**: Custom agents with tunable persona, style
  icons/colors, scoped knowledge bases, and privacy levels (public/private).
  Non-technical users can create domain-specific AI assistants.
- **Multi-Modal Content Synthesis**: Index org-mode, markdown, PDFs, images,
  plaintext, plus web search. Research mode iterates across document searches,
  web searches, and reasoning steps.
- **Research Mode as Extended Thinking**: `/research` command triggers
  multi-iteration workflow for deep, comprehensive answers. Package as "research
  assistant" for professionals.
- **Conversational Memory Scoping**: Conversation history, memories, and context
  structured by user + agent pairing. Memory settings tunable per agent.
- **Multi-Client Unified Access**: Web, Emacs, Obsidian plugin, Desktop, mobile
  all hit the same backend. Index vault in Obsidian, search via web.

---

## PageIndex Upstream

[GitHub: VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex)

The original vectorless PageIndex approach. Track deltas and new ideas from
upstream.

**Ideas to explore:**

- **LLM-Based Structure Detection**: Use LLM reasoning to identify TOC, extract
  hierarchical structure, and verify against actual content.
- **Agentic Tree Navigation**: LLM navigates document tree structure using
  symbolic traversal rather than vector similarity. Interpretable, auditable
  retrieval paths.
- **No Vector Database Required**: Tree-structured indexes enable reasoning
  without embedding storage. Dynamic chunk selection based on query context.
- **Context-Aware Extraction**: Simulate how human experts navigate complex
  documents, preserving structure and relationships.
- **Summarization Per Section**: Optional summary generation for each node,
  enabling progressive disclosure and token-budget-aware retrieval.

---

## Hybrid Directions: Vectorless + Vector

Potential designs that combine symbolic structure with semantic retrieval:

- **Dual-Stage Retrieval**: (1) Structural candidate selection by TOC/headings,
  (2) semantic rerank within candidates. Tree-first for precision, vector for
  recall.
- **Lazy Embeddings**: Generate embeddings only for candidate subsets per query
  or per document. Cache hot paths, expire cold ones.
- **Semantic Grep**: Natural language search over headings and summaries first,
  then optionally expand to full text. Structure as coarse filter.
- **Hybrid Index**: Store TOC/tree + lightweight lexical index + optional vector
  cache. Per-query tradeoffs between fast/cheap and deep/accurate.
- **Graph-Augmented RAG**: Knowledge graph edges (entity relationships) plus
  document hierarchy edges. Multi-hop queries traverse both.

---

## Open Questions

- What is the minimal vector footprint needed to achieve high recall when
  combined with PageIndex's structural tree?
- Where should we place the cut-off between structure-only and vectorized
  retrieval (per doc, per node, or per query)?
- Can consolidation cycles (decay, creative, clustering) improve vectorless
  retrieval over time?
- How do we handle documents without clear hierarchical structure (e.g.,
  transcripts, chat logs)?
- What's the optimal balance between LLM reasoning steps and cached index
  lookups for latency-sensitive applications?
