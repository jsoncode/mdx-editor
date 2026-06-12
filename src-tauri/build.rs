use std::env;
use std::path::{Path, PathBuf};

fn main() {
    if env::var("TAURI_BUNDLE_FFMPEG").as_deref() == Ok("1") {
        ensure_ffmpeg_sidecar();
    }
    tauri_build::build();
}

fn sidecar_file_name(target: &str) -> String {
    if target.contains("windows") {
        format!("ffmpeg-{target}.exe")
    } else {
        format!("ffmpeg-{target}")
    }
}

fn sidecar_dest(manifest_dir: &Path, target: &str) -> PathBuf {
    manifest_dir
        .join("binaries")
        .join(sidecar_file_name(target))
}

fn ensure_ffmpeg_sidecar() {
    let target = env::var("TARGET").unwrap_or_default();
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
    if target.is_empty() || manifest_dir.is_empty() {
        return;
    }

    let dest = sidecar_dest(Path::new(&manifest_dir), &target);
    if dest.is_file() {
        println!("cargo:rerun-if-changed={}", dest.display());
        return;
    }

    panic!(
        "内置 FFmpeg 打包已启用，但未找到 sidecar: {}\n请先运行: npm run fetch:ffmpeg",
        dest.display()
    );
}
