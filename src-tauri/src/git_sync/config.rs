use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitSyncConfig {
    pub enabled: bool,
    pub remote_url: String,
    pub token: String,
    pub branch: String,
    pub author_name: String,
    pub author_email: String,
    pub commit_message_template: String,
}

impl GitSyncConfig {
    pub fn effective_branch(&self) -> String {
        let trimmed = self.branch.trim();
        if trimmed.is_empty() {
            "main".to_string()
        } else {
            trimmed.to_string()
        }
    }

    pub fn build_commit_message(&self, detail: Option<&str>) -> String {
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let mut message = self
            .commit_message_template
            .replace("{{date}}", &now)
            .replace("{{datetime}}", &now);
        if let Some(detail) = detail {
            message = message.replace("{{file}}", detail);
        }
        if message.trim().is_empty() {
            format!("MDX Editor backup: {now}")
        } else {
            message
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitPullResult {
    pub updated: bool,
    pub message: String,
    pub has_conflicts: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitSyncStatus {
    pub initialized: bool,
    pub has_remote: bool,
    pub branch: String,
    pub ahead: i32,
    pub behind: i32,
    pub dirty: bool,
    pub last_error: Option<String>,
}
