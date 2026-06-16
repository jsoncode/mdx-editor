use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::asset_store::store_asset_from_path;
use crate::error::{AppError, AppResult};
use crate::media_preview::{is_direct_playable, probe_has_video_stream, target_extension, transcode_media_to_file};
use crate::workspace::{
    extension_from_path, is_image_ext, is_video_ext, markdown_snippet_for_asset, WorkspaceManager,
};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaTranscodeProgressPayload {
    pub job_id: String,
    pub file_name: String,
    pub phase: String,
    pub percent: Option<u8>,
    pub message: Option<String>,
}

fn emit_progress(app: &AppHandle, payload: MediaTranscodeProgressPayload) {
    let _ = app.emit("media-transcode-progress", payload);
}

fn file_name_from_path(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("media")
        .to_string()
}

fn is_blocked_non_media_ext(ext: &str) -> bool {
    matches!(
        ext,
        "md" | "mdx" | "txt" | "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "zip"
            | "rar" | "7z" | "exe" | "dll" | "html" | "htm" | "css" | "js" | "json" | "xml"
    )
}

fn needs_transcode(ext: &str) -> bool {
    !(is_direct_playable(ext) || is_image_ext(ext) || is_blocked_non_media_ext(ext))
}

fn snippet_for_source(
    relative_path: &str,
    source_ext: &str,
    display_name: Option<&str>,
) -> String {
    let output_ext = if needs_transcode(source_ext) {
        target_extension(source_ext)
    } else {
        source_ext
    };
    markdown_snippet_for_asset(relative_path, output_ext, display_name)
}

fn snippet_for_transcoded_output(
    relative_path: &str,
    output_path: &Path,
    source_ext: &str,
    display_name: Option<&str>,
    app: &AppHandle,
    user_path: Option<&str>,
) -> String {
    let has_video = probe_has_video_stream(app, user_path, output_path)
        .unwrap_or_else(|| is_video_ext(source_ext));
    let snippet_ext = if has_video { "mp4" } else { "m4a" };
    markdown_snippet_for_asset(relative_path, snippet_ext, display_name)
}

pub fn insert_media_from_path(
    app: &AppHandle,
    workspaces: &WorkspaceManager,
    workspace_id: &str,
    source_path: &Path,
    user_path: Option<&str>,
    job_id: &str,
) -> AppResult<String> {
    if !source_path.is_file() {
        return Err(AppError::Other(format!(
            "源文件不存在: {}",
            source_path.display()
        )));
    }

    let file_name = file_name_from_path(source_path);
    let ext = extension_from_path(source_path);
    let display_name = file_name.clone();
    let asset_dir = workspaces.asset_dir(workspace_id)?;

    emit_progress(
        app,
        MediaTranscodeProgressPayload {
            job_id: job_id.to_string(),
            file_name: file_name.clone(),
            phase: "starting".to_string(),
            percent: None,
            message: Some("准备插入…".to_string()),
        },
    );

    if !needs_transcode(&ext) {
        let relative_path = store_asset_from_path(&asset_dir, source_path)?;
        emit_progress(
            app,
            MediaTranscodeProgressPayload {
                job_id: job_id.to_string(),
                file_name,
                phase: "done".to_string(),
                percent: Some(100),
                message: Some("已插入".to_string()),
            },
        );
        return Ok(snippet_for_source(
            &relative_path,
            &ext,
            Some(&display_name),
        ));
    }

    if let Err(error) = crate::media_preview::ensure_ffmpeg_ready_for_transcode(app, user_path) {
        let message = error.to_string();
        emit_progress(
            app,
            MediaTranscodeProgressPayload {
                job_id: job_id.to_string(),
                file_name: file_name.clone(),
                phase: "error".to_string(),
                percent: None,
                message: Some(message.clone()),
            },
        );
        return Err(error);
    }

    let out_ext = target_extension(&ext);
    let temp_output = std::env::temp_dir().join(format!(
        "mdx-transcode-{}-{}.{}",
        job_id,
        Uuid::new_v4(),
        out_ext
    ));

    let progress_job_id = job_id.to_string();
    let progress_file_name = file_name.clone();
    let app_for_progress = app.clone();
    if let Err(error) = transcode_media_to_file(
        app,
        user_path,
        source_path,
        &temp_output,
        &ext,
        move |update| {
            emit_progress(
                &app_for_progress,
                MediaTranscodeProgressPayload {
                    job_id: progress_job_id.clone(),
                    file_name: progress_file_name.clone(),
                    phase: "transcoding".to_string(),
                    percent: update.percent,
                    message: Some(update.message),
                },
            );
        },
    ) {
        emit_progress(
            app,
            MediaTranscodeProgressPayload {
                job_id: job_id.to_string(),
                file_name: file_name.clone(),
                phase: "error".to_string(),
                percent: None,
                message: Some(error.to_string()),
            },
        );
        let _ = fs::remove_file(&temp_output);
        return Err(error);
    }

    emit_progress(
        app,
        MediaTranscodeProgressPayload {
            job_id: job_id.to_string(),
            file_name: file_name.clone(),
            phase: "saving".to_string(),
            percent: Some(99),
            message: Some("正在写入资源…".to_string()),
        },
    );

    let relative_path = store_asset_from_path(&asset_dir, &temp_output)?;
    let snippet = snippet_for_transcoded_output(
        &relative_path,
        &temp_output,
        &ext,
        Some(&display_name),
        app,
        user_path,
    );
    let _ = fs::remove_file(&temp_output);

    emit_progress(
        app,
        MediaTranscodeProgressPayload {
            job_id: job_id.to_string(),
            file_name,
            phase: "done".to_string(),
            percent: Some(100),
            message: Some("转码完成".to_string()),
        },
    );

    Ok(snippet)
}

pub fn insert_media_from_bytes(
    app: &AppHandle,
    workspaces: &WorkspaceManager,
    workspace_id: &str,
    filename: &str,
    bytes: &[u8],
    user_path: Option<&str>,
    job_id: &str,
) -> AppResult<String> {
    let temp_source = std::env::temp_dir().join(format!(
        "mdx-source-{}-{}",
        job_id,
        PathBuf::from(filename)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("media.bin")
    ));
    fs::write(&temp_source, bytes)?;
    let result = insert_media_from_path(
        app,
        workspaces,
        workspace_id,
        &temp_source,
        user_path,
        job_id,
    );
    let _ = fs::remove_file(&temp_source);
    result
}
