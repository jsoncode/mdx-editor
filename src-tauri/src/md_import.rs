use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::workspace::{extension_from_path, ASSET_DIR, INDEX_FILE};

/// Import local file references from markdown into `workspace/asset/` and rewrite links to `asset/...`.
pub fn import_local_assets(
    workspace_path: &Path,
    base_dir: &Path,
    content: &str,
) -> AppResult<String> {
    let targets = collect_local_reference_targets(content);
    if targets.is_empty() {
        return Ok(content.to_string());
    }

    let asset_dir = workspace_path.join(ASSET_DIR);
    fs::create_dir_all(&asset_dir)?;

    let mut canonical_to_asset: HashMap<PathBuf, String> = HashMap::new();
    let mut replacements: Vec<(String, String)> = Vec::new();

    for raw in targets {
        if replacements.iter().any(|(from, _)| from == &raw) {
            continue;
        }

        let Some(resolved) = resolve_local_path(base_dir, &raw) else {
            continue;
        };
        if !resolved.is_file() {
            continue;
        }

        let canonical = fs::canonicalize(&resolved).unwrap_or(resolved);
        let asset_relative = canonical_to_asset
            .entry(canonical.clone())
            .or_insert_with(|| copy_into_asset_dir(&asset_dir, &canonical))
            .clone();

        replacements.push((raw, asset_relative));
    }

    Ok(apply_reference_replacements(content, &replacements))
}

fn copy_into_asset_dir(asset_dir: &Path, source: &Path) -> String {
    let ext = extension_from_path(source);
    let filename = format!("{}.{}", &Uuid::new_v4().to_string()[..8], ext);
    let dest = asset_dir.join(&filename);
    let _ = fs::copy(source, &dest);
    format!("{ASSET_DIR}/{filename}")
}

fn resolve_local_path(base_dir: &Path, raw: &str) -> Option<PathBuf> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || is_non_local_reference(trimmed) {
        return None;
    }

    let decoded = percent_decode_path(trimmed);
    let path = PathBuf::from(&decoded);
    let resolved = if path.is_absolute() {
        path
    } else {
        base_dir.join(path)
    };

    Some(resolved)
}

fn percent_decode_path(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hex) = u8::from_str_radix(
                std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""),
                16,
            ) {
                out.push(hex as char);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    out
}

pub fn is_non_local_reference(path: &str) -> bool {
    let p = path.trim();
    p.is_empty()
        || p.starts_with('#')
        || p.starts_with("http://")
        || p.starts_with("https://")
        || p.starts_with("//")
        || p.starts_with("data:")
        || p.starts_with("mailto:")
        || p.starts_with("asset/")
        || p.starts_with("asset\\")
}

/// Collect unique local reference targets from markdown links/images and HTML src/href attributes.
pub fn collect_local_reference_targets(content: &str) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut targets = Vec::new();

    let mut push = |value: String| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() || is_non_local_reference(&trimmed) {
            return;
        }
        if seen.insert(trimmed.clone()) {
            targets.push(trimmed);
        }
    };

    collect_markdown_targets(content, &mut push);
    collect_html_attr_targets(content, "src", &mut push);
    collect_html_attr_targets(content, "href", &mut push);

    targets
}

fn collect_markdown_targets(content: &str, push: &mut dyn FnMut(String)) {
    let bytes = content.as_bytes();
    let mut i = 0;
    while i + 2 < bytes.len() {
        if bytes[i] == b']' && bytes[i + 1] == b'(' {
            if let Some((url, next)) = parse_parenthesized_url(content, i + 2) {
                push(url);
                i = next;
                continue;
            }
        }
        i += 1;
    }
}

fn parse_parenthesized_url(content: &str, start: usize) -> Option<(String, usize)> {
    let bytes = content.as_bytes();
    if start >= bytes.len() {
        return None;
    }

    let mut i = start;
    let mut url = String::new();

    if bytes[i] == b'<' {
        i += 1;
        while i < bytes.len() && bytes[i] != b'>' {
            url.push(bytes[i] as char);
            i += 1;
        }
        if i < bytes.len() && bytes[i] == b'>' {
            i += 1;
        }
    } else {
        let mut paren_depth = 0usize;
        while i < bytes.len() {
            let ch = bytes[i];
            if ch == b'(' {
                paren_depth += 1;
                url.push('(');
                i += 1;
                continue;
            }
            if ch == b')' {
                if paren_depth == 0 {
                    break;
                }
                paren_depth -= 1;
                url.push(')');
                i += 1;
                continue;
            }
            url.push(ch as char);
            i += 1;
        }
    }

    let url = strip_optional_title(&url).trim().to_string();
    if url.is_empty() {
        return None;
    }
    Some((url, i))
}

fn strip_optional_title(url: &str) -> &str {
    let trimmed = url.trim();
    if trimmed.starts_with('"') {
        return trimmed;
    }
    if let Some(idx) = trimmed.find('"') {
        if trimmed[..idx].ends_with(' ') || trimmed[..idx].ends_with('\t') {
            return trimmed[..idx].trim_end();
        }
    }
    if let Some(idx) = trimmed.find('\'') {
        if trimmed[..idx].ends_with(' ') || trimmed[..idx].ends_with('\t') {
            return trimmed[..idx].trim_end();
        }
    }
    trimmed
}

