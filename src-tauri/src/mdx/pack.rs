use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;

use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use crate::error::{AppError, AppResult};
use crate::manifest::Manifest;
use crate::asset_refs::collect_asset_references;
use crate::workspace::{ASSET_DIR, INDEX_FILE, MANIFEST_FILE};

pub fn pack_workspace(workspace_path: &Path, output_path: &Path, manifest: &mut Manifest) -> AppResult<()> {
    manifest.touch();

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let file = File::create(output_path)?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated);

    let index_path = workspace_path.join(INDEX_FILE);
    if !index_path.exists() {
        return Err(AppError::InvalidMdx("index.md not found in workspace".to_string()));
    }
    add_file_to_zip(&mut zip, INDEX_FILE, &index_path, options)?;

    fs::write(
        workspace_path.join(MANIFEST_FILE),
        serde_json::to_string_pretty(manifest)?,
    )?;
    add_file_to_zip(
        &mut zip,
        MANIFEST_FILE,
        &workspace_path.join(MANIFEST_FILE),
        options,
    )?;

    let index_content = fs::read_to_string(&index_path)?;
    let asset_refs = collect_asset_references(&index_content);
    let asset_dir = workspace_path.join(ASSET_DIR);
    if asset_dir.exists() {
        for relative_path in asset_refs {
            let Some(filename) = relative_path.strip_prefix(&format!("{ASSET_DIR}/")) else {
                continue;
            };
            let file_path = asset_dir.join(filename);
            if file_path.is_file() {
                add_file_to_zip(&mut zip, &relative_path, &file_path, options)?;
            }
        }
    }

    zip.finish()?;
    Ok(())
}

fn add_file_to_zip(
    zip: &mut ZipWriter<File>,
    name_in_archive: &str,
    file_path: &Path,
    options: SimpleFileOptions,
) -> AppResult<()> {
    zip.start_file(name_in_archive.replace('\\', "/"), options)?;
    let mut file = File::open(file_path)?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)?;
    zip.write_all(&buffer)?;
    Ok(())
}
