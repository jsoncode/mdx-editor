use std::fs;
use std::path::PathBuf;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use tauri::{AppHandle, State};

use crate::asset_refs;
use crate::error::AppError;
use crate::media_preview;
use crate::pdf_export;
use crate::workspace::WorkspaceManager;

#[tauri::command]
pub fn export_markdown(
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
    output_path: String,
    include_assets: bool,
) -> Result<(), AppError> {
    let info = workspaces.get(&workspace_id)?;
    let index_src = info.path.join(crate::workspace::INDEX_FILE);
    let output = PathBuf::from(&output_path);

    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(index_src, &output)?;

    if include_assets {
        let asset_src = info.path.join(crate::workspace::ASSET_DIR);
        if asset_src.exists() {
            let asset_dest = output
                .parent()
                .map(|p| p.join(crate::workspace::ASSET_DIR))
                .unwrap_or_else(|| PathBuf::from(crate::workspace::ASSET_DIR));
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
    let zip_bytes = crate::mdx::pack_workspace_to_bytes(&info.path, &mut manifest)?;
    let encrypted = crate::mdx::encrypt_bytes(&zip_bytes, &password)?;

    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, encrypted)?;
    workspaces.write_manifest(&workspace_id, &manifest)?;
    Ok(())
}

#[tauri::command]
pub fn collect_content_asset_refs(content: String) -> Vec<String> {
    let mut refs: Vec<String> = asset_refs::collect_asset_references(&content)
        .into_iter()
        .collect();
    refs.sort();
    refs
}

#[tauri::command]
pub fn read_file_base64(path: String) -> Result<String, AppError> {
    let bytes = fs::read(path)?;
    Ok(BASE64.encode(bytes))
}

#[tauri::command]
pub fn extract_video_thumbnail_base64(
    app: AppHandle,
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
    relative_path: String,
    ffmpeg_path: Option<String>,
) -> Result<String, AppError> {
    let source = workspaces.resolve_asset_path(&workspace_id, &relative_path)?;
    let bytes = media_preview::extract_video_thumbnail_bytes(
        &app,
        ffmpeg_path.as_deref().filter(|value| !value.trim().is_empty()),
        &source,
    )?;
    Ok(BASE64.encode(bytes))
}

#[tauri::command]
pub async fn export_html_to_pdf(
    app: AppHandle,
    output_path: String,
    html: String,
) -> Result<(), AppError> {
    let app = app.clone();
    let output = PathBuf::from(output_path);

    tauri::async_runtime::spawn_blocking(move || {
        let (tx, rx) = std::sync::mpsc::sync_channel(1);
        let app_for_thread = app.clone();
        app.run_on_main_thread(move || {
            let result = pdf_export::export_html_to_pdf(&app_for_thread, &html, &output);
            let _ = tx.send(result);
        })
        .map_err(|error| AppError::Other(error.to_string()))?;
        rx.recv()
            .map_err(|_| AppError::Other("PDF 导出任务中断".to_string()))?
    })
    .await
    .map_err(|error| AppError::Other(format!("PDF 导出失败: {error}")))?
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
