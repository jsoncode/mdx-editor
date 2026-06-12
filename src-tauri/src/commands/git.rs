use std::path::PathBuf;

use crate::error::AppResult;
use crate::git_sync::{self, GitPullResult, GitSyncConfig, GitSyncStatus};
use crate::git_sync::spawn_detached_push;

#[tauri::command]
pub fn git_sync_pull(vault_path: String, config: GitSyncConfig) -> AppResult<GitPullResult> {
    git_sync::pull(PathBuf::from(vault_path).as_path(), &config)
}

#[tauri::command]
pub fn git_sync_push(
    vault_path: String,
    config: GitSyncConfig,
    commit_message: Option<String>,
) -> AppResult<()> {
    let path = PathBuf::from(vault_path);
    let message = commit_message.unwrap_or_else(|| config.build_commit_message(None));
    spawn_detached_push(path.as_path(), &config, &message)
}

#[tauri::command]
pub fn git_sync_test(vault_path: String, config: GitSyncConfig) -> AppResult<String> {
    git_sync::test_connection(PathBuf::from(vault_path).as_path(), &config)
}

#[tauri::command]
pub fn git_sync_status(vault_path: String, config: GitSyncConfig) -> AppResult<GitSyncStatus> {
    git_sync::status(PathBuf::from(vault_path).as_path(), &config)
}
