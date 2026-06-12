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
