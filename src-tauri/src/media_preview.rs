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
    pub version_line: Option<String>,
    pub major_version: Option<u32>,
    pub version_supported: bool,
    pub version_hint: Option<String>,
}

pub const FFMPEG_MIN_MAJOR_VERSION: u32 = 4;

fn probe_ffmpeg_version_line(app: &AppHandle, user_path: Option<&str>) -> Option<String> {
    let mut cmd = build_ffmpeg_command(app, user_path).ok()?;
    cmd.arg("-version")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let output = cmd.output().ok()?;
    let combined = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    combined
        .lines()
        .find(|line| {
            let lower = line.to_lowercase();
            lower.contains("ffmpeg version")
        })
        .map(|line| line.trim().to_string())
}

fn parse_ffmpeg_major_version(version_line: &str) -> Option<u32> {
    let lower = version_line.to_lowercase();
    let marker = "ffmpeg version";
    let idx = lower.find(marker)?;
    let rest = version_line[idx + marker.len()..].trim();
    let token = rest.split_whitespace().next()?;
    if token.starts_with('N') || token.starts_with('n') {
        return Some(7);
    }
    token.split('.').next()?.parse().ok()
}

fn evaluate_ffmpeg_version(major: Option<u32>) -> (bool, Option<String>) {
    match major {
        None => (
            true,
            Some("无法识别 FFmpeg 版本号，请点击「测试 FFmpeg」确认是否可用。".to_string()),
        ),
        Some(m) if m < FFMPEG_MIN_MAJOR_VERSION => (
            false,
            Some(format!(
                "当前主版本 {m}.x 低于最低要求 {FFMPEG_MIN_MAJOR_VERSION}.0，媒体转码可能失败，请升级 FFmpeg。"
            )),
        ),
        Some(4) => (
            true,
            Some("4.x 可用；建议升级至 5.x 或更高，以获得更好的无损 / DSD 格式支持。".to_string()),
        ),
        Some(5..=8) => (true, None),
        Some(m) => (
            true,
            Some(format!(
                "检测到 FFmpeg {m}.x；若转码异常，请尝试 5.x–7.x 稳定版。"
            )),
        ),
    }
}

fn ffmpeg_error(title: &str, reason: &str, solutions: &[&str]) -> AppError {
    let mut message = format!("{title}\n\n原因：{reason}");
    if !solutions.is_empty() {
        message.push_str("\n\n解决方案：");
        for (index, solution) in solutions.iter().enumerate() {
            message.push_str(&format!("\n{}. {}", index + 1, solution));
        }
    }
    AppError::Other(message)
}

const FFMPEG_UPGRADE_SOLUTIONS: &[&str] = &[
    "升级至 FFmpeg 4.0 及以上（推荐 5.x / 6.x / 7.x 稳定版）",
    "在「设置 → 媒体预览」中指定新版本 FFmpeg 路径",
    "点击「测试 FFmpeg」确认版本与编码器可用",
];

const FFMPEG_FULL_BUILD_SOLUTIONS: &[&str] = &[
    "安装包含 libx264 与 AAC 的完整版 FFmpeg（非 minimal 精简构建）",
    "Windows 可参考 gyan.dev 或 BtbN 的 full / gpl 构建",
    "在「设置 → 媒体预览」中指定完整版 ffmpeg 路径",
];

