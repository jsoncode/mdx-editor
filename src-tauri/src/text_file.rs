use std::path::Path;

/// Extensions that can be opened and edited as plain text in the editor.
pub const EDITABLE_TEXT_EXTENSIONS: &[&str] = &[
    "txt", "text", "log", "json", "xml", "csv", "yaml", "yml", "toml", "ini", "cfg", "conf",
    "env", "css", "scss", "less", "js", "jsx", "ts", "tsx", "mjs", "cjs", "html", "htm", "svg",
    "rs", "py", "go", "java", "c", "cpp", "h", "hpp", "cs", "kt", "swift", "rb", "php", "lua",
    "sh", "bash", "zsh", "ps1", "bat", "cmd", "sql", "graphql", "vue", "svelte", "r", "dart",
    "md", "mdx",
];

pub fn extension_lower(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
}

pub fn is_mdx_extension(ext: &str) -> bool {
    ext.eq_ignore_ascii_case("mdx")
}

pub fn is_plain_md_extension(ext: &str) -> bool {
    ext.eq_ignore_ascii_case("md")
}

pub fn is_html_extension(ext: &str) -> bool {
    ext.eq_ignore_ascii_case("html") || ext.eq_ignore_ascii_case("htm")
}

pub fn is_editable_text_extension(ext: &str) -> bool {
    EDITABLE_TEXT_EXTENSIONS
        .iter()
        .any(|candidate| candidate.eq_ignore_ascii_case(ext))
}

pub fn is_editable_text_path(path: &Path) -> bool {
    extension_lower(path)
        .map(|ext| is_editable_text_extension(&ext))
        .unwrap_or(false)
}

pub fn is_full_html_document(content: &str) -> bool {
    let trimmed = content.trim_start();
    let sample: String = trimmed.chars().take(1024).collect::<String>().to_lowercase();
    sample.starts_with("<!doctype html") || sample.contains("<html")
}

pub fn content_format_for_file(path: &Path, content: &str) -> &'static str {
    let ext = extension_lower(path).unwrap_or_default();
    if is_plain_md_extension(&ext) || is_mdx_extension(&ext) {
        return "markdown";
    }
    if is_html_extension(&ext) && is_full_html_document(content) {
        return "html";
    }
    "text"
}

pub fn is_document_sidecar_name(name: &str) -> bool {
    name.ends_with(".versions.json") || name.ends_with(".manifest.json")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_full_html_document() {
        assert!(is_full_html_document(
            "<!DOCTYPE html><html><head></head><body></body></html>"
        ));
        assert!(is_full_html_document(
            "  <html lang=\"zh\"><body>hi</body></html>"
        ));
        assert!(!is_full_html_document("<div>fragment</div>"));
    }

    #[test]
    fn classifies_content_format() {
        let md = Path::new("note.md");
        assert_eq!(content_format_for_file(md, "# title"), "markdown");
        let html = Path::new("page.html");
        assert_eq!(
            content_format_for_file(html, "<!DOCTYPE html><html></html>"),
            "html"
        );
        assert_eq!(content_format_for_file(html, "<p>fragment</p>"), "text");
        let txt = Path::new("readme.txt");
        assert_eq!(content_format_for_file(txt, "hello"), "text");
    }
}
