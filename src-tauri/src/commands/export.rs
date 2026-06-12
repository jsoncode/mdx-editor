use std::fs;
use std::path::PathBuf;

use tauri::State;

use crate::error::AppError;
use crate::mdx::{encrypt_bytes, pack_workspace_to_bytes};
use crate::workspace::{ASSET_DIR, INDEX_FILE, WorkspaceManager};

#[tauri::command]
pub fn export_markdown(
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
    output_path: String,
    include_assets: bool,
) -> Result<(), AppError> {
    let info = workspaces.get(&workspace_id)?;
    let index_src = info.path.join(INDEX_FILE);
    let output = PathBuf::from(&output_path);

    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(index_src, &output)?;

    if include_assets {
        let asset_src = info.path.join(ASSET_DIR);
        if asset_src.exists() {
            let asset_dest = output
                .parent()
                .map(|p| p.join(ASSET_DIR))
                .unwrap_or_else(|| PathBuf::from(ASSET_DIR));
            copy_dir_recursive(&asset_src, &asset_dest)?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn export_html(output_path: String, html: String) -> Result<(), AppError> {
    let output = PathBuf::from(&output_path);
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, html)?;
    Ok(())
}

#[tauri::command]
pub fn export_encrypted_mdx(
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
    output_path: String,
    password: String,
) -> Result<(), AppError> {
    let info = workspaces.get(&workspace_id)?;
    let output = PathBuf::from(&output_path);

    if output
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("mdx"))
        != Some(true)
    {
        return Err(AppError::Other("加密导出路径必须使用 .mdx 扩展名".to_string()));
    }

    workspaces.cleanup_unused_assets(&workspace_id)?;

    let mut manifest = workspaces.read_manifest(&workspace_id)?;
    let zip_bytes = pack_workspace_to_bytes(&info.path, &mut manifest)?;
    let encrypted = encrypt_bytes(&zip_bytes, &password)?;

    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, encrypted)?;
    workspaces.write_manifest(&workspace_id, &manifest)?;
    Ok(())
}

fn copy_dir_recursive(src: &PathBuf, dest: &PathBuf) -> Result<(), AppError> {
    fs::create_dir_all(dest)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            fs::copy(src_path, dest_path)?;
        }
    }
    Ok(())
}
