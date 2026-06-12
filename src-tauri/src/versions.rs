use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::AppResult;

pub const VERSIONS_FILE: &str = "versions.json";
const FORMAT_VERSION: &str = "1";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    #[serde(rename = "type")]
    pub line_type: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffStats {
    pub additions: u32,
    pub deletions: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentHistoryEntry {
    pub id: String,
    pub saved_at: i64,
    pub lines: Vec<DiffLine>,
    pub stats: DiffStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentVersionsFile {
    pub format_version: String,
    pub entries: Vec<DocumentHistoryEntry>,
}

impl Default for DocumentVersionsFile {
    fn default() -> Self {
        Self {
            format_version: FORMAT_VERSION.to_string(),
            entries: Vec::new(),
        }
    }
}

pub fn versions_file_path(workspace_path: &Path) -> PathBuf {
    workspace_path.join(VERSIONS_FILE)
}

pub fn read_versions(workspace_path: &Path) -> AppResult<DocumentVersionsFile> {
    let path = versions_file_path(workspace_path);
    if !path.exists() {
        return Ok(DocumentVersionsFile::default());
    }

    let raw = fs::read_to_string(path)?;
    let parsed = serde_json::from_str(&raw).unwrap_or_default();
    Ok(parsed)
}

pub fn write_versions(workspace_path: &Path, file: &DocumentVersionsFile) -> AppResult<()> {
    let path = versions_file_path(workspace_path);
    fs::write(path, serde_json::to_string_pretty(file)?)?;
    Ok(())
}

pub fn ensure_versions_file(workspace_path: &Path) -> AppResult<()> {
    let path = versions_file_path(workspace_path);
    if path.exists() {
        return Ok(());
    }
    write_versions(workspace_path, &DocumentVersionsFile::default())
}

pub fn append_version(
    workspace_path: &Path,
    entry: DocumentHistoryEntry,
    max_entries: usize,
) -> AppResult<DocumentVersionsFile> {
    let mut file = read_versions(workspace_path)?;
    file.format_version = FORMAT_VERSION.to_string();
    file.entries.insert(0, entry);
    file.entries.truncate(max_entries);
    write_versions(workspace_path, &file)?;
    Ok(file)
}

pub fn clear_versions(workspace_path: &Path) -> AppResult<DocumentVersionsFile> {
    let file = DocumentVersionsFile::default();
    write_versions(workspace_path, &file)?;
    Ok(file)
}

/// 删除指定历史记录。entries 按保存时间从新到旧排列。
/// 若删除的不是最旧一条，则同时移除所有更早的记录，避免 diff 链断裂。
pub fn delete_version(workspace_path: &Path, entry_id: &str) -> AppResult<(DocumentVersionsFile, usize)> {
    let mut file = read_versions(workspace_path)?;
    let Some(index) = file.entries.iter().position(|entry| entry.id == entry_id) else {
        return Ok((file, 0));
    };

    let removed = if index + 1 == file.entries.len() {
        file.entries.pop();
        1
    } else if index == 0 {
        file.entries.remove(0);
        1
    } else {
        let count = file.entries.len() - index;
        file.entries.truncate(index);
        count
    };

    write_versions(workspace_path, &file)?;
    Ok((file, removed))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_workspace(name: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("mdx-versions-test-{name}-{stamp}"));
        fs::create_dir_all(&path).unwrap();
        path
    }

    fn sample_entry(id: &str) -> DocumentHistoryEntry {
        DocumentHistoryEntry {
            id: id.to_string(),
            saved_at: 0,
            lines: Vec::new(),
            stats: DiffStats {
                additions: 1,
                deletions: 0,
            },
        }
    }

    fn write_sample(workspace: &Path, ids: &[&str]) {
        let file = DocumentVersionsFile {
            format_version: FORMAT_VERSION.to_string(),
            entries: ids.iter().map(|id| sample_entry(id)).collect(),
        };
        write_versions(workspace, &file).unwrap();
    }

    #[test]
    fn delete_newest_only() {
        let dir = temp_workspace("newest");
        write_sample(&dir, &["a", "b", "c"]);
        let (_, removed) = delete_version(&dir, "a").unwrap();
        assert_eq!(removed, 1);
        let file = read_versions(&dir).unwrap();
        assert_eq!(file.entries.iter().map(|e| e.id.as_str()).collect::<Vec<_>>(), vec!["b", "c"]);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn delete_oldest_only() {
        let dir = temp_workspace("oldest");
        write_sample(&dir, &["a", "b", "c"]);
        let (_, removed) = delete_version(&dir, "c").unwrap();
        assert_eq!(removed, 1);
        let file = read_versions(&dir).unwrap();
        assert_eq!(file.entries.iter().map(|e| e.id.as_str()).collect::<Vec<_>>(), vec!["a", "b"]);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn delete_middle_cascades_older() {
        let dir = temp_workspace("middle");
        write_sample(&dir, &["a", "b", "c", "d"]);
        let (_, removed) = delete_version(&dir, "b").unwrap();
        assert_eq!(removed, 3);
        let file = read_versions(&dir).unwrap();
        assert_eq!(file.entries.iter().map(|e| e.id.as_str()).collect::<Vec<_>>(), vec!["a"]);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn delete_missing_is_noop() {
        let dir = temp_workspace("missing");
        write_sample(&dir, &["a"]);
        let (_, removed) = delete_version(&dir, "missing").unwrap();
        assert_eq!(removed, 0);
        assert_eq!(read_versions(&dir).unwrap().entries.len(), 1);
        let _ = fs::remove_dir_all(dir);
    }
}
