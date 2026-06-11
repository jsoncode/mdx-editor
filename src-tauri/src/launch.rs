use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};

pub struct LaunchState {
    pending_file: Mutex<Option<String>>,
}

impl LaunchState {
    pub fn new() -> Self {
        Self {
            pending_file: Mutex::new(None),
        }
    }

    pub fn set_pending(&self, path: String) {
        *self.pending_file.lock().unwrap() = Some(path);
    }

    pub fn take_pending(&self) -> Option<String> {
        self.pending_file.lock().unwrap().take()
    }
}

pub fn is_mdx_path(path: &str) -> bool {
    path.to_lowercase().ends_with(".mdx")
}

fn parse_path_arg(arg: &str) -> String {
    let trimmed = arg.trim().trim_matches('"');
    if let Ok(url) = url::Url::parse(trimmed) {
        if let Ok(path) = url.to_file_path() {
            return path.to_string_lossy().to_string();
        }
    }
    trimmed.to_string()
}

pub fn collect_mdx_paths_from_args<I>(args: I) -> Vec<String>
where
    I: IntoIterator<Item = String>,
{
    let mut paths = Vec::new();
    for maybe_file in args {
        if maybe_file.starts_with('-') {
            continue;
        }
        let path = parse_path_arg(&maybe_file);
        if is_mdx_path(&path) {
            paths.push(path);
        }
    }
    paths
}

pub fn handle_open_files(app: &AppHandle, paths: Vec<String>, notify_frontend: bool) {
    let mdx_paths: Vec<String> = paths.into_iter().filter(|p| is_mdx_path(p)).collect();
    let Some(path) = mdx_paths.into_iter().next() else {
        focus_main_window(app);
        return;
    };

    let launch_state = app.state::<LaunchState>();
    launch_state.set_pending(path.clone());

    if notify_frontend {
        let _ = app.emit("open-document", path);
    }

    focus_main_window(app);
}

fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[allow(dead_code)]
pub fn paths_from_opened_urls(urls: Vec<url::Url>) -> Vec<String> {
    urls.into_iter()
        .filter_map(|url| url.to_file_path().ok())
        .map(|path: PathBuf| path.to_string_lossy().to_string())
        .filter(|path| is_mdx_path(path))
        .collect()
}
