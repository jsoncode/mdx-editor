use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::error::AppError;
use crate::manifest::Manifest;
use crate::mdx::{pack_workspace, unpack_to_workspace};
use crate::workspace::WorkspaceManager;

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
    let mdx_path = PathBuf::from(&path);
    if !mdx_path.exists() {
        return Err(AppError::Other(format!("File not found: {path}")));
    }

    let id = Uuid::new_v4().to_string();
    let workspace_path = WorkspaceManager::workspaces_root(&app)?.join(&id);
    unpack_to_workspace(&mdx_path, &workspace_path)?;

    let info = workspaces.register_workspace(id.clone(), workspace_path, Some(mdx_path));
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

    let mut manifest = workspaces.read_manifest(&workspace_id)?;
    workspaces.cleanup_unused_assets(&workspace_id)?;
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
    let output_path = autosave_dir.join(format!("{workspace_id}.mdx"));

    let mut manifest = workspaces.read_manifest(&workspace_id)?;
    workspaces.cleanup_unused_assets(&workspace_id)?;
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
pub fn get_document_manifest(
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
) -> Result<Manifest, AppError> {
    workspaces.read_manifest(&workspace_id)
}
