# 阶段 0：最小可验证单元（MVU）

> 在阶段 1-6 之前的"零号阶段"。验证产品最大假设是否成立。

## 假设

> 给一张真实桌面截图，云端 vision LLM 能否产出"有用的、可立即行动的"中文建议？

如果这个假设不成立 —— 比如 LLM 看截图只能复读"这是一个屏幕，上面有窗口"这种废话 —— 那整个产品方向需要重新评估。所以必须先单独验证。

## 范围（故意极小）

**做**：
- TypeScript 脚本，`tsx` 直接运行，不打包
- 调用屏幕截图（用 `screenshot-desktop`，跨平台 CLI 包装）
- `sharp` 压缩到长边 1280px
- Provider 接口骨架（为未来多 provider 预留）
- Claude Messages API（vision）调用

**不做**：
- Electron / 托盘 / 浮窗 / 任何 GUI
- 卡住检测、pHash、滑动窗口
- 全局键鼠 hook
- 隐私过滤
- 多 provider 实现（接口先放上，实现先 1 个）

## 文件清单

```
package.json
tsconfig.json
.gitignore
config.example.json          # 配置文件模板
src/
├── llm/
│   ├── provider.ts          # LLMProvider 接口（为多 provider 预留）
│   ├── claudeNative.ts      # Anthropic Messages API 实现
│   └── promptBuilder.ts     # 提示词模板
└── mvu/
    └── runOnce.ts           # 入口：截图 → LLM → 打印
```

## 验证步骤

### 准备
```bash
cd /workspace/monitor   # 即 /Users/stypro/cc_mnt/monitor
git checkout mvu/screen-llm-loop
npm install
```

### 配置 API key
```bash
cp config.example.json config.json
# 编辑 config.json，填入真实的 Anthropic apiKey
```

### 执行 MVU
```bash
npm run mvu
```

### 期望输出
脚本应该在 ≤ 15 秒内输出类似：

```
[mvu] capturing screen...
[mvu] screenshot: 1280x800, 156 KB
[mvu] calling LLM (claude-opus-4-6)...
[mvu] response (3.2s, 142 tokens):
---
你正在 VS Code 里看一段 TypeScript 代码，光标停在第 42 行的一个 type
error 上。建议先把鼠标 hover 到红色波浪线上看错误详情，然后检查上面
的 import 是否正确。
---
[mvu] OK
```

## 验证通过的判定标准

逐项打勾：

- [x] **A. 脚本不报错**：能完整跑完，不抛 unhandled exception
- [x] **B. 截图采集成功**：打印的截图尺寸/字节数合理（不是 0）
- [x] **C. LLM 返回非空文本**：不是空字符串、不是 PASS、不是错误对象
- [x] **D. LLM 真的"看懂了"屏幕**：响应文本里要包含 **当前屏幕上确实存在** 的具体元素（应用名、文件名、按钮文字、可见的代码片段等）。如果只有"这是一个桌面窗口"这种泛泛描述 —— **算 D 不通过**
- [x] **E. 建议是可行动的**：响应里有动词引导的建议（"点击 X" / "检查 Y" / "试试 Z"），不是纯描述

**4/5 通过即视为 MVU 成立**。如果 D 不通过，需要：
1. 换更大的模型（claude-opus-4-6 → 已经是最强了，那就换 GPT-4o 或 Gemini 2.5 Pro 对比）
2. 调 prompt 模板
3. 调截图分辨率（太低 LLM 看不清细节）

## 验证失败的应对

| 失败项 | 排查方向 |
|---|---|
| A 失败（异常） | 看 stack，多半是 npm 包没装上、Node 版本不对、API key 错 |
| B 失败（截图空） | macOS 需要授予终端"屏幕录制"权限（系统偏好 → 隐私 → 屏幕录制） |
| C 失败（空响应） | 检查 API key 是否有效、网络是否能直连 Anthropic、模型名是否正确 |
| D 失败（LLM 不懂） | **MVU 失败的核心信号**，需要换模型或重写 prompt |
| E 失败（无建议） | 改 prompt：明确要求"以动词开头" |

## Definition of Done

- [x] 上面 5 项至少 4 项通过
- [x] 在本文件底部写一段 5-10 行的"验证记录"，说明：用了哪个 model / 截了什么屏 / LLM 输出 / 哪几项通过
- [x] 把这个分支 merge 到 main 之前 **必须** 完成验证记录

