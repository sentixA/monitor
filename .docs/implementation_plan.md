# 桌面 AI Copilot — 快速原型实现方案

## Context

`/workspace/monitor/` 当前是空项目，仅有 `initial_intention.md` 描述需求和 `requirement_breakdown.md` 描述模块拆分。目标是搭建一个 **快速原型**，验证以下闭环是否成立：

> 实时监控屏幕 → 检测"用户卡住" → 调用云端 LLM 理解上下文 → 主动浮窗给出建议

需求要点（已与用户对齐）：
- **场景**：泛化的电脑使用场景（不限定垂直领域）
- **平台**：架构预留跨平台，**MVP 只跑通 Windows**
- **模型**：云端，**预留多家 Provider 自定义接入**
- **触发**：检测到「重复按键 / 重复点击」或「屏幕画面长时间无变化」时弹出
- **呈现**：系统托盘常驻 + 屏幕右下角浮窗，3 秒不点自动隐藏
- **目标**：快速跑通端到端 demo，不追求功能完整度

技术栈（已确定）：**Electron + TypeScript**。

---

## 架构总览

```
┌────────────────────────── Main Process ──────────────────────────┐
│                                                                  │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐           │
│  │  Capture    │ → │  Aggregator  │ → │   Detector   │           │
│  │  - screen   │   │  (滑动窗口)   │   │  - 重复输入  │           │
│  │  - window   │   │               │   │  - 画面无变化│           │
│  │  - input    │   │               │   │              │           │
│  └─────────────┘   └──────────────┘   └──────┬───────┘           │
│                                              │ 触发              │
│                                              ▼                    │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐            │
│  │ Privacy  │ →  │   Context    │ →  │ LLM Manager  │            │
│  │  Filter  │    │   Builder    │    │ (多 Provider)│            │
│  └──────────┘    └──────────────┘    └──────┬───────┘            │
│                                              │                    │
│                              ┌───────────────┘                    │
│                              ▼ IPC                                │
│  ┌───────────────────────────────────────────────────┐           │
│  │  Tray Icon (常驻)                                 │           │
│  └───────────────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────────┘
                              │ IPC
                              ▼
┌──────────────────── Renderer (Overlay Window) ───────────────────┐
│   - frameless / transparent / always-on-top                      │
│   - 右下角小卡片，显示建议，3s 自动隐藏                            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 技术选型与依赖

| 用途 | 库 | 备注 |
|---|---|---|
| 应用框架 | `electron` | 跨平台外壳 |
| 语言 | `typescript` + `ts-node` | 类型安全 |
| 屏幕截图 | `electron.desktopCapturer` | 内置 API，跨平台，无需 native addon |
| 前台窗口 | `get-windows`（原 active-win） | 跨平台，返回 App / 标题 / pid |
| 全局键鼠 hook | `uiohook-napi` | 跨平台，原型够用 |
| 图像 hash | `sharp` + 自实现 pHash | sharp 也用于 PNG 压缩 |
| HTTP 客户端 | 原生 `fetch`（Electron 内置） | 无需额外依赖 |
| 配置存储 | `electron-store` | JSON 持久化，省事 |
| 打包（后续） | `electron-builder` | 暂不接入 |

> 这些库 **全部跨平台**，所以"预留跨平台"成本极低 —— 只需在 capture 层做一层薄抽象，未来加 macOS/Linux 时只换实现不改逻辑。

---

## 项目结构（待创建文件）

```
/workspace/monitor/
├── package.json
├── tsconfig.json
├── electron.vite.config.ts          # 用 electron-vite 简化 dev/build
├── .gitignore
├── README.md                        # 启动说明
├── src/
│   ├── main/
│   │   ├── index.ts                 # 入口：app 生命周期、托盘、装配 pipeline
│   │   ├── tray.ts                  # 系统托盘菜单（开关 / 设置 / 退出）
│   │   ├── overlayWindow.ts         # 创建透明浮窗
│   │   ├── ipc.ts                   # main ↔ renderer IPC channel 定义
│   │   │
│   │   ├── capture/
│   │   │   ├── types.ts             # Capturer 接口（跨平台抽象）
│   │   │   ├── screenCapturer.ts    # desktopCapturer 实现
│   │   │   ├── windowWatcher.ts     # get-windows 轮询前台窗口
│   │   │   └── inputHook.ts         # uiohook-napi 全局键鼠
│   │   │
│   │   ├── perception/
│   │   │   └── aggregator.ts        # 维护滑动窗口（最近 N 秒事件）
│   │   │
│   │   ├── detector/
│   │   │   ├── types.ts             # Signal 类型 + Detector 接口
│   │   │   ├── repeatInputDetector.ts   # 重复按键 / 重复点击
│   │   │   ├── screenIdleDetector.ts    # pHash 画面无变化
│   │   │   └── stuckOrchestrator.ts     # 组合多个 detector，决定是否触发
│   │   │
│   │   ├── llm/
│   │   │   ├── provider.ts          # Provider 接口
│   │   │   ├── manager.ts           # 注册表 + 当前激活 provider 切换
│   │   │   ├── providers/
│   │   │   │   ├── openaiCompat.ts  # OpenAI / Claude / Gemini 走 OpenAI 兼容协议
│   │   │   │   └── claudeNative.ts  # Anthropic 原生 API（messages endpoint）
│   │   │   └── promptBuilder.ts     # 截图 + 行为序列 → prompt
│   │   │
│   │   ├── privacy/
│   │   │   └── appBlacklist.ts      # 黑名单 App 跳过捕获
│   │   │
│   │   └── config/
│   │       └── store.ts             # electron-store 包装
│   │
│   ├── overlay/
│   │   ├── index.html
│   │   ├── overlay.ts               # 收 IPC，渲染建议卡片
│   │   └── overlay.css              # 卡片样式 + 淡入淡出
│   │
│   └── shared/
│       └── types.ts                 # main / renderer 共用类型
```

---

## 关键模块设计

### 1. Capture 层抽象（为跨平台预留）

```ts
// src/main/capture/types.ts
export interface ScreenCapturer {
  capture(): Promise<Buffer>            // 返回 PNG buffer
}
export interface WindowWatcher {
  current(): Promise<{ app: string; title: string; pid: number } | null>
}
export interface InputHook {
  on(event: 'key' | 'click' | 'move', handler: (e: InputEvent) => void): void
  start(): void
  stop(): void
}
```

Windows 版直接用上面表格里的库实现；将来加 macOS 只需新增 `screenCapturer.macos.ts` 等。

### 2. Aggregator(滑动窗口事件存储)

- 维护最近 60 秒的事件序列：`{ts, type, payload}[]`
- 截图按节流(每 1.5s 一帧)入队，保留最近 20 帧的 pHash
- 键盘鼠标全部入队，按需查询
- 旧数据按 TTL 淘汰

### 3. Detector 层

**RepeatInputDetector**
- 维护一个按键/点击的小型计数 map：`key -> [timestamps]`
- 每次新事件触发时，剔除窗口外的时间戳，统计当前 key 在最近 8 秒内的次数
- 阈值：同一按键 ≥ 6 次，或同一屏幕坐标点击 ≥ 4 次（坐标半径 30px 内算同一点）
- 触发后冷却 30 秒，避免连续触发

**ScreenIdleDetector**
- 每 1.5s 取一帧 → 缩到 32×32 → 灰度 → DCT → pHash（64-bit）
- 滑动窗口最近 20 帧（≈30 秒）
- 若所有帧两两 Hamming distance ≤ 5，认为画面"无变化"
- 同时检查输入 hook：若这段时间内有大量输入事件 → 不算卡住（用户在打字 / 看视频）
- 触发后冷却 60 秒

**StuckOrchestrator**
- 收两个 detector 的信号，做与/或组合，决定是否调用 LLM
- 输出统一的 `StuckSignal { reason, evidence }` 给下游

### 4. LLM Provider 抽象（核心：多家自定义接入）

```ts
// src/main/llm/provider.ts
export interface LLMProvider {
  id: string                          // 'claude-anthropic', 'openai-compat', ...
  name: string
  chat(input: {
    system: string
    messages: ChatMessage[]           // 含图片
    maxTokens?: number
  }): Promise<{ text: string }>
}

