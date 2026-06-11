use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub format_version: String,
    pub title: String,
    pub created_at: String,
    pub modified_at: String,
}

impl Default for Manifest {
    fn default() -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            format_version: "1.0".to_string(),
            title: "未命名文档".to_string(),
            created_at: now.clone(),
            modified_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentState {
    pub workspace_id: String,
    pub content: String,
    pub manifest: Manifest,
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveResult {
    pub file_path: String,
}
