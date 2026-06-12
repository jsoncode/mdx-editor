use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::mdx::create_empty_mdx;

const SKIP_DIR_NAMES: &[&str] = &[".git", ".obsidian", "node_modules", "target", ".codegraph"];

fn is_vault_document_ext(ext: &str) -> bool {
    ext.eq_ignore_ascii_case("mdx") || ext.eq_ignore_ascii_case("md")
}

fn is_vault_document_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(is_vault_document_ext)
        .unwrap_or(false)
}

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

        if is_vault_document_path(&path) {
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultItemInfo {
    pub path: String,
    pub name: String,
    pub relative_path: String,
    pub kind: String,
    pub size_bytes: Option<u64>,
    pub modified_at_ms: Option<i64>,
    pub created_at_ms: Option<i64>,
    pub file_count: Option<u32>,
    pub folder_count: Option<u32>,
}

fn validate_vault_item_path(vault_path: &str, item_path: &str) -> AppResult<PathBuf> {
    let root = PathBuf::from(vault_path);
    let target = PathBuf::from(item_path);
    ensure_within_vault(&root, &target)?;
    if !target.exists() {
        return Err(AppError::Other(format!("路径不存在: {item_path}")));
    }
    Ok(target)
}

fn relative_vault_path(vault_root: &Path, target: &Path) -> AppResult<String> {
    Ok(target
        .strip_prefix(vault_root)
        .map_err(|_| AppError::Other("Invalid vault path".to_string()))?
        .to_string_lossy()
        .replace('\\', "/"))
}

fn metadata_ms(metadata: &fs::Metadata, field: MetadataField) -> Option<i64> {
    let time = match field {
        MetadataField::Modified => metadata.modified().ok()?,
        MetadataField::Created => metadata.created().ok()?,
    };
    time.duration_since(std::time::UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as i64)
}

enum MetadataField {
    Modified,
    Created,
}

fn count_folder_contents(path: &Path) -> AppResult<(u32, u32)> {
    let mut file_count = 0u32;
    let mut folder_count = 0u32;

    if !path.is_dir() {
        return Ok((0, 0));
    }

    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let entry_path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }

        if entry_path.is_dir() {
            if SKIP_DIR_NAMES.contains(&name.as_str()) {
                continue;
            }
            folder_count += 1;
            let (nested_files, nested_folders) = count_folder_contents(&entry_path)?;
            file_count += nested_files;
            folder_count += nested_folders;
            continue;
        }

        if entry_path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(is_vault_document_ext)
            .unwrap_or(false)
        {
            file_count += 1;
        }
    }

    Ok((file_count, folder_count))
}

pub fn get_vault_item_info(vault_path: &str, item_path: &str) -> AppResult<VaultItemInfo> {
    let root = PathBuf::from(vault_path);
    let target = validate_vault_item_path(vault_path, item_path)?;
    let metadata = fs::metadata(&target)?;
    let relative_path = relative_vault_path(&root, &target)?;
    let name = target
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_default();

    if target.is_dir() {
        let (file_count, folder_count) = count_folder_contents(&target)?;
        return Ok(VaultItemInfo {
            path: target.to_string_lossy().to_string(),
            name,
            relative_path,
            kind: "folder".to_string(),
            size_bytes: None,
            modified_at_ms: metadata_ms(&metadata, MetadataField::Modified),
            created_at_ms: metadata_ms(&metadata, MetadataField::Created),
            file_count: Some(file_count),
            folder_count: Some(folder_count),
        });
    }

    Ok(VaultItemInfo {
        path: target.to_string_lossy().to_string(),
        name,
        relative_path,
        kind: "file".to_string(),
        size_bytes: Some(metadata.len()),
        modified_at_ms: metadata_ms(&metadata, MetadataField::Modified),
        created_at_ms: metadata_ms(&metadata, MetadataField::Created),
        file_count: None,
        folder_count: None,
    })
}

