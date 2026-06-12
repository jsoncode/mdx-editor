use std::path::PathBuf;

use tauri::{AppHandle, Emitter};

use crate::error::AppResult;
use crate::git_sync::{self, push_in_process, GitPullResult, GitSyncConfig, GitSyncStatus};

fn is_git_sync_configured(config: &GitSyncConfig) -> bool {
    config.enabled
        && !config.remote_url.trim().is_empty()
        && !config.token.trim().is_empty()
}

#[tauri::command]
pub fn git_sync_pull(vault_path: String, config: GitSyncConfig) -> AppResult<GitPullResult> {
    if !is_git_sync_configured(&config) {
        return Ok(GitPullResult {
            updated: false,
            message: "Git 同步未配置完整".to_string(),
            has_conflicts: false,
        });
    }
    git_sync::pull(PathBuf::from(vault_path).as_path(), &config)
}

#[tauri::command]
pub fn git_sync_push(
    app: AppHandle,
    vault_path: String,
    config: GitSyncConfig,
    commit_message: Option<String>,
) -> AppResult<()> {
    if !is_git_sync_configured(&config) {
        return Ok(());
    }

    let path = PathBuf::from(vault_path);
    let message = commit_message.unwrap_or_else(|| config.build_commit_message(None));

    std::thread::spawn(move || {
        match push_in_process(path.as_path(), &config, &message) {
            Ok(()) => {
                crate::diagnostics::log(
                    "rust",
                    "info",
                    "git_push_ok",
                    &path.to_string_lossy(),
                );
            }
            Err(error) => {
                let detail = error.to_string();
                crate::diagnostics::log("rust", "warn", "git_push_failed", &detail);
                let _ = app.emit("git-push-failed", detail);
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn git_sync_test(vault_path: String, config: GitSyncConfig) -> AppResult<String> {
    git_sync::test_connection(PathBuf::from(vault_path).as_path(), &config)
}

#[tauri::command]
pub fn git_sync_status(vault_path: String, config: GitSyncConfig) -> AppResult<GitSyncStatus> {
    git_sync::status(PathBuf::from(vault_path).as_path(), &config)
}
