use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{AppHandle, Manager};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::manifest::Manifest;
use crate::versions::{self, DocumentHistoryEntry, DocumentVersionsFile};

pub const INDEX_FILE: &str = "index.md";
pub const MANIFEST_FILE: &str = "manifest.json";
pub const ASSET_DIR: &str = "asset";
pub use crate::versions::VERSIONS_FILE;

pub struct WorkspaceManager {
    workspaces: Mutex<HashMap<String, WorkspaceInfo>>,
}

#[derive(Debug, Clone)]
pub struct WorkspaceInfo {
    pub id: String,
    pub path: PathBuf,
    pub file_path: Option<PathBuf>,
    pub source_encrypted: bool,
}

impl WorkspaceManager {
    pub fn new() -> Self {
        Self {
            workspaces: Mutex::new(HashMap::new()),
        }
    }

    pub fn workspaces_root(app: &AppHandle) -> AppResult<PathBuf> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| AppError::Other(e.to_string()))?
            .join("workspaces");
        fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    pub fn autosave_root(app: &AppHandle) -> AppResult<PathBuf> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| AppError::Other(e.to_string()))?
            .join("autosave");
        fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    pub fn create_workspace(&self, app: &AppHandle) -> AppResult<WorkspaceInfo> {
        let id = Uuid::new_v4().to_string();
        let path = Self::workspaces_root(app)?.join(&id);
        fs::create_dir_all(&path)?;
        fs::create_dir_all(path.join(ASSET_DIR))?;

        let manifest = Manifest::default();
        fs::write(
            path.join(MANIFEST_FILE),
            serde_json::to_string_pretty(&manifest)?,
        )?;
        fs::write(path.join(INDEX_FILE), "")?;
        versions::ensure_versions_file(&path)?;

        let info = WorkspaceInfo {
            id: id.clone(),
            path,
            file_path: None,
            source_encrypted: false,
        };
        self.workspaces
            .lock()
            .unwrap()
            .insert(id, info.clone());
        Ok(info)
    }

    pub fn register_workspace(
        &self,
        id: String,
        path: PathBuf,
        file_path: Option<PathBuf>,
        source_encrypted: bool,
    ) -> WorkspaceInfo {
        let info = WorkspaceInfo {
            id: id.clone(),
            path,
            file_path,
            source_encrypted,
        };
        self.workspaces
            .lock()
            .unwrap()
            .insert(id, info.clone());
        info
    }

    pub fn get(&self, workspace_id: &str) -> AppResult<WorkspaceInfo> {
        self.workspaces
            .lock()
            .unwrap()
            .get(workspace_id)
            .cloned()
            .ok_or_else(|| AppError::WorkspaceNotFound(workspace_id.to_string()))
    }

    pub fn remove(&self, workspace_id: &str) -> AppResult<()> {
        if let Some(info) = self.workspaces.lock().unwrap().remove(workspace_id) {
            if info.path.exists() {
                fs::remove_dir_all(info.path)?;
            }
        }
        Ok(())
    }

    pub fn read_index(&self, workspace_id: &str) -> AppResult<String> {
        let info = self.get(workspace_id)?;
        let path = info.path.join(INDEX_FILE);
        Ok(fs::read_to_string(path)?)
    }

    pub fn write_index(&self, workspace_id: &str, content: &str) -> AppResult<()> {
        let info = self.get(workspace_id)?;
        fs::write(info.path.join(INDEX_FILE), content)?;
        Ok(())
    }

    pub fn read_manifest(&self, workspace_id: &str) -> AppResult<Manifest> {
        let info = self.get(workspace_id)?;
        let path = info.path.join(MANIFEST_FILE);
        if !path.exists() {
            return Ok(Manifest::default());
        }
        let content = fs::read_to_string(path)?;
        Ok(serde_json::from_str(&content)?)
    }

    pub fn write_manifest(&self, workspace_id: &str, manifest: &Manifest) -> AppResult<()> {
        let info = self.get(workspace_id)?;
        fs::write(
            info.path.join(MANIFEST_FILE),
            serde_json::to_string_pretty(manifest)?,
        )?;
        Ok(())
    }

    pub fn asset_dir(&self, workspace_id: &str) -> AppResult<PathBuf> {
        let info = self.get(workspace_id)?;
        let dir = info.path.join(ASSET_DIR);
        fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    pub fn resolve_asset_path(&self, workspace_id: &str, relative_path: &str) -> AppResult<PathBuf> {
        let info = self.get(workspace_id)?;
        let normalized = relative_path.replace('\\', "/");
        if normalized.contains("..") || !normalized.starts_with(ASSET_DIR) {
            return Err(AppError::Other("Invalid asset path".to_string()));
        }
        let path = info.path.join(&normalized);
        if !path.exists() {
            return Err(AppError::Other(format!("Asset not found: {relative_path}")));
        }
        Ok(path)
    }

    pub fn set_file_path(&self, workspace_id: &str, file_path: Option<PathBuf>) -> AppResult<()> {
        let mut workspaces = self.workspaces.lock().unwrap();
        let info = workspaces
            .get_mut(workspace_id)
            .ok_or_else(|| AppError::WorkspaceNotFound(workspace_id.to_string()))?;
        info.file_path = file_path;
        Ok(())
    }

    pub fn set_source_encrypted(&self, workspace_id: &str, encrypted: bool) -> AppResult<()> {
        let mut workspaces = self.workspaces.lock().unwrap();
        let info = workspaces
            .get_mut(workspace_id)
            .ok_or_else(|| AppError::WorkspaceNotFound(workspace_id.to_string()))?;
        info.source_encrypted = encrypted;
        Ok(())
    }

    /// Remove asset files that are no longer referenced in index.md.
    pub fn cleanup_unused_assets(&self, workspace_id: &str) -> AppResult<Vec<String>> {
        let content = self.read_index(workspace_id)?;
        let refs = crate::asset_refs::collect_asset_references(&content);
        let asset_dir = self.asset_dir(workspace_id)?;
        let mut deleted = Vec::new();

        if !asset_dir.exists() {
            return Ok(deleted);
        }

        for entry in fs::read_dir(asset_dir)? {
            let entry = entry?;
            if !entry.path().is_file() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            let relative = format!("{ASSET_DIR}/{name}");
            if !refs.contains(&relative) {
                fs::remove_file(entry.path())?;
                deleted.push(relative);
            }
        }

        Ok(deleted)
    }

    pub fn read_versions(&self, workspace_id: &str) -> AppResult<DocumentVersionsFile> {
        let info = self.get(workspace_id)?;
        versions::read_versions(&info.path)
    }

    pub fn append_version(
        &self,
        workspace_id: &str,
        entry: DocumentHistoryEntry,
        max_entries: u32,
    ) -> AppResult<DocumentVersionsFile> {
        let info = self.get(workspace_id)?;
        let max = max_entries.clamp(1, 500) as usize;
        versions::append_version(&info.path, entry, max)
    }

    pub fn clear_versions(&self, workspace_id: &str) -> AppResult<DocumentVersionsFile> {
        let info = self.get(workspace_id)?;
        versions::clear_versions(&info.path)
    }

    pub fn delete_version(
        &self,
        workspace_id: &str,
        entry_id: &str,
    ) -> AppResult<(DocumentVersionsFile, usize)> {
        let info = self.get(workspace_id)?;
        versions::delete_version(&info.path, entry_id)
    }
}

