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

> **MVU 后追加（2026-04-10，PR #8 后）**：MVU 验证跑通的过程暴露了一个问题 ——
> 单轮 prompt 只塞一张截图 + 极简 system prompt，LLM 只能做"画面识别 + 凭空建议"。
> 它没办法判断"用户卡在哪",因为它看不到时间维度（屏幕是不是 30 秒没动？用户
> 是不是反复按同一个键？刚才点了什么但没反应？）。要让 LLM 真的回答"卡在哪 +
> 怎么解决",输入必须包含**时间序列特征 + 操作历史**，调用结构必须是**多轮**。
> 单轮 prompt 一次塞所有信息容易让 LLM 认知超载、给出泛泛回答。

#### 4.5.1 基础骨架
- [ ] 创建 `src/main/llm/promptBuilder.ts`
- [ ] 输出：`{system, messages}` 适配 ChatInput
- [ ] System prompt 写在常量里（见 `.docs/implementation_plan.md` 里的模板）
- [ ] 显式要求 LLM 不确定时回 `PASS`

#### 4.5.2 输入扩展（MVU 后追加）
PromptBuilder 的输入不再只是 `StuckSignal + screenshot + WindowInfo`，要扩成：

- [ ] **当前帧截图** + **WindowInfo**（保持原样）
- [ ] **截图历史**：最近 2-3 帧的缩略图（可选低分辨率，例如 640px 长边）
  - 让 LLM 看到"屏幕从 X 状态变成 Y 状态"或"屏幕 30 秒没变化"这种**时间维度**信号
  - Aggregator 已经维护 20 帧 ring buffer（见 03-detection.md 3.1），从那里取
  - 不要全发，token 成本会爆炸；只发关键帧（最近 + 卡住前 + 卡住时）
- [ ] **InputEvent 时间序列**：最近 N 秒（建议 30s）的按键/点击/移动事件序列
  - 格式：`[{ts: -28.3s, type: "key", payload: "Enter"}, {ts: -27.1s, type: "key", payload: "Enter"}, ...]`
  - 时间用相对值（"X 秒前"），LLM 比读绝对时间戳更直观
  - 必要时用 token-friendly 的紧凑格式（每行一个事件，去重相邻重复）
- [ ] **操作行为摘要**：从 InputEvent 序列里聚合出的高层信号
  - 示例：`"用户在过去 8 秒内反复按 Enter 6 次"` / `"用户在 (812, 440) 附近点击了 4 次"` / `"鼠标悬停在按钮 X 上 12 秒未点击"`
  - 这是给 LLM 的"线索预消化"，避免 LLM 自己从原始事件流推
  - Detector 触发时本来就有这个信息（StuckSignal.evidence），直接借用
- [ ] **触发原因**：StuckSignal.reason（`repeat-input` / `screen-idle` / 等），告诉 LLM 是哪种"卡住"

#### 4.5.3 多轮调用结构（MVU 后追加）
单轮一次塞所有信息容易"认知超载"。改成 3 轮渐进式：

- [ ] **Turn 1 — 视觉理解**
  - 输入：当前帧截图 + WindowInfo
  - 任务：让 LLM 用一两句话描述"用户当前在做什么"（应用、文件名、看得到的具体内容）
  - 这一轮强制只看视觉，不让 LLM 猜动机
- [ ] **Turn 2 — 卡点诊断**
  - 输入：Turn 1 的回答 + 截图历史 + InputEvent 时间序列 + 操作行为摘要 + 触发原因
  - 任务：让 LLM 判断"用户具体卡在哪一步"
  - 鼓励 LLM 引用具体证据：哪个按键、哪个区域、哪段时间
- [ ] **Turn 3 — 解决方案**
  - 输入：Turn 1 + Turn 2 的回答
  - 任务：让 LLM 给出 1-2 条**可立即行动**的建议（动词开头）
  - 仍然保留 PASS 兜底：如果 Turn 2 没诊断出明确卡点，Turn 3 直接回 PASS
- [ ] 多轮编排放在 `src/main/llm/orchestrator.ts`（新文件，调度 PromptBuilder + LLMProvider）
- [ ] 每轮的 system prompt 单独写常量，互不复用
- [ ] **token 预算**：总 token 上限 8K，优先保证截图清晰，操作历史/时间序列可裁剪

#### 4.5.4 验收
- [ ] 用一段构造的"卡在登录按钮反复点击"日志跑一遍 orchestrator，看 Turn 2 能否引用"用户在 (X, Y) 点了 N 次"
- [ ] 用一段"屏幕 30 秒静止"场景跑一遍，看 Turn 2 能否区分"用户在思考" vs "界面卡死"
- [ ] 总 token 数和总 latency 记录下来，作为 PASS/FAIL 阈值（建议端到端 ≤ 6s）

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
- [ ] **(MVU 后追加)** Orchestrator 能跑通 3 轮调用，Turn 2 的回答里能引用具体证据（按键名/坐标/时间），不是泛泛描述
- [ ] **(MVU 后追加)** 端到端总 latency 在可接受范围（建议 ≤ 6s，需要实测调整）

## 文件清单

```
src/main/llm/provider.ts
src/main/llm/manager.ts
src/main/llm/providers/openaiCompat.ts
src/main/llm/providers/claudeNative.ts
src/main/llm/promptBuilder.ts
src/main/llm/orchestrator.ts        (MVU 后追加：多轮调度)
src/main/config/store.ts
scripts/test-llm.ts                 (可选)
```
