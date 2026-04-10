/**
 * MVU: 截一张屏，喂给 LLM，打印它对屏幕的理解和建议。
 *
 * 这是整个产品最大假设的最小验证脚本。
 * 跑通了说明: 截图 → 压缩 → vision LLM → 有用回答 这条链路成立。
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import screenshot from "screenshot-desktop";
import sharp from "sharp";

import { ClaudeNativeProvider } from "../llm/claudeNative.js";
import { buildPrompt } from "../llm/promptBuilder.js";
import type { LLMProvider, ProviderConfig } from "../llm/provider.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");
const CONFIG_PATH = resolve(PROJECT_ROOT, "config.json");
const DEBUG_SCREENSHOT_PATH = resolve(PROJECT_ROOT, "mvu-debug-last.png");

interface ConfigFile {
  active: string;
  providers: ProviderConfig[];
}

async function loadConfig(): Promise<ConfigFile> {
  let raw: string;
  try {
    raw = await readFile(CONFIG_PATH, "utf-8");
  } catch (err) {
    throw new Error(
      `[mvu] config not found at ${CONFIG_PATH}\n` +
        `      copy config.example.json to config.json and fill in apiKey.\n` +
        `      original error: ${(err as Error).message}`,
    );
  }
  const cfg = JSON.parse(raw) as ConfigFile;
  if (!cfg.providers?.length) {
    throw new Error("[mvu] config.json has no providers");
  }
  return cfg;
}

function buildProvider(cfg: ConfigFile): LLMProvider {
  const active = cfg.providers.find((p) => p.id === cfg.active);
  if (!active) {
    throw new Error(`[mvu] active provider "${cfg.active}" not found in providers`);
  }
  switch (active.type) {
    case "claude-native":
      return new ClaudeNativeProvider(active);
    case "openai-compat":
      throw new Error("[mvu] openai-compat provider not implemented yet (out of MVU scope)");
    default:
      throw new Error(`[mvu] unknown provider type: ${(active as ProviderConfig).type}`);
  }
}

async function captureAndCompress(): Promise<Buffer> {
  console.log("[mvu] capturing screen...");
  const raw = await screenshot({ format: "png" });
  const meta = await sharp(raw).metadata();
  console.log(`[mvu] raw screenshot: ${meta.width}x${meta.height}, ${(raw.length / 1024).toFixed(0)} KB`);

  const longSide = Math.max(meta.width ?? 0, meta.height ?? 0);
  let compressed: Buffer;
  if (longSide > 1280) {
    compressed = await sharp(raw)
      .resize({
        width: meta.width! >= meta.height! ? 1280 : undefined,
        height: meta.height! > meta.width! ? 1280 : undefined,
        fit: "inside",
      })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } else {
    compressed = await sharp(raw).png({ compressionLevel: 9 }).toBuffer();
  }

  const compMeta = await sharp(compressed).metadata();
  console.log(
    `[mvu] compressed:        ${compMeta.width}x${compMeta.height}, ${(compressed.length / 1024).toFixed(0)} KB`,
  );

  // 顺手保存一张到磁盘，方便人工对照"LLM 看到的图" vs "LLM 的回答"
  await writeFile(DEBUG_SCREENSHOT_PATH, compressed);
  console.log(`[mvu] debug screenshot saved -> ${DEBUG_SCREENSHOT_PATH}`);

  return compressed;
}

async function main(): Promise<void> {
  const cfg = await loadConfig();
  const provider = buildProvider(cfg);

  const png = await captureAndCompress();
  const prompt = buildPrompt({ screenshotPng: png });

  console.log(`[mvu] calling LLM (provider=${provider.id})...`);
  const result = await provider.chat(prompt);

  console.log(
    `[mvu] response (${result.latencyMs}ms, in=${result.usage?.inputTokens ?? "?"} out=${result.usage?.outputTokens ?? "?"}):`,
  );
  console.log("---");
  console.log(result.text || "<EMPTY>");
  console.log("---");

  if (!result.text) {
    console.error("[mvu] FAIL: empty response");
    process.exit(2);
  }
  if (result.text.trim() === "PASS") {
    console.warn("[mvu] WARN: LLM returned PASS — 它认为不该打扰用户。再换一张更复杂的屏试试。");
  }
  console.log("[mvu] OK");
}

main().catch((err: Error) => {
  console.error(`[mvu] FAIL:`, err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
