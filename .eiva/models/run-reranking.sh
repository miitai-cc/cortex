/opt/homebrew/bin/llama-server \
  --model /Volumes/workspace/ai/application/cortex/.eiva/models/bge-reranker-v2-m3-FP16.gguf \
  --port 18322 --host 0.0.0.0 -fit on --reranking 
#--override-kv tokenizer.ggml.token_type_count=int:2
