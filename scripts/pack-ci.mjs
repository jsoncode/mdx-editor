#!/usr/bin/env node
/**
 * CI 发布打包：构建标准版与内置 FFmpeg 版的全部 Windows 产物（便携 exe + NSIS + MSI）。
 *
 * 用法:
 *   npm run pack:ci
 *
 * 输出目录:
 *   release-artifacts/standard/
 *   release-artifacts/with-ffmpeg/
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactsRoot = path.join(rootDir, "release-artifacts");
const releaseDir = path.join(rootDir, "src-tauri", "target", "release");
const portableExe = path.join(releaseDir, "mdx-editor.exe");
const nsisDir = path.join(releaseDir, "bundle", "nsis");
const msiDir = path.join(releaseDir, "bundle", "msi");

/** @param {string[]} args */
function runPack(args) {
  const result = spawnSync("node", ["scripts/pack.mjs", "--ci", ...args], {
    cwd: rootDir,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      CI: "true",
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/** @param {string} dir @param {string} suffix */
function listBySuffix(dir, suffix) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith(suffix));
}

/** @param {string} source @param {string} dest */
function copyFile(source, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(source, dest);
}

/** @param {string} subdir */
function stageArtifacts(subdir) {
  const destDir = path.join(artifactsRoot, subdir);
  fs.mkdirSync(destDir, { recursive: true });

  if (!fs.existsSync(portableExe)) {
    throw new Error(`未找到便携版 exe: ${portableExe}`);
  }
  copyFile(portableExe, path.join(destDir, "mdx-editor-portable.exe"));

  const nsisFiles = listBySuffix(nsisDir, ".exe");
  if (nsisFiles.length === 0) {
    throw new Error(`未找到 NSIS 安装包: ${nsisDir}`);
  }
  for (const name of nsisFiles) {
    copyFile(path.join(nsisDir, name), path.join(destDir, name));
  }

  const msiFiles = listBySuffix(msiDir, ".msi");
  if (msiFiles.length === 0) {
    throw new Error(`未找到 MSI 安装包: ${msiDir}`);
  }
  for (const name of msiFiles) {
    copyFile(path.join(msiDir, name), path.join(destDir, name));
  }

  console.log(`\n>>> 已归档 ${subdir} 产物到 ${destDir}\n`);
}

function resetArtifactsRoot() {
  fs.rmSync(artifactsRoot, { recursive: true, force: true });
  fs.mkdirSync(artifactsRoot, { recursive: true });
}

function main() {
  resetArtifactsRoot();

  console.log("\n>>> [1/2] 构建标准版（不含 FFmpeg）: NSIS + MSI + 便携 exe\n");
  runPack(["all"]);
  stageArtifacts("standard");

  console.log("\n>>> [2/2] 构建内置 FFmpeg 版: NSIS + MSI + 便携 exe\n");
  runPack(["--with-ffmpeg", "all"]);
  stageArtifacts("with-ffmpeg");

  console.log(`\n>>> CI 打包完成，产物目录: ${artifactsRoot}\n`);
}

main();
