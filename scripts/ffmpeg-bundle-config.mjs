import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(rootDir, "src-tauri", "tauri.conf.json");
const binariesDir = path.join(rootDir, "src-tauri", "binaries");

/** @returns {string} */
export function targetTriple() {
  if (process.env.TAURI_ENV_TARGET_TRIPLE) {
    return process.env.TAURI_ENV_TARGET_TRIPLE;
  }
  if (process.platform === "win32") return "x86_64-pc-windows-msvc";
  if (process.platform === "darwin") {
    return process.arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
  }
  return "x86_64-unknown-linux-gnu";
}

/** @returns {string} */
export function ffmpegSidecarFileName(triple = targetTriple()) {
  return triple.includes("windows") ? `ffmpeg-${triple}.exe` : `ffmpeg-${triple}`;
}

/** @returns {string} */
export function ffmpegSidecarPath(triple = targetTriple()) {
  return path.join(binariesDir, ffmpegSidecarFileName(triple));
}

export function isFfmpegSidecarReady(triple = targetTriple()) {
  return fs.existsSync(ffmpegSidecarPath(triple));
}

export function readTauriConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

export function writeTauriConfig(config) {
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function isFfmpegBundled(config = readTauriConfig()) {
  return Array.isArray(config.bundle?.externalBin)
    && config.bundle.externalBin.includes("binaries/ffmpeg");
}

/** @param {boolean} enabled */
export function setFfmpegBundle(enabled) {
  const config = readTauriConfig();
  if (!config.bundle) config.bundle = {};

  if (enabled) {
    const bins = new Set(config.bundle.externalBin ?? []);
    bins.add("binaries/ffmpeg");
    config.bundle.externalBin = [...bins];
  } else if (Array.isArray(config.bundle.externalBin)) {
    config.bundle.externalBin = config.bundle.externalBin.filter(
      (entry) => entry !== "binaries/ffmpeg",
    );
    if (config.bundle.externalBin.length === 0) {
      delete config.bundle.externalBin;
    }
  }

  writeTauriConfig(config);
  return config;
}
