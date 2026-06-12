use std::fs;
use std::path::{Path, PathBuf};

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