fn list_ffmpeg_encoders(app: &AppHandle, user_path: Option<&str>) -> AppResult<String> {
    let mut cmd = build_ffmpeg_command(app, user_path)?;
    cmd.args(["-hide_banner", "-encoders"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let output = cmd.output().map_err(AppError::Io)?;
    Ok(format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    ))
}

fn encoder_listed(encoders: &str, name: &str) -> bool {
    encoders.lines().any(|line| {
        line.split_whitespace()
            .any(|token| token.eq_ignore_ascii_case(name))
    })
}

pub fn ensure_ffmpeg_ready(app: &AppHandle, user_path: Option<&str>) -> AppResult<()> {
    let status = get_ffmpeg_status(app, user_path);
    if !status.available {
        return Err(ffmpeg_error(
            "未找到 FFmpeg",
            "系统 PATH 与内置 FFmpeg 均未检测到可用程序。",
            &[
                "安装 FFmpeg 4.0 及以上并加入系统 PATH",
                "或在「设置 → 媒体预览」中手动指定 ffmpeg 可执行文件路径",
                "配置后点击「测试 FFmpeg」确认可用",
            ],
        ));
    }
    if !status.version_supported {
        let version_info = status
            .version_line
            .as_deref()
            .unwrap_or("未知版本");
        let reason = status
            .version_hint
            .map(|hint| format!("{version_info}。{hint}"))
            .unwrap_or_else(|| version_info.to_string());
        return Err(ffmpeg_error(
            "FFmpeg 版本不受支持",
            &reason,
            FFMPEG_UPGRADE_SOLUTIONS,
        ));
    }
    Ok(())
}

pub fn ensure_ffmpeg_ready_for_transcode(app: &AppHandle, user_path: Option<&str>) -> AppResult<()> {
    ensure_ffmpeg_ready(app, user_path)?;
    let encoders = list_ffmpeg_encoders(app, user_path)?;
    let mut missing = Vec::new();
    if !encoder_listed(&encoders, "libx264") {
        missing.push("libx264（H.264 视频编码器）");
    }
    if !encoder_listed(&encoders, "aac") {
        missing.push("aac（AAC 音频编码器）");
    }
    if !missing.is_empty() {
        return Err(ffmpeg_error(
            "FFmpeg 缺少转码所需编码器",
            &format!("当前 FFmpeg 未启用：{}", missing.join("、")),
            FFMPEG_FULL_BUILD_SOLUTIONS,
        ));
    }
    Ok(())
}

fn extract_stderr_summary(stderr: &str) -> String {
    let lines: Vec<&str> = stderr
        .lines()
        .map(str::trim)
        .filter(|line| {
            !line.is_empty()
                && !line.starts_with("frame=")
                && !line.contains("time=")
                && !line.starts_with("size=")
                && !line.starts_with("bitrate=")
                && !line.starts_with("speed=")
        })
        .collect();
    if lines.is_empty() {
        return "FFmpeg 未返回详细错误信息。".to_string();
    }
    lines
        .iter()
        .rev()
        .take(3)
        .rev()
        .copied()
        .collect::<Vec<_>>()
        .join(" ")
}

fn diagnose_ffmpeg_stderr(stderr: &str, source_ext: &str) -> AppError {
    let lower = stderr.to_lowercase();

    if lower.contains("unknown encoder 'libx264'")
        || lower.contains("encoder libx264 not found")
        || lower.contains("unknown encoder libx264")
    {
        return ffmpeg_error(
            "FFmpeg 缺少 libx264 编码器",
            "视频转码需要 libx264，但当前 FFmpeg 构建未包含该编码器。",
            FFMPEG_FULL_BUILD_SOLUTIONS,
        );
    }

    if lower.contains("unknown encoder 'aac'") || lower.contains("unknown encoder aac") {
        return ffmpeg_error(
            "FFmpeg 缺少 AAC 编码器",
            "音频转码需要 AAC 编码器，但当前 FFmpeg 构建未包含该编码器。",
            FFMPEG_FULL_BUILD_SOLUTIONS,
        );
    }

    if lower.contains("unrecognized option")
        || lower.contains("option not found")
        || lower.contains("invalid argument")
            && (lower.contains("map") || lower.contains("preset") || lower.contains("crf"))
    {
        return ffmpeg_error(
            "FFmpeg 版本过旧",
            "转码命令使用了当前 FFmpeg 不支持的参数，通常是版本低于 4.0 导致。",
            FFMPEG_UPGRADE_SOLUTIONS,
        );
    }

    if (lower.contains("decoder") || lower.contains("codec"))
        && (lower.contains("not found") || lower.contains("unknown") || lower.contains("unsupported"))
    {
        return ffmpeg_error(
            "无法解码该媒体格式",
            &format!(
                "FFmpeg 无法解码此 .{source_ext} 文件，可能格式损坏、加密，或当前 FFmpeg 缺少对应解码器。"
            ),
            &[
                "确认文件可在其他播放器中正常播放",
                "尝试升级 FFmpeg 至 5.x 或更高",
                "在「设置 → 媒体预览」中点击「测试 FFmpeg」检查配置",
            ],
        );
    }

    if lower.contains("does not contain any stream")
        || lower.contains("no stream")
        || lower.contains("at least one output file must be specified")
    {
        return ffmpeg_error(
            "媒体文件不含可用音/视频流",
            &format!("FFmpeg 在 .{source_ext} 文件中未找到可转码的音视频流。"),
            &[
                "确认文件未损坏且含有音轨或视频轨",
                "尝试用其他工具重新封装或导出该媒体",
            ],
        );
    }

    if lower.contains("invalid data")
        || lower.contains("could not find codec parameters")
        || lower.contains("error while decoding")
    {
        return ffmpeg_error(
            "媒体文件损坏或格式异常",
            &format!("FFmpeg 读取 .{source_ext} 时失败：{}", extract_stderr_summary(stderr)),
            &[
                "确认源文件完整且可在其他播放器中打开",
                "若仅本应用失败，尝试升级 FFmpeg 或更换转码源文件",
            ],
        );
    }

    if lower.contains("permission denied") {
        return ffmpeg_error(
            "FFmpeg 无权限访问文件",
            &extract_stderr_summary(stderr),
            &[
                "确认源文件未被其他程序独占占用",
                "检查文件与输出目录的读写权限",
            ],
        );
    }

    ffmpeg_error(
        "FFmpeg 转码失败",
        &extract_stderr_summary(stderr),
        &[
            "在「设置 → 媒体预览」中点击「测试 FFmpeg」检查版本与编码器",
            "确认 FFmpeg 为 4.0 及以上且包含 libx264 / AAC",
            "若问题持续，尝试更换 FFmpeg 或检查源文件是否损坏",
        ],
    )
}

fn enrich_ffmpeg_status(
    app: &AppHandle,
    user_path: Option<&str>,
    source: FfmpegSource,
    path: PathBuf,
) -> FfmpegStatus {
    let version_line = probe_ffmpeg_version_line(app, user_path);
    let major_version = version_line
        .as_deref()
        .and_then(parse_ffmpeg_major_version);
    let (version_supported, version_hint) = evaluate_ffmpeg_version(major_version);
    FfmpegStatus {
        available: true,
        source: Some(source.as_str().to_string()),
        path: Some(path.to_string_lossy().to_string()),
        version_line,
        major_version,
        version_supported,
        version_hint,
    }
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
    } else if is_audio_ext(source_ext) {
        "m4a"
    } else {
        // 未识别的容器默认转为 MP4，FFmpeg 可处理纯音频流
        "mp4"
    }
}

