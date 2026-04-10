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

- [ ] **A. 脚本不报错**：能完整跑完，不抛 unhandled exception
- [ ] **B. 截图采集成功**：打印的截图尺寸/字节数合理（不是 0）
- [ ] **C. LLM 返回非空文本**：不是空字符串、不是 PASS、不是错误对象
- [ ] **D. LLM 真的"看懂了"屏幕**：响应文本里要包含 **当前屏幕上确实存在** 的具体元素（应用名、文件名、按钮文字、可见的代码片段等）。如果只有"这是一个桌面窗口"这种泛泛描述 —— **算 D 不通过**
- [ ] **E. 建议是可行动的**：响应里有动词引导的建议（"点击 X" / "检查 Y" / "试试 Z"），不是纯描述

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

- [ ] 上面 5 项至少 4 项通过
- [ ] 在本文件底部写一段 5-10 行的"验证记录"，说明：用了哪个 model / 截了什么屏 / LLM 输出 / 哪几项通过
- [ ] 把这个分支 merge 到 main 之前 **必须** 完成验证记录

## 验证记录（待填写）

待跑通后填写。

```
日期：
模型：
截屏内容：
LLM 输出（截断）：
通过项：A__ B__ C__ D__ E__
结论：
```
