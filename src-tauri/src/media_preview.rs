use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

use serde::Serialize;
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

fn ffmpeg_executable_name() -> &'static str {
    #[cfg(windows)]
    {
        "ffmpeg.exe"
    }
    #[cfg(not(windows))]
    {
        "ffmpeg"
    }
}

fn expand_windows_env_var(value: &str) -> String {
    let mut result = value.to_string();
    for _ in 0..16 {
        let Some(start) = result.find('%') else {
            break;
        };
        let rest = &result[start + 1..];
        let Some(end) = rest.find('%') else {
            break;
        };
        if end == 0 {
            break;
        }
        let var_name = &rest[..end];
        let replacement = std::env::var(var_name).unwrap_or_default();
        result = format!("{}{}{}", &result[..start], replacement, &rest[end + 1..]);
    }
    result
}

#[cfg(windows)]
fn read_windows_registry_path() -> Vec<PathBuf> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;

    let mut paths = Vec::new();
    let mut push_var = |value: String| {
        let expanded = expand_windows_env_var(&value);
        paths.extend(std::env::split_paths(&expanded));
    };

    if let Ok(env) = RegKey::predef(HKEY_CURRENT_USER).open_subkey("Environment") {
        if let Ok(path) = env.get_value::<String, _>("Path") {
            push_var(path);
        }
    }
    if let Ok(env) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(
        r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment",
    ) {
        if let Ok(path) = env.get_value::<String, _>("Path") {
            push_var(path);
        }
    }

    paths
}

fn collect_path_directories() -> Vec<PathBuf> {
    let mut seen = std::collections::HashSet::new();
    let mut dirs = Vec::new();

    let mut push_dir = |dir: PathBuf| {
        if dir.as_os_str().is_empty() {
            return;
        }
        if seen.insert(dir.clone()) {
            dirs.push(dir);
        }
    };

    if let Ok(path) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path) {
            push_dir(dir);
        }
    }

    #[cfg(windows)]
    for dir in read_windows_registry_path() {
        push_dir(dir);
    }

    dirs
}

fn find_ffmpeg_in_system_path() -> Option<PathBuf> {
    let name = ffmpeg_executable_name();

    if let Ok(path) = which::which(name) {
        return Some(path);
    }

    let dirs = collect_path_directories();
    if let Ok(path_env) = std::env::join_paths(&dirs) {
        if let Ok(path) = which::which_in(name, Some(path_env), Path::new(".")) {
            return Some(path);
        }
    }

    for dir in dirs {
        let candidate = dir.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    None
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FfmpegSource {
    User,
    SystemPath,
    Sidecar,
}

impl FfmpegSource {
    fn as_str(self) -> &'static str {
        match self {
            Self::User => "user",
            Self::SystemPath => "path",
            Self::Sidecar => "sidecar",
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegStatus {
    pub available: bool,
    pub source: Option<String>,
    pub path: Option<String>,
}

fn locate_ffmpeg(app: &AppHandle, user_path: Option<&str>) -> Result<(FfmpegSource, PathBuf), AppError> {
    if let Some(path) = user_path.and_then(|raw| normalize_user_ffmpeg_path(raw)) {
        return Ok((FfmpegSource::User, path));
    }

    if let Some(path) = find_ffmpeg_in_system_path() {
        return Ok((FfmpegSource::SystemPath, path));
    }

    if bundled_sidecar_command(app).is_some() {
        return Ok((FfmpegSource::Sidecar, PathBuf::from(ffmpeg_executable_name())));
    }

    Err(AppError::Other(
        "未找到 FFmpeg。请安装 FFmpeg 并加入系统 PATH，或在「设置 → 媒体预览」中指定可执行文件路径。"
            .to_string(),
    ))
}

fn prepare_ffmpeg_command(cmd: &mut Command, executable: &Path) {
    if let Some(parent) = executable.parent() {
        if parent.as_os_str().is_empty() {
            return;
        }
        let path_var = std::env::var("PATH").unwrap_or_default();
        let new_path = std::env::join_paths(
            std::iter::once(parent.to_path_buf()).chain(std::env::split_paths(&path_var)),
        );
        if let Ok(path) = new_path {
            cmd.env("PATH", path);
        }
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

fn build_ffmpeg_command(app: &AppHandle, user_path: Option<&str>) -> AppResult<Command> {
    let (source, path) = locate_ffmpeg(app, user_path)?;
    let mut cmd = match source {
        FfmpegSource::Sidecar => bundled_sidecar_command(app)
            .ok_or_else(|| AppError::Other("内置 FFmpeg 不可用".to_string()))?,
        FfmpegSource::User | FfmpegSource::SystemPath => Command::new(&path),
    };
    prepare_ffmpeg_command(&mut cmd, &path);
    Ok(cmd)
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
        "+faststart",
    ])
    .arg(output)
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::piped());

    let result = cmd.output().map_err(AppError::Io)?;
    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        let message = format!("FFmpeg 转码失败: {}", stderr.trim());
        crate::diagnostics::log("rust", "error", "ffmpeg_transcode_failed", &message);
        return Err(AppError::Other(message));
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
    locate_ffmpeg(app, user_path).is_ok()
}

pub fn get_ffmpeg_status(app: &AppHandle, user_path: Option<&str>) -> FfmpegStatus {
    match locate_ffmpeg(app, user_path) {
        Ok((source, path)) => FfmpegStatus {
            available: true,
            source: Some(source.as_str().to_string()),
            path: Some(path.to_string_lossy().to_string()),
        },
        Err(_) => FfmpegStatus {
            available: false,
            source: None,
            path: None,
        },
    }
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
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{stdout}{stderr}");
    let first_line = combined
        .lines()
        .find(|line| line.contains("ffmpeg version") || line.contains("FFmpeg"))
        .unwrap_or("FFmpeg 可用")
        .trim();
    Ok(first_line.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expand_windows_env_var_replaces_program_files() {
        std::env::set_var("MDX_TEST_PROG", "C:\\Program Files\\ffmpeg");
        let expanded = expand_windows_env_var("%MDX_TEST_PROG%\\bin");
        assert_eq!(expanded, "C:\\Program Files\\ffmpeg\\bin");
    }

    #[test]
    fn find_system_ffmpeg_when_installed() {
        if find_ffmpeg_in_system_path().is_none() {
            eprintln!("skip find_system_ffmpeg_when_installed: ffmpeg not on PATH");
            return;
        }
        let path = find_ffmpeg_in_system_path().unwrap();
        assert!(path.is_file(), "expected ffmpeg binary at {}", path.display());
    }
}
