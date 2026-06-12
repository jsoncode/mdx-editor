use chrono::Local;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

static LOG_DIR: Mutex<Option<PathBuf>> = Mutex::new(None);

fn log_dir() -> Option<PathBuf> {
    LOG_DIR.lock().ok()?.clone()
}

fn log_file_path(dir: &Path) -> PathBuf {
    let date = Local::now().format("%Y-%m-%d");
    dir.join(format!("mdx-editor-{date}.log"))
}

fn append_line(line: &str) {
    let Some(dir) = log_dir() else {
        eprintln!("{line}");
        return;
    };

    let path = log_file_path(&dir);
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(file, "{line}");
    } else {
        eprintln!("{line}");
    }
}

pub fn init(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    if let Ok(mut guard) = LOG_DIR.lock() {
        *guard = Some(dir.clone());
    }

    log(
        "rust",
        "info",
        "app_start",
        &format!(
            "pid={} version={} log_dir={}",
            std::process::id(),
            env!("CARGO_PKG_VERSION"),
            dir.display()
        ),
    );

    Ok(dir)
}

pub fn install_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        log(
            "rust",
            "fatal",
            "panic",
            &format!("{info}"),
        );
    }));
}

pub fn log(category: &str, level: &str, event: &str, detail: &str) {
    let timestamp = Local::now().format("%Y-%m-%dT%H:%M:%S%.3f%:z");
    let line = format!("{timestamp} [{level}][{category}] {event} {detail}");
    append_line(&line);
}

#[tauri::command]
pub fn diagnostic_log(category: String, level: String, event: String, detail: String) {
    log(&category, &level, &event, &detail);
}

#[tauri::command]
pub fn get_diagnostic_log_dir(app: AppHandle) -> Result<String, String> {
    if let Some(dir) = log_dir() {
        return Ok(dir.to_string_lossy().to_string());
    }
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|error| error.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_diagnostic_log_tail(lines: Option<usize>) -> Result<String, String> {
    let Some(dir) = log_dir() else {
        return Ok(String::new());
    };
    let path = log_file_path(&dir);
    if !path.exists() {
        return Ok(String::new());
    }

    let text = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let keep = lines.unwrap_or(80).max(1);
    let tail: Vec<&str> = text.lines().collect();
    let start = tail.len().saturating_sub(keep);
    Ok(tail[start..].join("\n"))
}

#[tauri::command]
pub fn open_diagnostic_log_dir(app: AppHandle) -> Result<(), String> {
    let dir = if let Some(dir) = log_dir() {
        dir
    } else {
        app.path()
            .app_log_dir()
            .map_err(|error| error.to_string())?
    };
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    open_path_in_explorer(&dir)
}

fn open_path_in_explorer(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", unix)))]
    {
        let _ = path;
        Err("Unsupported platform".to_string())
    }
}
