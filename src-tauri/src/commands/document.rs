use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::error::AppError;
use crate::manifest::{DocumentMetadataInput, Manifest};
use crate::mdx::{pack_workspace, unpack_to_workspace};
use crate::versions::{self, DocumentHistoryEntry, DocumentVersionsFile};
use crate::workspace::{ASSET_DIR, INDEX_FILE, WorkspaceManager};

fn extension_lower(path: &std::path::Path) -> Option<String> {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
}

fn is_plain_md_path(path: &std::path::Path) -> bool {
    extension_lower(path).as_deref() == Some("md")
}

fn is_mdx_path(path: &std::path::Path) -> bool {
    extension_lower(path).as_deref() == Some("mdx")
}

fn open_plain_markdown_workspace(
    app: &AppHandle,
    workspaces: &WorkspaceManager,
    file_path: &std::path::Path,
) -> Result<crate::workspace::WorkspaceInfo, AppError> {
    let id = Uuid::new_v4().to_string();
    let workspace_path = WorkspaceManager::workspaces_root(app)?.join(&id);
    fs::create_dir_all(&workspace_path)?;
    fs::create_dir_all(workspace_path.join(ASSET_DIR))?;

    let content = fs::read_to_string(file_path)?;
    fs::write(workspace_path.join(INDEX_FILE), &content)?;
    crate::manifest_io::import_manifest_sidecar(file_path, &workspace_path)?;
    versions::import_versions_sidecar(file_path, &workspace_path)?;

    Ok(workspaces.register_workspace(
        id,
        workspace_path,
        Some(file_path.to_path_buf()),
    ))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocumentState {
    pub workspace_id: String,
    pub content: String,
    pub manifest: Manifest,
    pub file_path: Option<String>,
}

#[tauri::command]
pub fn create_document(
    app: AppHandle,
    workspaces: State<'_, WorkspaceManager>,
) -> Result<DocumentState, AppError> {
    let info = workspaces.create_workspace(&app)?;
    let manifest = workspaces.read_manifest(&info.id)?;
    Ok(DocumentState {
        workspace_id: info.id,
        content: String::new(),
        manifest,
        file_path: None,
    })
}

#[tauri::command]
pub fn open_document(
    app: AppHandle,
    workspaces: State<'_, WorkspaceManager>,
    path: String,
) -> Result<DocumentState, AppError> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(AppError::Other(format!("File not found: {path}")));
    }

    let info = match extension_lower(&file_path).as_deref() {
        Some("mdx") => {
            let id = Uuid::new_v4().to_string();
            let workspace_path = WorkspaceManager::workspaces_root(&app)?.join(&id);
            unpack_to_workspace(&file_path, &workspace_path)?;
            workspaces.register_workspace(id, workspace_path, Some(file_path))
        }
        Some("md") => open_plain_markdown_workspace(&app, &workspaces, &file_path)?,
        _ => {
            return Err(AppError::Other(
                "仅支持打开 .md 或 .mdx 文件".to_string(),
            ));
        }
    };

    let content = workspaces.read_index(&info.id)?;
    let manifest = workspaces.read_manifest(&info.id)?;

    Ok(DocumentState {
        workspace_id: info.id,
        content,
        manifest,
        file_path: info.file_path.as_ref().map(|p| p.to_string_lossy().to_string()),
    })
}

#[tauri::command]
pub fn update_document_content(
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
    content: String,
) -> Result<(), AppError> {
    workspaces.write_index(&workspace_id, &content)?;
    Ok(())
}

#[tauri::command]
pub fn save_document(
    _app: AppHandle,
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
    path: Option<String>,
) -> Result<String, AppError> {
    let info = workspaces.get(&workspace_id)?;
    let output_path = match path {
        Some(p) => PathBuf::from(p),
        None => info
            .file_path
            .clone()
            .ok_or_else(|| AppError::Other("No file path specified".to_string()))?,
    };

    workspaces.cleanup_unused_assets(&workspace_id)?;

    if is_plain_md_path(&output_path) {
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let content = workspaces.read_index(&workspace_id)?;
        fs::write(&output_path, content)?;
        versions::export_versions_sidecar(&output_path, &info.path)?;
        crate::manifest_io::export_manifest_sidecar(&output_path, &info.path)?;
        workspaces.set_file_path(&workspace_id, Some(output_path.clone()))?;
        return Ok(output_path.to_string_lossy().to_string());
    }

    if !is_mdx_path(&output_path) {
        return Err(AppError::Other(
            "保存路径必须使用 .md 或 .mdx 扩展名".to_string(),
        ));
    }

    let mut manifest = workspaces.read_manifest(&workspace_id)?;
    pack_workspace(&info.path, &output_path, &mut manifest)?;
    workspaces.write_manifest(&workspace_id, &manifest)?;
    workspaces.set_file_path(&workspace_id, Some(output_path.clone()))?;

    Ok(output_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn autosave_document(
    app: AppHandle,
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
) -> Result<String, AppError> {
    let info = workspaces.get(&workspace_id)?;
    let autosave_dir = WorkspaceManager::autosave_root(&app)?;
    workspaces.cleanup_unused_assets(&workspace_id)?;

    if info
        .file_path
        .as_ref()
        .is_some_and(|path| is_plain_md_path(path))
    {
        let output_path = autosave_dir.join(format!("{workspace_id}.md"));
        let content = workspaces.read_index(&workspace_id)?;
        fs::write(&output_path, content)?;
        return Ok(output_path.to_string_lossy().to_string());
    }

    let output_path = autosave_dir.join(format!("{workspace_id}.mdx"));

    let mut manifest = workspaces.read_manifest(&workspace_id)?;
    pack_workspace(&info.path, &output_path, &mut manifest)?;
    workspaces.write_manifest(&workspace_id, &manifest)?;

    Ok(output_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn close_document(
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
) -> Result<(), AppError> {
    workspaces.remove(&workspace_id)
}

#[tauri::command]
pub fn apply_document_metadata(
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
    metadata: DocumentMetadataInput,
) -> Result<Manifest, AppError> {
    let mut manifest = workspaces.read_manifest(&workspace_id)?;
    manifest.apply_metadata(
        metadata.record_device,
        metadata.record_location,
        metadata.location,
    );
    workspaces.write_manifest(&workspace_id, &manifest)?;
    Ok(manifest)
}

#[tauri::command]
pub fn get_document_manifest(
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
) -> Result<Manifest, AppError> {
    workspaces.read_manifest(&workspace_id)
}

#[tauri::command]
pub fn set_document_file_path(
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
    path: String,
) -> Result<(), AppError> {
    workspaces.set_file_path(&workspace_id, Some(PathBuf::from(path)))?;
    Ok(())
}

#[tauri::command]
pub fn get_document_versions(
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
) -> Result<DocumentVersionsFile, AppError> {
    workspaces.read_versions(&workspace_id)
}

#[tauri::command]
pub fn append_document_version(
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
    entry: DocumentHistoryEntry,
    max_entries: u32,
) -> Result<DocumentVersionsFile, AppError> {
    workspaces.append_version(&workspace_id, entry, max_entries)
}

#[tauri::command]
pub fn clear_document_versions(
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
) -> Result<DocumentVersionsFile, AppError> {
    workspaces.clear_versions(&workspace_id)
}
