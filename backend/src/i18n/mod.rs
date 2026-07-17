#![allow(dead_code)]
use std::collections::HashMap;

#[derive(Clone)]
pub struct I18nService {
    translations: HashMap<String, HashMap<String, String>>,
}

impl I18nService {
    pub fn new() -> Self {
        let mut translations = HashMap::new();

        let mut zh_tw = HashMap::new();
        zh_tw.insert("document.not_found".to_string(), "找不到文件".to_string());
        zh_tw.insert("user.not_found".to_string(), "找不到使用者".to_string());
        zh_tw.insert("auth.invalid_credentials".to_string(), "帳號或密碼錯誤".to_string());
        zh_tw.insert("auth.token_expired".to_string(), "Token 已過期".to_string());
        zh_tw.insert("upload.success".to_string(), "上傳成功".to_string());
        zh_tw.insert("upload.failed".to_string(), "上傳失敗".to_string());
        zh_tw.insert("search.no_results".to_string(), "找不到相關結果".to_string());
        zh_tw.insert("common.error".to_string(), "發生錯誤".to_string());
        zh_tw.insert("common.success".to_string(), "成功".to_string());
        translations.insert("zh-TW".to_string(), zh_tw);

        let mut en = HashMap::new();
        en.insert("document.not_found".to_string(), "Document not found".to_string());
        en.insert("user.not_found".to_string(), "User not found".to_string());
        en.insert("auth.invalid_credentials".to_string(), "Invalid credentials".to_string());
        en.insert("auth.token_expired".to_string(), "Token expired".to_string());
        en.insert("upload.success".to_string(), "Upload successful".to_string());
        en.insert("upload.failed".to_string(), "Upload failed".to_string());
        en.insert("search.no_results".to_string(), "No results found".to_string());
        en.insert("common.error".to_string(), "An error occurred".to_string());
        en.insert("common.success".to_string(), "Success".to_string());
        translations.insert("en".to_string(), en);

        Self { translations }
    }

    pub fn translate(&self, key: &str, lang: &str) -> String {
        self.translations
            .get(lang)
            .and_then(|map| map.get(key))
            .cloned()
            .unwrap_or_else(|| key.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_translate() {
        let i18n = I18nService::new();
        assert_eq!(i18n.translate("document.not_found", "zh-TW"), "找不到文件");
        assert_eq!(i18n.translate("document.not_found", "en"), "Document not found");
        assert_eq!(i18n.translate("unknown.key", "zh-TW"), "unknown.key");
    }
}
