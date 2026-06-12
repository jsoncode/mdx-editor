use std::fs;
use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};
use crate::manifest::Manifest;
use crate::workspace::MANIFEST_FILE;

pub fn manifest_sidecar_path(document_path: &Path) -> PathBuf {
    PathBuf::from(format!("{}.manifest.json", document_path.to_string_lossy()))
}

pub fn import_manifest_sidecar(document_path: &Path, workspace_path: &Path) -> AppResult<Manifest> {
    let sidecar = manifest_sidecar_path(document_path);
    let target = workspace_path.join(MANIFEST_FILE);

    if sidecar.exists() {
        let raw = fs::read_to_string(&sidecar)?;
        let manifest: Manifest = serde_json::from_str(&raw).unwrap_or_default();
        fs::write(&target, serde_json::to_string_pretty(&manifest)?)?;
        return Ok(manifest);
    }

    let manifest = Manifest::default();
    fs::write(&target, serde_json::to_string_pretty(&manifest)?)?;
    Ok(manifest)
}

pub fn export_manifest_sidecar(document_path: &Path, workspace_path: &Path) -> AppResult<()> {
    let source = workspace_path.join(MANIFEST_FILE);
    if !source.exists() {
        return Ok(());
    }

    let sidecar = manifest_sidecar_path(document_path);
    if let Some(parent) = sidecar.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(&source, &sidecar).map_err(|e| AppError::Io(e))?;
    Ok(())
}
