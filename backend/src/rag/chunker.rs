pub fn chunk_text(text: &str, chunk_size: usize, overlap: usize) -> Vec<String> {
    let characters: Vec<char> = text.chars().collect();
    tracing::debug!(
        "[chunk_text] 開始分塊 text_len={}, chunk_size={}, overlap={}",
        characters.len(),
        chunk_size,
        overlap
    );

    if characters.is_empty() || chunk_size == 0 {
        tracing::debug!("[chunk_text] 文字為空，回傳空向量");
        return vec![];
    }

    let mut chunks = Vec::new();
    let mut start = 0;
    let text_len = characters.len();
    let mut chunk_index = 0;

    while start < text_len {
        let end = std::cmp::min(start + chunk_size, text_len);

        // Try to extend by at most 50 characters to a sentence boundary.
        let mut actual_end = end;
        if end < text_len {
            let search_end = std::cmp::min(end + 50, text_len);
            if let Some(break_pos) = characters[end..search_end]
                .iter()
                .position(|c| matches!(c, '.' | '!' | '?' | '\n' | '。' | '！' | '？'))
            {
                actual_end = end + break_pos + 1;
            }
        }

        let chunk: String = characters[start..actual_end].iter().collect();
        let preview: String = chunk.chars().take(40).collect();
        tracing::debug!(
            "[chunk_text] chunk {}: start={}, end={}, actual_end={}, len={}, 前 40 字元: {:?}",
            chunk_index,
            start,
            end,
            actual_end,
            chunk.chars().count(),
            preview
        );
        chunks.push(chunk);

        if actual_end == text_len {
            break;
        }

        // Keep overlap smaller than the produced chunk so every iteration advances.
        let produced_chars = actual_end - start;
        let safe_overlap = overlap.min(produced_chars.saturating_sub(1));
        start = actual_end - safe_overlap;
        chunk_index += 1;
    }

    tracing::debug!("[chunk_text] 分塊完成，共 {} 個 chunks", chunks.len());
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
        assert!(chunks
            .iter()
            .all(|chunk| chunk.is_char_boundary(chunk.len())));
    }

    #[test]
    fn test_chunk_text_mixed_markdown_does_not_split_utf8() {
        let text =
            "# 文件上傳使用 pageindex-rs 進行頁面索引\n\n設定：啟用中文分塊與 English content。";
        let chunks = chunk_text(text, 16, 4);
        assert!(chunks.len() > 1);
        assert!(chunks.iter().any(|chunk| chunk.contains('：')));
    }

    #[test]
    fn test_chunk_text_finishes_with_overlap() {
        let chunks = chunk_text("abcdefghij", 4, 2);
        assert_eq!(chunks, vec!["abcd", "cdef", "efgh", "ghij"]);
    }

    #[test]
    fn test_overlap_larger_than_chunk_still_advances() {
        let chunks = chunk_text("abcdef", 2, 10);
        assert_eq!(chunks, vec!["ab", "bc", "cd", "de", "ef"]);
    }

    #[test]
    fn test_empty_text() {
        let chunks = chunk_text("", 100, 20);
        assert!(chunks.is_empty());
    }

    #[test]
    fn test_zero_chunk_size_returns_empty() {
        assert!(chunk_text("content", 0, 0).is_empty());
    }
}