pub fn delete_vault_file(vault_path: &str, file_path: &str) -> AppResult<()> {
    let target = validate_vault_item_path(vault_path, file_path)?;
    if !target.is_file() {
        return Err(AppError::Other("只能删除 Markdown / MDX 文件".to_string()));
    }
    if !is_vault_document_path(&target) {
        return Err(AppError::Other("只能删除 Markdown / MDX 文件".to_string()));
    }
    fs::remove_file(target)?;
    Ok(())
}

pub fn delete_vault_folder(vault_path: &str, relative_path: &str) -> AppResult<()> {
    let root = PathBuf::from(vault_path);
    let target = resolve_vault_child(&root, relative_path)?;
    if !target.is_dir() {
        return Err(AppError::Other("目标不是文件夹".to_string()));
    }
    if target == root {
        return Err(AppError::Other("不能删除工作区根目录".to_string()));
    }
    fs::remove_dir_all(target)?;
    Ok(())
}

pub fn rename_vault_item(
    vault_path: &str,
    relative_path: &str,
    new_name: &str,
    is_folder: bool,
) -> AppResult<String> {
    let trimmed = new_name.trim();
    if trimmed.is_empty() {
        return Err(AppError::Other("名称不能为空".to_string()));
    }
    if trimmed.contains(['/', '\\']) {
        return Err(AppError::Other("名称不能包含路径分隔符".to_string()));
    }

    let root = PathBuf::from(vault_path);
    let source = resolve_vault_child(&root, relative_path)?;
    if !source.exists() {
        return Err(AppError::Other("路径不存在".to_string()));
    }

    let parent = source
        .parent()
        .ok_or_else(|| AppError::Other("Invalid path".to_string()))?;

    let new_file_name = if is_folder {
        trimmed.to_string()
    } else {
        let ext = source
            .extension()
            .and_then(|value| value.to_str())
            .filter(|value| is_vault_document_ext(value))
            .unwrap_or("mdx");
        let stem = trimmed
            .trim_end_matches(".mdx")
            .trim_end_matches(".MDX")
            .trim_end_matches(".md")
            .trim_end_matches(".MD");
        if stem.is_empty() {
            return Err(AppError::Other("无效的文件名".to_string()));
        }
        format!("{stem}.{ext}")
    };

    let destination = parent.join(&new_file_name);
    ensure_within_vault(&root, &destination)?;

    if destination.exists() {
        return Err(AppError::Other(format!("「{new_file_name}」已存在")));
    }

    fs::rename(&source, &destination)?;
    Ok(destination.to_string_lossy().to_string())
}

pub fn reveal_vault_item(item_path: &str) -> AppResult<()> {
    let target = PathBuf::from(item_path);
    if !target.exists() {
        return Err(AppError::Other(format!("路径不存在: {item_path}")));
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        if target.is_file() {
            std::process::Command::new("explorer")
                .creation_flags(CREATE_NO_WINDOW)
                .arg(format!("/select,{}", target.to_string_lossy()))
                .spawn()
                .map_err(|e| AppError::Other(e.to_string()))?;
        } else {
            std::process::Command::new("explorer")
                .creation_flags(CREATE_NO_WINDOW)
                .arg(&target)
                .spawn()
                .map_err(|e| AppError::Other(e.to_string()))?;
        }
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        if target.is_file() {
            std::process::Command::new("open")
                .args(["-R", &target.to_string_lossy()])
                .spawn()
                .map_err(|e| AppError::Other(e.to_string()))?;
        } else {
            std::process::Command::new("open")
                .arg(&target)
                .spawn()
                .map_err(|e| AppError::Other(e.to_string()))?;
        }
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let open_target = if target.is_file() {
            target
                .parent()
                .map(|parent| parent.to_path_buf())
                .unwrap_or(target)
        } else {
            target
        };
        std::process::Command::new("xdg-open")
            .arg(open_target)
            .spawn()
            .map_err(|e| AppError::Other(e.to_string()))?;
        Ok(())
    }
}
