use std::fs::{self, File};
use std::io::{Read, Seek, Write};
use std::path::Path;

use zip::ZipArchive;

use crate::error::{AppError, AppResult};
use crate::workspace::{ASSET_DIR, INDEX_FILE};

pub fn unpack_to_workspace(mdx_path: &Path, workspace_path: &Path) -> AppResult<()> {
    let file = File::open(mdx_path)?;
    unpack_archive(ZipArchive::new(file)?, workspace_path)
}

pub fn unpack_bytes_to_workspace(data: &[u8], workspace_path: &Path) -> AppResult<()> {
    unpack_archive(
        ZipArchive::new(std::io::Cursor::new(data.to_vec()))?,
        workspace_path,
    )
}

fn unpack_archive<R: Read + Seek>(mut archive: ZipArchive<R>, workspace_path: &Path) -> AppResult<()> {
    if workspace_path.exists() {
        fs::remove_dir_all(workspace_path)?;
    }
    fs::create_dir_all(workspace_path)?;

    let mut has_index = false;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let name = entry.name().replace('\\', "/");
        if name.contains("..") {
            return Err(AppError::InvalidMdx("Invalid entry path in archive".to_string()));
        }

        let normalized = name.trim_start_matches("./");

        if normalized.ends_with('/') {
            fs::create_dir_all(workspace_path.join(normalized))?;
            continue;
        }

        let outpath = if normalized.eq_ignore_ascii_case(INDEX_FILE) {
            has_index = true;
            workspace_path.join(INDEX_FILE)
        } else {
            workspace_path.join(normalized)
        };

        if let Some(parent) = outpath.parent() {
            fs::create_dir_all(parent)?;
        }

        let mut outfile = File::create(&outpath)?;
        let mut buffer = Vec::new();
        entry.read_to_end(&mut buffer)?;
        outfile.write_all(&buffer)?;
    }

    if !has_index {
        return Err(AppError::InvalidMdx(
            "MDX file must contain index.md".to_string(),
        ));
    }

    fs::create_dir_all(workspace_path.join(ASSET_DIR))?;
    Ok(())
}