fn collect_html_attr_targets(content: &str, attr: &str, push: &mut dyn FnMut(String)) {
    let needle = format!("{attr}=");
    let bytes = content.as_bytes();
    let needle_bytes = needle.as_bytes();
    let mut i = 0;

    while i + needle_bytes.len() <= bytes.len() {
        if bytes[i..].starts_with(needle_bytes) {
            let quote_start = i + needle_bytes.len();
            if quote_start >= bytes.len() {
                break;
            }
            let quote = bytes[quote_start];
            if quote != b'"' && quote != b'\'' {
                i += 1;
                continue;
            }
            let mut j = quote_start + 1;
            while j < bytes.len() && bytes[j] != quote {
                j += 1;
            }
            if let Ok(value) = std::str::from_utf8(&bytes[quote_start + 1..j]) {
                push(value.to_string());
            }
            i = j + 1;
            continue;
        }
        i += 1;
    }
}

fn apply_reference_replacements(content: &str, replacements: &[(String, String)]) -> String {
    let mut result = content.to_string();
    for (from, to) in replacements {
        if from == to {
            continue;
        }
        result = replace_markdown_reference(&result, from, to);
        result = replace_html_attribute(&result, "src", from, to);
        result = replace_html_attribute(&result, "href", from, to);
    }
    result
}

fn replace_markdown_reference(content: &str, from: &str, to: &str) -> String {
    let mut result = content.to_string();
    for wrapper in [("", ""), ("<", ">")] {
        let old = format!("]({}{}{})", wrapper.0, from, wrapper.1);
        let new = format!("]({}{}{})", wrapper.0, to, wrapper.1);
        result = result.replace(&old, &new);
    }
    result
}

fn replace_html_attribute(content: &str, attr: &str, from: &str, to: &str) -> String {
    let mut result = content.to_string();
    for quote in ['"', '\''] {
        let old = format!("{attr}={quote}{from}{quote}");
        let new = format!("{attr}={quote}{to}{quote}");
        result = result.replace(&old, &new);
    }
    result
}

pub fn convert_md_file_to_mdx(md_path: &Path, output_path: &Path) -> AppResult<String> {
    if !md_path.is_file() {
        return Err(AppError::Other(format!(
            "Markdown 文件不存在: {}",
            md_path.to_string_lossy()
        )));
    }

    let base_dir = md_path.parent().unwrap_or_else(|| Path::new("."));
    let content = fs::read_to_string(md_path)?;
    let temp = std::env::temp_dir().join(format!("mdx-convert-{}", Uuid::new_v4()));
    fs::create_dir_all(temp.join(ASSET_DIR))?;

    let imported = import_local_assets(&temp, base_dir, &content)?;
    fs::write(temp.join(INDEX_FILE), imported)?;

    let manifest = crate::manifest::Manifest::default();
    fs::write(
        temp.join(crate::workspace::MANIFEST_FILE),
        serde_json::to_string_pretty(&manifest)?,
    )?;
    crate::versions::ensure_versions_file(&temp)?;

    let mut manifest = manifest;

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }

    crate::mdx::pack_workspace(&temp, output_path, &mut manifest)?;
    let _ = fs::remove_dir_all(&temp);

    Ok(output_path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write_temp_file(dir: &Path, name: &str, content: &[u8]) -> PathBuf {
        let path = dir.join(name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut file = fs::File::create(&path).unwrap();
        file.write_all(content).unwrap();
        path
    }

    #[test]
    fn collects_markdown_and_html_local_refs() {
        let content = r#"![img](./pics/a.png)
[doc](../files/readme.pdf)
<video src="clip.mp4"></video>
[ext](https://example.com/x.png)
![packed](asset/existing.png)
"#;
        let refs = collect_local_reference_targets(content);
        assert!(refs.contains(&"./pics/a.png".to_string()));
        assert!(refs.contains(&"../files/readme.pdf".to_string()));
        assert!(refs.contains(&"clip.mp4".to_string()));
        assert!(!refs.iter().any(|r| r.contains("example.com")));
        assert!(!refs.iter().any(|r| r.starts_with("asset/")));
    }

    #[test]
    fn parses_chinese_content_without_panic() {
        let content = r#"# title

> 引用测试内容

正文内容

[这是一个链接](http://www.bing.com)


这是一个图片
111


![asset/d5f1cdde.png](asset/d5f1cdde.png)
"#;
        let temp = std::env::temp_dir().join(format!("mdx-chinese-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&temp).unwrap();
        let result = import_local_assets(&temp, Path::new("."), content);
        assert!(result.is_ok());
        let _ = fs::remove_dir_all(temp);
    }

    #[test]
    fn collects_html_attrs_with_chinese_content() {
        let content = "> 引用测试\n<video src=\"clip.mp4\"></video>\n";
        let refs = collect_local_reference_targets(content);
        assert!(refs.contains(&"clip.mp4".to_string()));
    }

    #[test]
    fn imports_local_assets_and_rewrites_links() {
        let temp = std::env::temp_dir().join(format!("mdx-import-test-{}", Uuid::new_v4()));
        let base = temp.join("docs");
        let workspace = temp.join("workspace");
        fs::create_dir_all(&base).unwrap();
        fs::create_dir_all(&workspace).unwrap();

        write_temp_file(&base, "pics/a.png", b"png-bytes");
        let md = base.join("note.md");
        fs::write(
            &md,
            "![img](./pics/a.png)\n[skip](https://x.test/a.png)\n",
        )
        .unwrap();

        let rewritten =
            import_local_assets(&workspace, &base, &fs::read_to_string(&md).unwrap()).unwrap();

        assert!(!rewritten.contains("./pics/a.png"));
        assert!(rewritten.contains("asset/"));
        assert!(rewritten.contains(".png"));

        let asset_dir = workspace.join("asset");
        let entries: Vec<_> = fs::read_dir(asset_dir).unwrap().collect();
        assert_eq!(entries.len(), 1);

        let _ = fs::remove_dir_all(temp);
    }
}