// src/main/llm/manager.ts
export class LLMManager {
  private providers = new Map<string, LLMProvider>()
  register(p: LLMProvider) { ... }
  setActive(id: string) { ... }
  current(): LLMProvider { ... }
}
```

**Provider 策略**：
- `openaiCompat.ts`：实现 OpenAI Chat Completions 兼容协议，覆盖 OpenAI / DeepSeek / 通义 / Gemini OpenAI 模式 / Claude 的 OpenAI 兼容 endpoint。用户在 config 里填 `baseUrl + apiKey + model` 即可加任意一家。
- `claudeNative.ts`：单独走 Anthropic Messages API（vision 体验更好）。
- 配置文件示例：
  ```json
  {
    "active": "my-claude",
    "providers": [
      {"id": "my-claude", "type": "claude-native", "apiKey": "...", "model": "claude-opus-4-6"},
      {"id": "my-deepseek", "type": "openai-compat", "baseUrl": "https://api.deepseek.com/v1", "apiKey": "...", "model": "deepseek-chat"}
    ]
  }
  ```
- MVP 不做设置 UI，**直接编辑 JSON 配置**，托盘菜单提供"打开配置文件"入口。

### 5. PromptBuilder

输入：`StuckSignal + 最近一帧截图（base64） + 当前窗口信息 + 最近 8 秒输入摘要`
输出：固定模板 prompt，例如：

```
你是用户的桌面助手。我观察到用户可能卡住了：
- 触发原因：{reason}
- 当前应用：{app} - {title}
- 最近的操作：{input_summary}
- 这是当前屏幕截图（见图）

