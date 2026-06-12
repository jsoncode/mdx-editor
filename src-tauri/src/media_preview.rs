use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

use tauri::AppHandle;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

use crate::error::{AppError, AppResult};
use crate::workspace::{extension_from_path, is_audio_ext, is_video_ext};

const CACHE_DIR_NAME: &str = "media-preview-cache";
const SIDECAR_NAME: &str = "binaries/ffmpeg";
const TRANSCODE_WAIT_MS: u64 = 100;
const TRANSCODE_WAIT_ATTEMPTS: u32 = 600;

/// 浏览器可直接播放、无需 FFmpeg 的扩展名
pub fn is_direct_playable(ext: &str) -> bool {
    matches!(
        ext,
        "mp3" | "wav" | "ogg" | "oga" | "opus" | "weba" | "mp4" | "webm" | "m4a" | "flac" | "aac"
    )
}

fn cache_dir(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| AppError::Other(e.to_string()))?
        .join(CACHE_DIR_NAME);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn cache_token(source: &Path) -> AppResult<String> {
    let meta = fs::metadata(source)?;
    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    source.to_string_lossy().hash(&mut hasher);
    meta.len().hash(&mut hasher);
    modified.hash(&mut hasher);
    Ok(format!("{:016x}", hasher.finish()))
}

fn transcode_lock_path(output: &Path) -> PathBuf {
    output.with_extension("transcoding.lock")
}

fn wait_for_cached_output(output: &Path) -> Option<PathBuf> {
    for _ in 0..TRANSCODE_WAIT_ATTEMPTS {
        if output.is_file() {
            return Some(output.to_path_buf());
        }
        thread::sleep(Duration::from_millis(TRANSCODE_WAIT_MS));
    }
    None
}

fn acquire_transcode_lock(output: &Path) -> AppResult<bool> {
    if output.is_file() {
        return Ok(false);
    }

    let lock = transcode_lock_path(output);
    match fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&lock)
    {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            if wait_for_cached_output(output).is_some() {
                let _ = fs::remove_file(&lock);
                return Ok(false);
            }
            Err(AppError::Other(format!(
                "等待其他转码任务超时: {}",
                output.display()
            )))
        }
        Err(error) => Err(AppError::Io(error)),
    }
}

fn release_transcode_lock(output: &Path) {
    let lock = transcode_lock_path(output);
    let _ = fs::remove_file(lock);
}

fn normalize_user_ffmpeg_path(raw: &str) -> Option<PathBuf> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let path = PathBuf::from(trimmed);
    if path.is_file() {
        return Some(path);
    }
    None
}

fn bundled_sidecar_command(app: &AppHandle) -> Option<Command> {
    app.shell()
        .sidecar(SIDECAR_NAME)
        .ok()
        .map(Command::from)
}

fn build_ffmpeg_command(app: &AppHandle, user_path: Option<&str>) -> AppResult<Command> {
    if let Some(path) = user_path.and_then(|raw| normalize_user_ffmpeg_path(raw)) {
        return Ok(Command::new(path));
    }

    if let Some(cmd) = bundled_sidecar_command(app) {
        return Ok(cmd);
    }

    #[cfg(windows)]
    let file_name = "ffmpeg.exe";
    #[cfg(not(windows))]
    let file_name = "ffmpeg";

    if let Ok(path) = which::which(file_name) {
        return Ok(Command::new(path));
    }

    Err(AppError::Other(
        "未找到 FFmpeg。请在「设置 → 媒体预览」中配置 FFmpeg 路径，或确保系统 PATH 中已安装 FFmpeg。"
            .to_string(),
    ))
}

fn output_extension(source_ext: &str) -> &'static str {
    if is_video_ext(source_ext) {
        "mp4"
    } else {
        "m4a"
    }
}

fn run_ffmpeg_transcode(
    app: &AppHandle,
    user_path: Option<&str>,
    source: &Path,
    output: &Path,
    source_ext: &str,
) -> AppResult<()> {
    let mut cmd = build_ffmpeg_command(app, user_path)?;
    cmd.args(["-hide_banner", "-loglevel", "error", "-y", "-i"])
        .arg(source)
        .arg("-threads")
        .arg("0");

    if is_video_ext(source_ext) {
        cmd.args([
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
        ]);
    } else {
        cmd.args(["-vn", "-c:a", "aac", "-b:a", "192k"]);
    }

    cmd.args([
        "-movflags",
        "frag_keyframe+empty_moov+default_base_moof",
        "-f",
        "mp4",
    ])
    .arg(output)
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::piped());

    let result = cmd.output().map_err(AppError::Io)?;
    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(AppError::Other(format!(
            "FFmpeg 转码失败: {}",
            stderr.trim()
        )));
    }

    if !output.is_file() {
        return Err(AppError::Other("FFmpeg 未生成预览文件".to_string()));
    }

    Ok(())
}

pub fn resolve_preview_path(
    app: &AppHandle,
    user_path: Option<&str>,
    source: &Path,
) -> AppResult<PathBuf> {
    if !source.is_file() {
        return Err(AppError::Other(format!(
            "媒体文件不存在: {}",
            source.display()
        )));
    }

    let ext = extension_from_path(source);
    if !is_audio_ext(&ext) && !is_video_ext(&ext) {
        return Ok(source.to_path_buf());
    }

    if is_direct_playable(&ext) {
        return Ok(source.to_path_buf());
    }

    let token = cache_token(source)?;
    let out_ext = output_extension(&ext);
    let cached = cache_dir(app)?.join(format!("{token}.{out_ext}"));

    if cached.is_file() {
        return Ok(cached);
    }

    let should_transcode = acquire_transcode_lock(&cached)?;
    if !should_transcode {
        if cached.is_file() {
            return Ok(cached);
        }
        return wait_for_cached_output(&cached).ok_or_else(|| {
            AppError::Other(format!("转码未完成: {}", cached.display()))
        });
    }

    let transcode_result = run_ffmpeg_transcode(app, user_path, source, &cached, &ext);
    release_transcode_lock(&cached);
    transcode_result?;
    Ok(cached)
}

pub fn ffmpeg_available(app: &AppHandle, user_path: Option<&str>) -> bool {
    build_ffmpeg_command(app, user_path).is_ok()
}

pub fn test_ffmpeg(app: &AppHandle, user_path: Option<&str>) -> AppResult<String> {
    let mut cmd = build_ffmpeg_command(app, user_path)?;
    cmd.arg("-version")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let output = cmd.output().map_err(AppError::Io)?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Other(format!(
            "FFmpeg 测试失败: {}",
            stderr.trim()
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let first_line = stdout.lines().next().unwrap_or("FFmpeg 可用").trim();
    Ok(first_line.to_string())
}
