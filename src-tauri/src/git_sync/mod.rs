mod config;
mod job;
mod ops;

pub use config::{GitPullResult, GitSyncConfig, GitSyncStatus};
pub use job::{run_job, spawn_detached_push, try_parse_cli_job};
pub use ops::{pull, status, test_connection};