请用 1-2 句中文给出 **简短、可立即行动** 的建议。如果你不确定用户在做什么，
回复"PASS"（不要找借口）。
```

`PASS` 时浮窗不弹出，避免无意义打扰。

### 6. Overlay Window

- BrowserWindow 配置：`frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, focusable: false, resizable: false`
- 尺寸 360×120，定位到主屏右下角
- 收到 IPC `show-suggestion` 时淡入，3 秒后淡出（CSS animation）
- 鼠标 hover 时取消自动隐藏，点击 X 立即隐藏
- **不抢焦点**，不打断用户

### 7. PrivacyFilter（最小实现）

- 维护一个 App 黑名单（默认含 "1Password", "KeePass", "WeChat", "QQ"，用户可改 config）
- 每次准备截图前先查 `windowWatcher.current()`，若 App 在黑名单 → 跳过这一帧
- 更复杂的密码框检测、URL 黑名单留到后续版本

---

## 启动流程（main/index.ts 串接逻辑）

```
app.whenReady()
  → 加载 config
  → 创建 Tray
  → 创建 OverlayWindow（隐藏状态）
  → 实例化 Capturer / WindowWatcher / InputHook
  → 实例化 Aggregator，订阅上面三个 source
  → 实例化两个 Detector + StuckOrchestrator，订阅 Aggregator
  → StuckOrchestrator.on('stuck', async (signal) => {
       if (privacyFilter.shouldSkip()) return
       const ctx = await contextBuilder.build(signal)
       const reply = await llmManager.current().chat(ctx)
       if (reply.text.trim() === 'PASS') return
       overlayWindow.webContents.send('show-suggestion', reply.text)
     })
```

---

## 验证方式

1. **环境准备**
   ```bash
   cd /workspace/monitor
   npm install
   ```
   填入 `~/.config/monitor/config.json` 中的 LLM API key。

2. **开发模式启动**
   ```bash
   npm run dev
   ```
   托盘出现图标，控制台打印事件流。

3. **手动触发卡住信号**
   - **重复按键测试**：在记事本里反复按 Enter ≥ 6 次 → 期望右下角弹出建议卡片
   - **画面无变化测试**：打开任意窗口静止 30 秒（不动鼠标键盘）→ 期望弹出建议卡片
   - **隐私测试**：把当前 App 名加到黑名单，重复触发 → 期望不弹出
   - **PASS 测试**：在屏幕上显示一片纯白 → LLM 应回 PASS → 浮窗不弹

4. **Provider 切换测试**
   - 在 config 里配置两个不同 provider，分别设为 active，重启验证两家都能调通
   - 故意填错 apiKey，验证错误能被 catch 并在控制台打印（不 crash）

5. **冷却测试**
   - 触发一次后，立即再次重复按键 → 期望不重复弹（30s 冷却内）

---

## 明确不在原型范围内（Out of Scope）

为了控制原型规模，下面这些**故意不做**：
- 设置 UI（直接编辑 JSON）
- macOS / Linux 实现（仅保留接口）
- OCR / UI 元素提取（截图直接喂 vision model）
- 用户偏好学习（接受/拒绝反馈）
- 加密存储 / 数据保留策略
- 密码框检测、敏感内容自动识别（仅 App 黑名单）
- 多屏支持（只截主屏）
- 安装包打包（只跑 dev 模式）
- 单元测试（只做手动验证）

---

## 风险与备注

1. **uiohook-napi 在 Windows 上需要 VC++ 运行时**，安装时若失败需要装 build tools。如果原型阶段不希望折腾，可以暂时不接 inputHook，仅用 ScreenIdleDetector 跑通闭环，后续再加。
2. **desktopCapturer 在 Windows 11 某些版本上对 HDR/多屏可能有 bug**，先在主屏 SDR 环境下验证。
3. **LLM 成本**：屏幕截图体积大，建议在 promptBuilder 里把图压到 1280px 长边以内（sharp 处理），并控制触发频率。
4. **跨平台抽象不要过度设计**：原型阶段每个 capturer 接口只有 1 个实现，直接写就行，不要先写 abstract class / factory，否则反而拖慢速度。
