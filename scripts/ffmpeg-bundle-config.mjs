import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(rootDir, "src-tauri", "tauri.conf.json");

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