pub fn target_extension(source_ext: &str) -> &'static str {
    output_extension(source_ext)
}

fn ffprobe_executable(ffmpeg_executable: &Path) -> PathBuf {
    let file_name = if cfg!(windows) {
        "ffprobe.exe"
    } else {
        "ffprobe"
    };
    ffmpeg_executable
        .parent()
        .map(|dir| dir.join(file_name))
        .unwrap_or_else(|| PathBuf::from(file_name))
}

fn needs_deep_probe(source_ext: &str) -> bool {
    matches!(
        source_ext,
        "vob" | "mpg" | "mpeg" | "ts" | "m2ts" | "mts" | "rmvb" | "asf" | "dsf" | "dff"
    )
}

fn is_dsd_ext(ext: &str) -> bool {
    matches!(ext, "dsf" | "dff")
}

fn is_lossless_audio_ext(ext: &str) -> bool {
    matches!(
        ext,
        "wav" | "flac" | "aiff" | "aif" | "alac" | "dsf" | "dff" | "ape" | "mac" | "tta" | "wv"
            | "tak" | "ofr" | "ofs" | "shn" | "mpc" | "mpp" | "caf"
    )
}

fn audio_transcode_bitrate(source_ext: &str) -> &'static str {
    if is_lossless_audio_ext(source_ext) {
        "256k"
    } else {
        "192k"
    }
}

