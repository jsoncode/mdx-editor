import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const binariesDir = path.join(rootDir, "src-tauri", "binaries");

/** @returns {string | null} */
function targetTriple() {
  if (process.env.TAURI_ENV_TARGET_TRIPLE) {
    return process.env.TAURI_ENV_TARGET_TRIPLE;
  }
  if (process.platform === "win32") return "x86_64-pc-windows-msvc";
  if (process.platform === "darwin") {
    return process.arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
  }
  return "x86_64-unknown-linux-gnu";
}

/** @returns {{ outName: string; downloadUrl: string | null }} */
function platformConfig(triple) {
  if (triple.includes("windows")) {
    return {
      outName: `ffmpeg-${triple}.exe`,
      downloadUrl:
        "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
    };
  }
  if (triple.includes("apple-darwin")) {
    return {
      outName: `ffmpeg-${triple}`,
      downloadUrl: null,
    };
  }
  if (triple.includes("linux")) {
    return {
      outName: `ffmpeg-${triple}`,
      downloadUrl: null,
    };
  }
  return { outName: `ffmpeg-${triple}`, downloadUrl: null };
}

async function downloadFile(url, dest) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`下载失败 (${response.status}): ${url}`);
  }
  await pipeline(response.body, createWriteStream(dest));
}

function extractWindowsFfmpeg(zipPath, destExe) {
  const tempDir = path.join(binariesDir, ".ffmpeg-extract");
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${tempDir.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: "inherit" },
  );

  const entries = fs.readdirSync(tempDir, { recursive: true });
  const ffmpegRel = entries.find(
    (entry) => typeof entry === "string" && entry.replace(/\\/g, "/").endsWith("/bin/ffmpeg.exe"),
  );
  if (!ffmpegRel || typeof ffmpegRel !== "string") {
    throw new Error("压缩包中未找到 bin/ffmpeg.exe");
  }

  fs.copyFileSync(path.join(tempDir, ffmpegRel), destExe);
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.rmSync(zipPath, { force: true });
}

async function main() {
  fs.mkdirSync(binariesDir, { recursive: true });

  const triple = targetTriple();
  const { outName, downloadUrl } = platformConfig(triple);
  const dest = path.join(binariesDir, outName);

  if (fs.existsSync(dest)) {
    console.log(`FFmpeg 已存在: ${path.relative(rootDir, dest)}`);
    return;
  }

  if (!downloadUrl) {
    console.warn(
      `当前平台 (${triple}) 暂无自动下载脚本。\n` +
        `请手动将 FFmpeg 放到 src-tauri/binaries/${outName}\n` +
        "或在 PATH 中安装系统 FFmpeg。",
    );
    process.exitCode = 0;
    return;
  }

  console.log(`正在下载 FFmpeg (${triple})…`);
  const zipPath = path.join(binariesDir, "ffmpeg-download.zip");
  await downloadFile(downloadUrl, zipPath);
  console.log("正在解压…");
  extractWindowsFfmpeg(zipPath, dest);
  console.log(`已写入: ${path.relative(rootDir, dest)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
