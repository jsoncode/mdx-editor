use std::fs;
use std::io::Read;
use std::path::Path;

use md5::{Digest, Md5};

use crate::error::{AppError, AppResult};
use crate::workspace::{extension_from_path, ASSET_DIR};

/// 引用文件名使用的 MD5 十六进制前缀长度（完整 MD5 为 32 位）
const HASH_PREFIX_LEN: usize = 12;

pub fn md5_hex_bytes(data: &[u8]) -> String {
    let mut hasher = Md5::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

pub fn md5_hex_file(path: &Path) -> AppResult<String> {
    let mut file = fs::File::open(path).map_err(AppError::Io)?;
    let mut hasher = Md5::new();
    let mut buffer = [0u8; 65536];
    loop {
        let read = file.read(&mut buffer).map_err(AppError::Io)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn asset_filename_from_hash(full_hash: &str, ext: &str, use_full_hash: bool) -> String {
    let stem = if use_full_hash {
        full_hash
    } else {
        &full_hash[..full_hash.len().min(HASH_PREFIX_LEN)]
    };
    if ext.is_empty() || ext == "bin" {
        stem.to_string()
    } else {
        format!("{stem}.{ext}")
    }
}

fn relative_asset_path(filename: &str) -> String {
    format!("{ASSET_DIR}/{filename}")
}

/// 将本地文件写入 `asset/`，按内容哈希命名；已存在相同内容则跳过拷贝。
pub fn store_asset_from_path(asset_dir: &Path, source: &Path) -> AppResult<String> {
    fs::create_dir_all(asset_dir)?;
    let ext = extension_from_path(source);
    let full_hash = md5_hex_file(source)?;

    store_asset_with_hash(asset_dir, source, None, &full_hash, &ext)
}

/// 将字节写入 `asset/`，按内容哈希命名；已存在相同内容则跳过写入。
pub fn store_asset_from_bytes(asset_dir: &Path, bytes: &[u8], ext: &str) -> AppResult<String> {
    fs::create_dir_all(asset_dir)?;
    let full_hash = md5_hex_bytes(bytes);
    store_asset_with_hash(asset_dir, Path::new(""), Some(bytes), &full_hash, ext)
}

fn store_asset_with_hash(
    asset_dir: &Path,
    source: &Path,
    bytes: Option<&[u8]>,
    full_hash: &str,
    ext: &str,
) -> AppResult<String> {
    for use_full in [false, true] {
        let filename = asset_filename_from_hash(full_hash, ext, use_full);
        let relative = relative_asset_path(&filename);
        let dest = asset_dir.join(&filename);

        if dest.is_file() {
            if existing_matches_hash(&dest, full_hash)? {
                return Ok(relative);
            }
            if !use_full {
                continue;
            }
            return Err(AppError::Other(format!(
                "asset 哈希冲突: {}",
                dest.display()
            )));
        }

        if let Some(data) = bytes {
            fs::write(&dest, data)?;
        } else {
            fs::copy(source, &dest).map_err(AppError::Io)?;
        }
        return Ok(relative);
    }

    Err(AppError::Other("无法写入 asset 文件".to_string()))
}

fn existing_matches_hash(path: &Path, expected_full_hash: &str) -> AppResult<bool> {
    Ok(md5_hex_file(path)? == expected_full_hash)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("mdx-asset-store-{name}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn same_content_reuses_asset_file() {
        let root = temp_dir("dedupe");
        let asset_dir = root.join("asset");
        let a = root.join("a.png");
        let b = root.join("b.png");
        fs::write(&a, b"same-image").unwrap();
        fs::write(&b, b"same-image").unwrap();

        let rel1 = store_asset_from_path(&asset_dir, &a).unwrap();
        let rel2 = store_asset_from_path(&asset_dir, &b).unwrap();
        assert_eq!(rel1, rel2);

        let entries: Vec<_> = fs::read_dir(&asset_dir).unwrap().collect();
        assert_eq!(entries.len(), 1);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn different_content_creates_distinct_assets() {
        let root = temp_dir("distinct");
        let asset_dir = root.join("asset");
        let a = root.join("a.png");
        let b = root.join("b.png");
        fs::write(&a, b"image-a").unwrap();
        fs::write(&b, b"image-b").unwrap();

        let rel1 = store_asset_from_path(&asset_dir, &a).unwrap();
        let rel2 = store_asset_from_path(&asset_dir, &b).unwrap();
        assert_ne!(rel1, rel2);

        let entries: Vec<_> = fs::read_dir(&asset_dir).unwrap().collect();
        assert_eq!(entries.len(), 2);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn bytes_and_path_with_same_content_match() {
        let root = temp_dir("bytes");
        let asset_dir = root.join("asset");
        let file = root.join("x.mp3");
        let data = b"audio-bytes";
        fs::write(&file, data).unwrap();

        let rel1 = store_asset_from_path(&asset_dir, &file).unwrap();
        let rel2 = store_asset_from_bytes(&asset_dir, data, "mp3").unwrap();
        assert_eq!(rel1, rel2);

        let _ = fs::remove_dir_all(root);
    }
}
