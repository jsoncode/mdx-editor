#!/usr/bin/env node
/**
 * MDX Editor 打包脚本
 *
 * 用法:
 *   npm run pack                      交互式选择（默认不内置 FFmpeg）
 *   npm run pack -- exe               仅编译绿色版 exe
 *   npm run pack -- nsis              仅 NSIS 安装包
 *   npm run pack -- msi               仅 MSI 安装包
 *   npm run pack -- all               全部（NSIS + MSI，含 exe）
 *   npm run pack -- --with-ffmpeg     内置 FFmpeg 后再打包（可与其他类型组合）
 *   npm run pack:ffmpeg               同上（内置 FFmpeg + 交互式选择）
 */

import { spawn, spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isFfmpegBundled, readTauriConfig, setFfmpegBundle, writeTauriConfig } from "./ffmpeg-bundle-config.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @type {Record<string, { label: string; hint: string; tauriArgs: string[] }>} */
const PACK_TYPES = {
  exe: {
    label: "绿色版 exe",
    hint: "src-tauri/target/release/mdx-editor.exe",
    tauriArgs: ["build", "--no-bundle"],
  },
  nsis: {
    label: "NSIS 安装包",
    hint: "src-tauri/target/release/bundle/nsis/*.exe",
    tauriArgs: ["build", "--bundles", "nsis"],
  },
  msi: {
    label: "MSI 安装包",
    hint: "src-tauri/target/release/bundle/msi/*.msi",
    tauriArgs: ["build", "--bundles", "msi"],
  },
  all: {
    label: "全部（NSIS + MSI）",
    hint: "安装包 + release/mdx-editor.exe",
    tauriArgs: ["build"],
  },
};

const MENU = [
  { key: "1", type: "exe" },
  { key: "2", type: "nsis" },
  { key: "3", type: "msi" },
  { key: "4", type: "all" },
];

function printHelp() {
  console.log(`
MDX Editor 打包类型:

  npm run pack                      交互式选择（默认不内置 FFmpeg）
  npm run pack -- exe               绿色版 exe（不生成安装包）
  npm run pack -- nsis              NSIS 安装程序
  npm run pack -- msi               MSI 安装包
  npm run pack -- all               NSIS + MSI
  npm run pack -- --with-ffmpeg     打包时内置 FFmpeg
  npm run pack:ffmpeg               内置 FFmpeg + 交互式选择

快捷命令:
  npm run pack:exe | pack:nsis | pack:msi | pack:all
  npm run pack:ffmpeg:exe | pack:ffmpeg:all  等
`);
}

function parseArgs(argv) {
  const withFfmpeg = argv.includes("--with-ffmpeg");
  const filtered = argv.filter((arg) => arg !== "--with-ffmpeg");
  const typeArg = filtered[2];
  return { withFfmpeg, typeArg };
}

function resolveType(raw) {
  const value = raw?.trim().toLowerCase();
  if (!value || value === "help" || value === "-h" || value === "--help") {
    return value === "help" || value === "-h" || value === "--help" ? "help" : null;
  }
  if (PACK_TYPES[value]) return value;
  const byKey = MENU.find((item) => item.key === value);
  return byKey?.type ?? null;
}

async function promptType() {
  console.log("\n请选择打包类型:\n");
  for (const item of MENU) {
    const pack = PACK_TYPES[item.type];
    console.log(`  ${item.key}. ${pack.label}`);
    console.log(`     输出: ${pack.hint}\n`);
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question("输入序号或类型名 (exe/nsis/msi/all): ");
    const type = resolveType(answer);
    if (!type) {
      console.error("无效选择，已取消。");
      process.exit(1);
    }
    return type;
  } finally {
    rl.close();
  }
}

function fetchFfmpeg() {
  console.log("\n>>> 准备内置 FFmpeg sidecar…\n");
  const result = spawnSync("node", ["scripts/fetch-ffmpeg.mjs"], {
    cwd: rootDir,
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error("下载 FFmpeg 失败，无法继续内置打包");
  }
}

function runTauriBuild(type, withFfmpeg) {
  const pack = PACK_TYPES[type];
  console.log(`\n>>> 开始打包: ${pack.label}${withFfmpeg ? "（含 FFmpeg）" : ""}\n`);

  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "tauri", "--", ...pack.tauriArgs], {
      cwd: rootDir,
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        TAURI_BUNDLE_FFMPEG: withFfmpeg ? "1" : "0",
      },
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        console.log(`\n>>> 打包完成: ${pack.label}`);
        console.log(`>>> 输出位置: ${pack.hint}\n`);
        resolve();
      } else {
        reject(new Error(`打包失败，退出码 ${code ?? "unknown"}`));
      }
    });
  });
}

async function main() {
  const { withFfmpeg, typeArg } = parseArgs(process.argv);
  const resolved = resolveType(typeArg);

  if (resolved === "help") {
    printHelp();
    process.exit(0);
  }

  const selectedType = resolved ?? (await promptType());
  const configBackup = readTauriConfig();
  const hadBundled = isFfmpegBundled(configBackup);

  try {
    if (withFfmpeg) {
      fetchFfmpeg();
      setFfmpegBundle(true);
    } else {
      setFfmpegBundle(false);
    }

    await runTauriBuild(selectedType, withFfmpeg);
  } finally {
    writeTauriConfig(configBackup);
    if (withFfmpeg && !hadBundled) {
      console.log(">>> 已恢复 tauri.conf.json（默认不内置 FFmpeg）\n");
    }
  }
}

await main();
