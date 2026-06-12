use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::media_preview;
use crate::workspace::WorkspaceManager;

#[tauri::command]
pub async fn resolve_media_preview(
    app: AppHandle,
    workspaces: State<'_, WorkspaceManager>,
    workspace_id: String,
    relative_path: String,
    ffmpeg_path: Option<String>,
) -> Result<String, AppError> {
    let absolute = workspaces.resolve_asset_path(&workspace_id, &relative_path)?;
    let app = app.clone();
    let ffmpeg_path = ffmpeg_path.filter(|value| !value.trim().is_empty());
    let preview = tauri::async_runtime::spawn_blocking(move || {
        media_preview::resolve_preview_path(
            &app,
            ffmpeg_path.as_deref(),
            &absolute,
        )
    })
    .await
    .map_err(|e| AppError::Other(format!("转码任务失败: {e}")))??;

    Ok(preview.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_ffmpeg_status(app: AppHandle, ffmpeg_path: Option<String>) -> Result<media_preview::FfmpegStatus, AppError> {
    Ok(media_preview::get_ffmpeg_status(
        &app,
        ffmpeg_path.as_deref().filter(|value| !value.trim().is_empty()),
    ))
}

#[tauri::command]
pub fn ffmpeg_available(app: AppHandle, ffmpeg_path: Option<String>) -> Result<bool, AppError> {
    Ok(media_preview::ffmpeg_available(
        &app,
        ffmpeg_path.as_deref().filter(|value| !value.trim().is_empty()),
    ))
}

#[tauri::command]
pub fn test_ffmpeg(app: AppHandle, ffmpeg_path: Option<String>) -> Result<String, AppError> {
    media_preview::test_ffmpeg(
        &app,
        ffmpeg_path.as_deref().filter(|value| !value.trim().is_empty()),
    )
}
