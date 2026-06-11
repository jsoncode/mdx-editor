use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub format_version: String,
    pub title: String,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
}

impl Default for Manifest {
    fn default() -> Self {
        let now = Utc::now();
        Self {
            format_version: "1.0".to_string(),
            title: "未命名文档".to_string(),
            created_at: now,
            modified_at: now,
        }
    }
}

impl Manifest {
    pub fn touch(&mut self) {
        self.modified_at = Utc::now();
    }
}