pub fn extension_from_path(path: &Path) -> String {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_else(|| "bin".to_string())
}

pub fn is_image_ext(ext: &str) -> bool {
    matches!(
        ext,
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "ico" | "tif" | "tiff"
    )
}

pub fn is_video_ext(ext: &str) -> bool {
    matches!(
        ext,
        "mp4" | "webm" | "mov" | "avi" | "mkv" | "m4v" | "wmv" | "flv" | "mpg" | "mpeg" | "3gp" | "ts"
    )
}

pub fn is_audio_ext(ext: &str) -> bool {
    matches!(
        ext,
        "mp3" | "wav" | "ogg" | "oga" | "opus" | "flac" | "aac" | "m4a" | "weba" | "aiff" | "aif" | "wma"
    )
}

fn escape_markdown_link_text(text: &str) -> String {
    text.replace('\\', "\\\\")
        .replace('[', "\\[")
        .replace(']', "\\]")
}

pub fn markdown_snippet_for_asset(
    relative_path: &str,
    ext: &str,
    display_name: Option<&str>,
) -> String {
    let stored_name = relative_path.rsplit('/').next().unwrap_or(relative_path);
    let label = escape_markdown_link_text(display_name.unwrap_or(stored_name));

    if is_image_ext(ext) {
        format!("![{label}]({relative_path})")
    } else if is_video_ext(ext) {
        format!("<video controls src=\"{relative_path}\"></video>")
    } else if is_audio_ext(ext) {
        format!("<audio controls src=\"{relative_path}\"></audio>")
    } else {
        format!("[📎 {label}]({relative_path})")
    }
}
