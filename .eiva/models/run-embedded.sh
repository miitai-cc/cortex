/opt/homebrew/bin/llama-server \
  --model /Volumes/workspace/ai/application/cortex/.eiva/models/multilingual-e5-small.gguf \
  --port 18321 --host 0.0.0.0 -fit on --embeddings --override-kv tokenizer.ggml.token_type_count=int:2