## 验证记录

```
日期：2026-04-10
模型：glm-4.6v (智谱 BigModel)
端点：https://open.bigmodel.cn/api/paas/v4/chat/completions  (OpenAI 兼容协议)
关键参数：extraBody.thinking = { type: "enabled" }   ← BigModel vision 模型必须传
截屏内容：用户实测，日常桌面（具体未粘贴回 task 文件，详见 PR #8 评论里的实测对比）
LLM 输出：用户确认引用了屏幕上真实存在的元素 + 给出基于真实内容的可行动建议
通过项：A✓ B✓ C✓ D✓ E✓  (5/5 通过)
结论：MVU 假设成立 — 云端 vision LLM 能从一张真实桌面截图产出有用的、可
立即行动的中文建议。
```

### 路径上踩到的两个深坑（详见 PR #8）

整个 MVU 验证不是一次跑通的，先后被两个深坑卡住，记录在这里供后续阶段参考：

**坑 1 — 协议层：智谱 `/api/anthropic` 桥不支持 vision**

最初 config 用的是 `type: claude-native` + `baseUrl: .../api/anthropic` + `model: glm-4.6v`。
请求能 200，但 `input_tokens=345` —— 1920×1080 的图按正常 vision tokenization 应该
是 ~2700+，345 = system prompt only。**桥把 image content block 整块丢了**。LLM 拿不
到任何视觉信息，只能照抄 promptBuilder 里的 system prompt 例子（"在 VS Code 里编辑
某个 TS 文件"），用户当时屏幕实际是终端，模型输出 "在 VS Code 里编辑 index.html"
——这是 "模型零视觉上下文，fallback 到 in-prompt example" 的教科书签名。

智谱官方文档（`docs.bigmodel.cn/cn/guide/develop/claude`）确认：`/api/anthropic` 桥
列出的支持模型只有 GLM-4.7 / 4.5-Air / 5.1 / 5-Turbo / 5，全是文本模型。

**修复**：实现 OpenAI 兼容 provider，切到原生 `/api/paas/v4/chat/completions`。

**坑 2 — 模型层：GLM-4.6V 必须传 `thinking: enabled` 才会启用 vision 推理**

切到原生端点后**还是不行** —— 模型识别得出大类应用但读不出具体页面文字。第二轮翻
GLM-4.6V 的官方文档（`docs.bigmodel.cn/cn/guide/models/vlm/glm-4.6v`）发现所有示例
都带 `"thinking": { "type": "enabled" }` 字段。这是 BigModel vision 专属参数，
标准 OpenAI 协议没有。不传它 = 不启用 vision 推理路径 = 模型只能给出大类描述。

**修复**：给 ProviderConfig 加 `extraBody?: Record<string, unknown>` 字段，BigModel
配置走 `extraBody: { thinking: { type: "enabled" } }`。

### 给后续阶段的教训

1. **不要相信 "OpenAI 兼容" 的字面承诺**。第三方网关（中转、桥、proxy）声称兼容
   OpenAI/Anthropic 协议时，常见做法是只在 happy path（纯文本对话）兼容。多模态、
   函数调用、structured output 这些都需要单独验证，不能假设兼容。

2. **`input_tokens` 是检测图像是否真的进了模型的最便宜信号**。一张正常分辨率的
   截图理应消耗 1500-3000+ image tokens；如果总 input 只有几百，要么图被丢了，
   要么后端模型不是 vision。比读 LLM 输出判断是否幻觉快得多。

3. **PR #6 的教训**：基于"LLM 看到 Chrome 但读不出页面 → 一定是分辨率不够"的
   误诊，开了一个把 1280 提到 1920 的 PR。后来发现根因是 endpoint 丢图，那个
   "Chrome" 是模型在零视觉信息下编的。**在没有数据支撑的情况下，理论分析也可能
   完全跑偏。下次诊断 vision bug 第一步应该是查 input_tokens，不是猜分辨率。**

4. **BigModel vision 模型专属字段（`thinking`）不能硬编码进 openaiCompat provider**，
   会污染未来要接的 OpenAI 直连等其他 OpenAI-compat 服务。走 `extraBody` 配置项，
   每个 provider 自己声明自己的非标准字段。
