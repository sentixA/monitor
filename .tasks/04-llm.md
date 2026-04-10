# 阶段 4：LLM Provider 抽象

## 目标

实现可插拔的多 Provider LLM 调用层。用户在 JSON 配置文件填多家 API，运行时由 manager 选一家活跃。能用一个独立脚本验证 vision API 真的能调通。

> **可与阶段 2/3 并行**，因为不依赖 capture 数据。

## 子任务

### 4.1 Provider 接口
- [ ] 创建 `src/main/llm/provider.ts`
- [ ] 定义 `LLMProvider` 接口：
  ```ts
  interface LLMProvider {
    id: string
    name: string
    chat(input: ChatInput): Promise<ChatResult>
  }
  ```
- [ ] 定义 `ChatInput` / `ChatMessage`（支持文本 + 图片 base64）/ `ChatResult { text }`

### 4.2 Manager
- [ ] 创建 `src/main/llm/manager.ts`
- [ ] `LLMManager` 类：
  - `register(p: LLMProvider)`
  - `setActive(id: string)`
  - `current(): LLMProvider`
  - `loadFromConfig(config: ProviderConfig[])` — 根据 type 实例化对应 provider

### 4.3 Provider 实现：openai-compat
- [ ] 创建 `src/main/llm/providers/openaiCompat.ts`
- [ ] 构造参数：`{baseUrl, apiKey, model}`
- [ ] 用 `fetch` POST `/chat/completions`
- [ ] 图片走 `image_url` 字段，data URL 格式 `data:image/png;base64,...`
- [ ] 错误处理：HTTP 非 2xx 抛带状态码的 Error

### 4.4 Provider 实现：claude-native
- [ ] 创建 `src/main/llm/providers/claudeNative.ts`
- [ ] 用 Anthropic Messages API: `https://api.anthropic.com/v1/messages`
- [ ] 必填 header: `x-api-key`, `anthropic-version: 2023-06-01`
- [ ] 图片走 content blocks 的 `type: 'image'` + `source.data` (base64)
- [ ] 解析返回的 `content[0].text`

### 4.5 PromptBuilder
- [ ] 创建 `src/main/llm/promptBuilder.ts`
- [ ] 输入：`StuckSignal + screenshot Buffer + WindowInfo + InputSummary`
- [ ] 输出：`{system, messages}` 适配 ChatInput
- [ ] System prompt 写在常量里（见 `.docs/implementation_plan.md` 里的模板）
- [ ] 显式要求 LLM 不确定时回 `PASS`

### 4.6 Config Store
- [ ] 创建 `src/main/config/store.ts`
- [ ] 用 `electron-store` 包装
- [ ] Schema：`{active: string, providers: ProviderConfig[], blacklist: string[]}`
- [ ] 默认值：空 providers + 默认 blacklist（1Password / KeePass / WeChat / QQ）
- [ ] 暴露 `getConfig()` / `openConfigFile()`（用 `shell.openPath` 给托盘菜单用）

### 4.7 独立验证脚本
- [ ] 创建 `scripts/test-llm.ts`（**可选但推荐**）
- [ ] 直接 import provider，读 config，喂一张 `.docs/sample.png`，打印响应
- [ ] 用 `npx tsx scripts/test-llm.ts` 跑

## Definition of Done

- [ ] 在 config 里配 1 家 provider，运行 `test-llm.ts` 能拿到非空文本响应
- [ ] 切换 active 到另一家也能跑通
- [ ] 故意填错 apiKey，进程不 crash，错误能被 catch 并打印

## 文件清单

```
src/main/llm/provider.ts
src/main/llm/manager.ts
src/main/llm/providers/openaiCompat.ts
src/main/llm/providers/claudeNative.ts
src/main/llm/promptBuilder.ts
src/main/config/store.ts
scripts/test-llm.ts          (可选)
```
