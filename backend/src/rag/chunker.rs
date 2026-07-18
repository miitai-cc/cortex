pub fn chunk_text(text: &str, chunk_size: usize, overlap: usize) -> Vec<String> {
    tracing::debug!(
        "[chunk_text] 開始分塊 text_len={}, chunk_size={}, overlap={}",
        text.len(),
        chunk_size,
        overlap
    );

    if text.is_empty() {
        tracing::debug!("[chunk_text] 文字為空，回傳空向量");
        return vec![];
    }

    let mut chunks = Vec::new();
    let mut start = 0;
    let text_len = text.len();
    let mut chunk_index = 0;

    while start < text_len {
        let end = std::cmp::min(start + chunk_size, text_len);

        // Try to break at a sentence boundary
        let mut actual_end = end;
        if end < text_len {
            if let Some(break_pos) = text[end..].find(|c: char| {
                c == '.' || c == '!' || c == '?' || c == '\n' || c == '。' || c == '！' || c == '？'
            }) {
                if break_pos < 50 {
                    actual_end = end + break_pos + 1;
                }
            }
        }

        let chunk = text[start..actual_end].to_string();
        tracing::debug!(
            "[chunk_text] chunk {}: start={}, end={}, actual_end={}, len={}, 前 40 字元: {:?}",
            chunk_index,
            start,
            end,
            actual_end,
            chunk.len(),
            &chunk[..chunk.len().min(40)]
        );
        chunks.push(chunk);
        start = actual_end.saturating_sub(overlap);
        chunk_index += 1;
    }

    tracing::debug!(
        "[chunk_text] 分塊完成，共 {} 個 chunks",
        chunks.len()
    );
    chunks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chunk_text_basic() {
        let text =
            "This is a test document. It has multiple sentences. We want to chunk it properly.";
        let chunks = chunk_text(text, 20, 5);
        assert!(!chunks.is_empty());
        assert!(chunks.iter().any(|c| c.contains("test document")));
    }

    #[test]
    fn test_chunk_text_chinese() {
        let text = "這是一個測試文件。它包含多個句子。我們需要正確地進行分塊。";
        let chunks = chunk_text(text, 15, 5);
        assert!(!chunks.is_empty());
    }

    #[test]
    fn test_empty_text() {
        let chunks = chunk_text("", 100, 20);
        assert!(chunks.is_empty());
    }
}
