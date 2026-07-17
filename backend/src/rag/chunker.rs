pub fn chunk_text(text: &str, chunk_size: usize, overlap: usize) -> Vec<String> {
    if text.is_empty() {
        return vec![];
    }

    let mut chunks = Vec::new();
    let mut start = 0;
    let text_len = text.len();

    while start < text_len {
        let end = std::cmp::min(start + chunk_size, text_len);

        // Try to break at a sentence boundary
        let mut actual_end = end;
        if end < text_len {
            if let Some(break_pos) = text[end..].find(|c: char| c == '.' || c == '!' || c == '?' || c == '\n' || c == '。' || c == '！' || c == '？')
            {
                if break_pos < 50 {
                    actual_end = end + break_pos + 1;
                }
            }
        }

        chunks.push(text[start..actual_end].to_string());
        start = actual_end.saturating_sub(overlap);
    }

    chunks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chunk_text_basic() {
        let text = "This is a test document. It has multiple sentences. We want to chunk it properly.";
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
