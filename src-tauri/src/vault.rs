use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::mdx::create_empty_mdx;

const SKIP_DIR_NAMES: &[&str] = &[".git", ".obsidian", "node_modules", "target", ".codegraph"];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum VaultTreeNode {
    Folder {
        name: String,
        relative_path: String,
        children: Vec<VaultTreeNode>,
    },
    File {
        name: String,
        path: String,
    },
}

pub fn scan_vault(vault_path: &str) -> AppResult<Vec<VaultTreeNode>> {
    let root = PathBuf::from(vault_path);
    if !root.is_dir() {
        return Err(AppError::Other(format!("工作区目录不存在: {vault_path}")));
    }
    scan_directory(&root, &root)
}

fn scan_directory(vault_root: &Path, current: &Path) -> AppResult<Vec<VaultTreeNode>> {
    let mut nodes = Vec::new();
    let mut entries: Vec<_> = fs::read_dir(current)?.collect::<Result<_, _>>()?;

    entries.sort_by(|a, b| {
        let a_is_dir = a.path().is_dir();
        let b_is_dir = b.path().is_dir();
        match (a_is_dir, b_is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.file_name().cmp(&b.file_name()),
        }
    });

    for entry in entries {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            if SKIP_DIR_NAMES.contains(&name.as_str()) {
                continue;
            }
            let relative_path = path
                .strip_prefix(vault_root)
                .map_err(|_| AppError::Other("Invalid vault path".to_string()))?
                .to_string_lossy()
                .replace('\\', "/");
            let children = scan_directory(vault_root, &path)?;
            nodes.push(VaultTreeNode::Folder {
                name,
                relative_path,
                children,
            });
            continue;
        }

        if path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.eq_ignore_ascii_case("mdx"))
            .unwrap_or(false)
        {
            nodes.push(VaultTreeNode::File {
                name,
                path: path.to_string_lossy().to_string(),
            });
        }
    }

    Ok(nodes)
}

fn resolve_vault_child(vault_root: &Path, relative: &str) -> AppResult<PathBuf> {
    let normalized = relative.replace('\\', "/");
    if normalized.contains("..") {
        return Err(AppError::Other("Invalid path".to_string()));
    }

    let target = vault_root.join(&normalized);
    ensure_within_vault(vault_root, &target)?;
    Ok(target)
}

fn ensure_within_vault(vault_root: &Path, target: &Path) -> AppResult<()> {
    let vault = vault_root
        .canonicalize()
        .unwrap_or_else(|_| vault_root.to_path_buf());

    let check = if target.exists() {
        target.canonicalize()
    } else if let Some(parent) = target.parent() {
        if !parent.exists() {
            return ensure_within_vault(vault_root, parent);
        }
        parent.canonicalize().map(|p| p.join(
            target
                .file_name()
                .unwrap_or_default(),
        ))
    } else {
        return Err(AppError::Other("Invalid path".to_string()));
    };

    let resolved = check.map_err(|e| AppError::Io(e))?;
    let resolved = resolved
        .canonicalize()
        .unwrap_or(resolved);

    if !resolved.starts_with(&vault) {
        return Err(AppError::Other("Path is outside vault".to_string()));
    }

    Ok(())
}

pub fn create_vault_folder(vault_path: &str, relative_path: &str) -> AppResult<()> {
    let root = PathBuf::from(vault_path);
    let target = resolve_vault_child(&root, relative_path)?;
    fs::create_dir_all(target)?;
    Ok(())
}

pub fn create_vault_document(vault_path: &str, relative_path: &str) -> AppResult<String> {
    let root = PathBuf::from(vault_path);
    let target = resolve_vault_child(&root, relative_path)?;

    if target.exists() {
        return Err(AppError::Other(format!(
            "文件已存在: {}",
            target.to_string_lossy()
        )));
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }

    create_empty_mdx(&target)?;
    Ok(target.to_string_lossy().to_string())
}

pub fn unique_document_name(vault_path: &str, folder_relative: &str, base_name: &str) -> AppResult<String> {
    let root = PathBuf::from(vault_path);
    let stem = base_name.trim_end_matches(".mdx");
    let folder = if folder_relative.is_empty() {
        root.clone()
    } else {
        resolve_vault_child(&root, folder_relative)?
    };

    let first = folder.join(format!("{stem}.mdx"));
    if !first.exists() {
        return Ok(if folder_relative.is_empty() {
            format!("{stem}.mdx")
        } else {
            format!("{folder_relative}/{stem}.mdx").replace('\\', "/")
        });
    }

    for index in 2..=999 {
        let candidate = folder.join(format!("{stem} {index}.mdx"));
        if !candidate.exists() {
            let relative = candidate
                .strip_prefix(&root)
                .map_err(|_| AppError::Other("Invalid vault path".to_string()))?
                .to_string_lossy()
                .replace('\\', "/");
            return Ok(relative);
        }
    }

    Err(AppError::Other("无法生成唯一文件名".to_string()))
}
