use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::git_sync::config::GitSyncConfig;
use crate::git_sync::ops;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitSyncJob {
    pub action: String,
    pub vault_path: String,
    pub config: GitSyncConfig,
    pub commit_message: Option<String>,
}

pub fn try_parse_cli_job(args: &[String]) -> Option<PathBuf> {
    let mut iter = args.iter().skip(1);
    while let Some(arg) = iter.next() {
        if arg == "--git-sync" {
            return iter.next().map(PathBuf::from);
        }
    }
    None
}

pub fn run_job(job_path: &Path) -> AppResult<()> {
    let raw = fs::read_to_string(job_path)?;
    let job: GitSyncJob = serde_json::from_str(&raw)?;
    let vault = PathBuf::from(&job.vault_path);
    match job.action.as_str() {
        "push" => {
            let message = job
                .commit_message
                .unwrap_or_else(|| job.config.build_commit_message(None));
            ops::push_in_process(&vault, &job.config, &message)
        }
        other => Err(AppError::Other(format!("Unknown git sync action: {other}"))),
    }
}

pub fn write_job(job: &GitSyncJob) -> AppResult<PathBuf> {
    let dir = std::env::temp_dir().join("mdx-editor-git-sync");
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("job-{}.json", uuid::Uuid::new_v4()));
    fs::write(&path, serde_json::to_string(job)?)?;
    Ok(path)
}

pub fn spawn_detached_push(
    vault_path: &Path,
    config: &GitSyncConfig,
    commit_message: &str,
) -> AppResult<()> {
    let job = GitSyncJob {
        action: "push".to_string(),
        vault_path: vault_path.to_string_lossy().to_string(),
        config: config.clone(),
        commit_message: Some(commit_message.to_string()),
    };
    let job_path = write_job(&job)?;
    let exe = std::env::current_exe().map_err(AppError::Io)?;
    spawn_detached_process(&exe, &job_path)
}

fn spawn_detached_process(exe: &Path, job_path: &Path) -> AppResult<()> {
    let mut command = Command::new(exe);
    command.arg("--git-sync").arg(job_path);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        command.creation_flags(DETACHED_PROCESS | CREATE_NO_WINDOW);
    }

    command.spawn().map_err(AppError::Io)?;
    Ok(())
}