pub fn probe_has_video_stream(
    app: &AppHandle,
    user_path: Option<&str>,
    source: &Path,
) -> Option<bool> {
    let (_, ffmpeg_path) = locate_ffmpeg(app, user_path).ok()?;
    let ffprobe = ffprobe_executable(&ffmpeg_path);
    if !ffprobe.is_file() {
        return None;
    }
    let mut cmd = Command::new(&ffprobe);
    prepare_ffmpeg_command(&mut cmd, &ffprobe);
    cmd.args([
        "-v",
        "error",
        "-probesize",
        "100M",
        "-analyzeduration",
        "100M",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "csv=p=0",
    ])
    .arg(source)
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());
    let output = cmd.output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    Some(
        text.lines()
            .any(|line| line.trim().eq_ignore_ascii_case("video")),
    )
}

pub fn probe_media_duration(
    app: &AppHandle,
    user_path: Option<&str>,
    source: &Path,
) -> Option<f64> {
    let (_, ffmpeg_path) = locate_ffmpeg(app, user_path).ok()?;
    let ffprobe = ffprobe_executable(&ffmpeg_path);
    if !ffprobe.is_file() {
        return None;
    }
    let mut cmd = Command::new(&ffprobe);
    prepare_ffmpeg_command(&mut cmd, &ffprobe);
    cmd.args([
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
    ])
    .arg(source)
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::null());
    let output = cmd.output().ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse::<f64>()
        .ok()
        .filter(|value| *value > 0.0)
}

fn parse_ffmpeg_timestamp(raw: &str) -> Option<f64> {
    let parts: Vec<&str> = raw.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    let hours: f64 = parts[0].parse().ok()?;
    let minutes: f64 = parts[1].parse().ok()?;
    let seconds: f64 = parts[2].parse().ok()?;
    Some(hours * 3600.0 + minutes * 60.0 + seconds)
}

fn parse_ffmpeg_time_seconds(line: &str) -> Option<f64> {
    let marker = "time=";
    let idx = line.find(marker)?;
    let rest = line[idx + marker.len()..].trim();
    let token = rest.split_whitespace().next()?;
    parse_ffmpeg_timestamp(token)
}

pub struct TranscodeProgressUpdate {
    pub percent: Option<u8>,
    pub message: String,
}

pub fn transcode_media_to_file(
    app: &AppHandle,
    user_path: Option<&str>,
    source: &Path,
    output: &Path,
    source_ext: &str,
    mut on_progress: impl FnMut(TranscodeProgressUpdate),
) -> AppResult<()> {
    ensure_ffmpeg_ready_for_transcode(app, user_path)?;

    on_progress(TranscodeProgressUpdate {
        percent: None,
        message: "正在分析媒体…".to_string(),
    });

    let duration = probe_media_duration(app, user_path, source);

    on_progress(TranscodeProgressUpdate {
        percent: Some(0),
        message: "正在转码…".to_string(),
    });

    let treat_as_video = if is_video_ext(source_ext) {
        true
    } else if is_audio_ext(source_ext) {
        false
    } else {
        probe_has_video_stream(app, user_path, source).unwrap_or(true)
    };

    let mut cmd = build_ffmpeg_command(app, user_path)?;
    cmd.args(["-hide_banner", "-loglevel", "info", "-y"]);
    if needs_deep_probe(source_ext) {
        cmd.args(["-probesize", "100M", "-analyzeduration", "100M"]);
    }
    if is_dsd_ext(source_ext) {
        cmd.args(["-fflags", "+genpts+igndts"]);
    }
    cmd.arg("-i").arg(source).arg("-threads").arg("0");

    if treat_as_video {
        cmd.args([
            "-map",
            "0:v:0?",
            "-map",
            "0:a:0?",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
        ]);
    } else {
        let bitrate = audio_transcode_bitrate(source_ext);
        cmd.args(["-vn", "-map", "0:a:0?"]);
        if is_dsd_ext(source_ext) {
            cmd.arg("-ar").arg("44100");
        }
        cmd.args(["-c:a", "aac", "-b:a", bitrate]);
    }

    cmd.args(["-movflags", "+faststart"])
        .arg(output)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(AppError::Io)?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| AppError::Other("无法读取 FFmpeg 输出".to_string()))?;

    let reader = std::io::BufReader::new(stderr);
    use std::io::BufRead;
    let mut stderr_log = String::new();
    for line in reader.lines() {
        let line = line.map_err(AppError::Io)?;
        stderr_log.push_str(&line);
        stderr_log.push('\n');
        if let Some(current) = parse_ffmpeg_time_seconds(&line) {
            let percent = duration.map(|total| {
                ((current / total) * 100.0).clamp(0.0, 99.0) as u8
            });
            on_progress(TranscodeProgressUpdate {
                percent,
                message: "正在转码…".to_string(),
            });
        }
    }

    let status = child.wait().map_err(AppError::Io)?;
    if !status.success() {
        return Err(diagnose_ffmpeg_stderr(&stderr_log, source_ext));
    }

    if !output.is_file() {
        return Err(AppError::Other("FFmpeg 未生成输出文件".to_string()));
    }

    on_progress(TranscodeProgressUpdate {
        percent: Some(100),
        message: "转码完成".to_string(),
    });
    Ok(())
}

