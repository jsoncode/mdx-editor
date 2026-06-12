use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

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

pub fn versions_sidecar_path(document_path: &Path) -> PathBuf {
    PathBuf::from(format!("{}.versions.json", document_path.to_string_lossy()))
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

pub fn import_versions_sidecar(document_path: &Path, workspace_path: &Path) -> AppResult<()> {
    let sidecar = versions_sidecar_path(document_path);
    let target = versions_file_path(workspace_path);
    if sidecar.exists() {
        fs::copy(&sidecar, &target).map_err(|e| AppError::Io(e))?;
        return Ok(());
    }
    ensure_versions_file(workspace_path)
}

pub fn export_versions_sidecar(document_path: &Path, workspace_path: &Path) -> AppResult<()> {
    let source = versions_file_path(workspace_path);
    if !source.exists() {
        return Ok(());
    }

    let file = read_versions(workspace_path)?;
    if file.entries.is_empty() {
        let sidecar = versions_sidecar_path(document_path);
        if sidecar.exists() {
            fs::remove_file(sidecar)?;
        }
        return Ok(());
    }

    let sidecar = versions_sidecar_path(document_path);
    if let Some(parent) = sidecar.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(sidecar, serde_json::to_string_pretty(&file)?)?;
    Ok(())
}
