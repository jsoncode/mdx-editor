use std::fs;
use std::path::PathBuf;

use tauri::State;

use crate::asset_store::{store_asset_from_bytes, store_asset_from_path};
use crate::error::AppError;
use crate::workspace::{
    extension_from_path, markdown_snippet_for_asset, ASSET_DIR, WorkspaceManager,
};

#[tauri::command]
pub fn insert_asset_from_path(
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
    source_path: String,
) -> Result<String, AppError> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(AppError::Other(format!("Source file not found: {source_path}")));
    }

    let ext = extension_from_path(&source);
    let asset_dir = workspaces.asset_dir(&workspace_id)?;
    let relative_path = store_asset_from_path(&asset_dir, &source)?;

    let display_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_string);

    Ok(markdown_snippet_for_asset(
        &relative_path,
        &ext,
        display_name.as_deref(),
    ))
}

#[tauri::command]
pub fn insert_asset_from_bytes(
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
    filename: String,
    bytes: Vec<u8>,
) -> Result<String, AppError> {
    let ext = extension_from_path(PathBuf::from(&filename).as_path());
    let asset_dir = workspaces.asset_dir(&workspace_id)?;
    let relative_path = store_asset_from_bytes(&asset_dir, &bytes, &ext)?;

    let display_name = PathBuf::from(&filename)
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_string);

    Ok(markdown_snippet_for_asset(
        &relative_path,
        &ext,
        display_name.as_deref(),
    ))
}

#[tauri::command]
pub fn read_clipboard_file_paths() -> Result<Vec<String>, AppError> {
    crate::clipboard::read_file_paths()
}

#[tauri::command]
pub fn list_assets(
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
) -> Result<Vec<String>, AppError> {
    let asset_dir = workspaces.asset_dir(&workspace_id)?;
    let mut assets = Vec::new();

    if asset_dir.exists() {
        for entry in fs::read_dir(asset_dir)? {
            let entry = entry?;
            if entry.path().is_file() {
                let name = entry.file_name().to_string_lossy().to_string();
                assets.push(format!("{ASSET_DIR}/{name}"));
            }
        }
    }

    assets.sort();
    Ok(assets)
}

#[tauri::command]
pub fn get_asset_absolute_path(
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
    relative_path: String,
) -> Result<String, AppError> {
    let path = workspaces.resolve_asset_path(&workspace_id, &relative_path)?;
    Ok(path.to_string_lossy().to_string())
}
