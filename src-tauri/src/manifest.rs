use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoLocation {
    pub latitude: f64,
    pub longitude: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accuracy: Option<f64>,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub os: String,
    pub arch: String,
    pub hostname: String,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub format_version: String,
    pub title: String,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_info: Option<DeviceInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<GeoLocation>,
}

impl Default for Manifest {
    fn default() -> Self {
        let now = Utc::now();
        Self {
            format_version: "1.0".to_string(),
            title: "未命名文档".to_string(),
            created_at: now,
            modified_at: now,
            device_info: None,
            location: None,
        }
    }
}

impl Manifest {
    pub fn touch(&mut self) {
        self.modified_at = Utc::now();
    }

    pub fn apply_metadata(
        &mut self,
        record_device: bool,
        record_location: bool,
        location: Option<GeoLocationInput>,
    ) {
        self.touch();

        if record_device {
            self.device_info = Some(collect_device_info());
        } else {
            self.device_info = None;
        }

        if record_location {
            self.location = location.map(|input| GeoLocation {
                latitude: input.latitude,
                longitude: input.longitude,
                accuracy: input.accuracy,
                recorded_at: Utc::now(),
            });
        } else {
            self.location = None;
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeoLocationInput {
    pub latitude: f64,
    pub longitude: f64,
    pub accuracy: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentMetadataInput {
    pub record_device: bool,
    pub record_location: bool,
    pub location: Option<GeoLocationInput>,
}

pub fn collect_device_info() -> DeviceInfo {
    DeviceInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        hostname: std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .unwrap_or_else(|_| "unknown".to_string()),
        recorded_at: Utc::now(),
    }
}