fn run_ffmpeg_transcode(
    app: &AppHandle,
    user_path: Option<&str>,
    source: &Path,
    output: &Path,
    source_ext: &str,
) -> AppResult<()> {
    transcode_media_to_file(app, user_path, source, output, source_ext, |_| {})
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

    ensure_ffmpeg_ready_for_transcode(app, user_path)?;
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
        Ok((source, path)) => enrich_ffmpeg_status(app, user_path, source, path),
        Err(_) => FfmpegStatus {
            available: false,
            source: None,
            path: None,
            version_line: None,
            major_version: None,
            version_supported: false,
            version_hint: None,
        },
    }
}

pub fn validate_ffmpeg_for_transcode(app: &AppHandle, user_path: Option<&str>) -> AppResult<()> {
    ensure_ffmpeg_ready_for_transcode(app, user_path)
}

pub fn test_ffmpeg(app: &AppHandle, user_path: Option<&str>) -> AppResult<String> {
    validate_ffmpeg_for_transcode(app, user_path)?;
    let status = get_ffmpeg_status(app, user_path);
    let version_line = status
        .version_line
        .unwrap_or_else(|| "FFmpeg 可用".to_string());
    if let Some(hint) = status.version_hint {
        Ok(format!(
            "{version_line}\n\n{hint}\n\n已验证 libx264 与 AAC 编码器可用。"
        ))
    } else {
        Ok(format!("{version_line}\n\n已验证 libx264 与 AAC 编码器可用。"))
    }
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

    #[test]
    fn parse_ffmpeg_major_version_handles_stable_and_git_builds() {
        assert_eq!(
            parse_ffmpeg_major_version("ffmpeg version 6.1.1 Copyright"),
            Some(6)
        );
        assert_eq!(
            parse_ffmpeg_major_version("ffmpeg version 4.4.2-0ubuntu0.22.04.1"),
            Some(4)
        );
        assert_eq!(
            parse_ffmpeg_major_version("ffmpeg version N-92689-g1234567890"),
            Some(7)
        );
        assert_eq!(parse_ffmpeg_major_version("ffmpeg version 3.4.13"), Some(3));
    }

    #[test]
    fn evaluate_ffmpeg_version_marks_old_builds_unsupported() {
        let (supported, _) = evaluate_ffmpeg_version(Some(3));
        assert!(!supported);
        let (supported, hint) = evaluate_ffmpeg_version(Some(4));
        assert!(supported);
        assert!(hint.is_some());
        let (supported, hint) = evaluate_ffmpeg_version(Some(6));
        assert!(supported);
        assert!(hint.is_none());
    }

    #[test]
    fn diagnose_ffmpeg_stderr_maps_missing_encoder() {
        let error = diagnose_ffmpeg_stderr("Unknown encoder 'libx264'", "wmv");
        assert!(error.to_string().contains("缺少 libx264"));
    }

    #[test]
    fn diagnose_ffmpeg_stderr_maps_old_version_options() {
        let error = diagnose_ffmpeg_stderr("Unrecognized option 'preset'", "avi");
        assert!(error.to_string().contains("版本过旧"));
    }
}
