# pageindex-llm

LLM provider implementations for PageIndex.

## Overview

This crate provides implementations of the `LlmClient` trait from
`pageindex-core` for various LLM providers. The trait-based design makes it easy
to swap providers or add new ones.

## Supported Providers

| Provider                  | Feature Flag | Status      |
| ------------------------- | ------------ | ----------- |
| [OpenAI][openai]          | `openai`     | Implemented |
| [Anthropic][anthropic]    | `anthropic`  | Stub        |
| [Gemini][gemini]          | `gemini`     | Stub        |
| [Groq][groq]              | `groq`       | Stub        |
| [Azure OpenAI][azure]     | `azure`      | Stub        |
| [Together AI][together]   | `together`   | Planned     |
| [Fireworks AI][fireworks] | `fireworks`  | Planned     |
| [Cerebras][cerebras]      | `cerebras`   | Planned     |
| [DeepInfra][deepinfra]    | `deepinfra`  | Planned     |
| [Replicate][replicate]    | `replicate`  | Planned     |
| [Baseten][baseten]        | `baseten`    | Planned     |
| [xAI][xai]                | `xai`        | Planned     |
| [Nebius][nebius]          | `nebius`     | Planned     |
| [Mistral AI][mistral]     | `mistral`    | Planned     |
| [Cohere][cohere]          | `cohere`     | Planned     |
| [Ollama][ollama]          | `ollama`     | Stub        |
| Mock (testing)            | `mock`       | Implemented |

[openai]: https://platform.openai.com
[anthropic]: https://www.anthropic.com
[gemini]: https://ai.google.dev
[groq]: https://groq.com
[azure]: https://azure.microsoft.com/en-us/products/ai-services/openai-service
[together]: https://www.together.ai
[fireworks]: https://fireworks.ai
[cerebras]: https://cerebras.ai
[deepinfra]: https://deepinfra.com
[replicate]: https://replicate.com
[baseten]: https://www.baseten.co
[xai]: https://x.ai
[nebius]: https://nebius.com
[mistral]: https://mistral.ai
[cohere]: https://cohere.com
[ollama]: https://ollama.com

## Usage

```rust
use pageindex_llm::{OpenAIClient, RetryingClient};

// Create an OpenAI client
let api_key = std::env::var("OPENAI_API_KEY")?;
let client = OpenAIClient::new(api_key, "gpt-4o");

// Wrap with retry logic
let client = RetryingClient::with_defaults(client);

// Use with pageindex-core
let structure = pageindex_core::page_index("doc.pdf", &client, &config).await?;
```

## Features

Enable providers via feature flags:

```toml
[dependencies]
pageindex-llm = { version = "0.1", features = ["openai", "anthropic"] }
```

Or enable all:

```toml
pageindex-llm = { version = "0.1", features = ["all"] }
```

## Retry Logic

The `RetryingClient` wrapper provides automatic retry with exponential backoff
for transient failures:

```rust
use pageindex_llm::RetryingClient;

let client = RetryingClient::new(
    inner_client,
    3,    // max retries
    1000, // base delay ms
    2.0,  // backoff multiplier
);
```

## Adding New Providers

Implement the `LlmClient` trait from `pageindex-core`:

```rust
use async_trait::async_trait;
use pageindex_core::llm::{LlmClient, ChatMessage, LlmResponse, LlmError};

#[async_trait]
impl LlmClient for MyProvider {
    async fn complete(&self, messages: &[ChatMessage]) -> Result<LlmResponse, LlmError> {
        // Implementation
    }

    fn model_name(&self) -> &str {
        &self.model
    }
}
```

## License

MIT
