use std::collections::HashSet;

use crate::workspace::ASSET_DIR;

/// Collect `asset/<filename>` references from markdown / HTML content.
pub fn collect_asset_references(content: &str) -> HashSet<String> {
    let mut refs = HashSet::new();
    let mut search_from = 0;

    while search_from < content.len() {
        if !content.is_char_boundary(search_from) {
            search_from += 1;
            continue;
        }

        let Some(rel_idx) = content[search_from..].find("asset/") else {
            break;
        };

        let path_start = search_from + rel_idx + ASSET_DIR.len() + 1;
        if path_start >= content.len() {
            break;
        }

        let rest = &content[path_start..];
        let end = rest
            .find(|c: char| {
                c.is_whitespace()
                    || c == ')'
                    || c == '"'
                    || c == '\''
                    || c == '>'
                    || c == ']'
                    || c == '('
            })
            .unwrap_or(rest.len());

        let filename = rest[..end].trim().trim_end_matches('\\');
        if !filename.is_empty() && !filename.contains("..") && !filename.contains('/') {
            refs.insert(format!("{ASSET_DIR}/{filename}"));
        }

        search_from = path_start + end.max(1);
        if search_from < content.len() && !content.is_char_boundary(search_from) {
            search_from += 1;
        }
    }

    refs
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collects_markdown_image_and_link() {
        let content = "![img](asset/a1b2c3d4.png)\n[doc.pdf](asset/e5f6g7h8.pdf)";
        let refs = collect_asset_references(content);
        assert!(refs.contains("asset/a1b2c3d4.png"));
        assert!(refs.contains("asset/e5f6g7h8.pdf"));
    }

    #[test]
    fn collects_html_media_tags() {
        let content = r#"<video controls src="asset/9478de95.mp4"></video>"#;
        let refs = collect_asset_references(content);
        assert!(refs.contains("asset/9478de95.mp4"));
    }

    #[test]
    fn collects_asset_refs_with_chinese_content() {
        let content = "> 引用测试\n![img](asset/d5f1cdde.png)\n";
        let refs = collect_asset_references(content);
        assert!(refs.contains("asset/d5f1cdde.png"));
    }
}
