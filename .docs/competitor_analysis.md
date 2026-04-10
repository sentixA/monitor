# 竞品调研与方案分析

> 基于 `initial_intention.md` 中"实时屏幕监控 + 行为理解 + LLM 主动建议"的需求，对市面上同赛道产品进行调研，并对自研技术路线（按键 Hook + 定时截屏）做优劣分析。

## 一、市场全景

赛道已形成三种典型形态：

### 1. 记忆/回溯类（被动搜索为主）

| 产品 | 平台 | 核心特点 |
|---|---|---|
| Rewind AI / Limitless | macOS | 持续录屏+录音，本地压缩，LLM 走云。已被 Meta 收购 |
| Microsoft Recall | Win11 Copilot+ PC | 定时截图 + OCR，40+ 本地多模态小模型，全本地处理 |
| Screenpipe | Win/Mac/Linux | MIT 开源，24/7 录屏录音，Pipe 插件生态，$400 买断 |

核心是"可搜索的屏幕记忆"，主动性弱，更像时间机器。

### 2. 主动助手类（与需求最接近）

| 产品 | 核心特点 |
|---|---|
| Littlebird | 2026-03 融资 $11M，持续观察屏幕+会议+文档，主打 proactive insights |
| Cluely | 实时读屏+听音，隐藏浮层主动给话术提示，a16z 投资 |
| Highlight AI | 通用上下文感知，从个人扩展到团队智能 |
| Desktop Companion | 基于 Gemini Flash 2.0，实时分析截图 |
| Vercept | 已被 Anthropic 收购 |

这是需求文档描述的方向，Littlebird 是最直接的对手。

### 3. 开源可参考实现

- **Screenpipe**：最成熟的开源底座（录屏/OCR/存储/Agent 框架）
- **PyGPT**：跨平台桌面 AI 助手
- **Natively**：开源 Cluely 替代品，本地 RAG + BYOK

## 二、关键技术路线差异

1. **采样方式**：连续录屏（Rewind/Screenpipe）vs 定时截图（Recall）vs 事件触发（Cluely）
2. **理解管线**：OCR+向量检索 vs 直接多模态大模型看图
3. **隐私边界**：全本地（Recall）vs 本地存储+云 LLM（Rewind）vs 云优先（Cluely）
4. **触发模型**：被动查询 vs 主动推送——主动推送是最难的部分

## 三、能力矩阵

| 产品 | 采集 | 理解 | 检索 | 主动建议 | 隐私 | 平台 |
|---|---|---|---|---|---|---|
| Rewind/Limitless | 连续录屏+录音 | OCR+LLM | 强 | 中 | 本地+云 LLM | macOS |
| Microsoft Recall | 定时截图 | 本地多模态 SLM | 强 | 弱 | 全本地 | Win11 Copilot+ |
| Screenpipe | 连续录屏+录音 | OCR+可插拔 LLM | 中 | 弱 | 本地优先 | 跨平台 |
| Littlebird | 屏幕+会议 | 多模态 LLM | 中 | **强** | 云为主 | Mac/Win |
| Cluely | 实时截屏+音频 | 云多模态 | 无持久化 | **极强** | 云 | Mac/Win |
| Highlight AI | 全应用上下文 | 云 LLM | 中 | 强 | 云 | Mac/Win |

## 四、竞品优劣势总结

### 按场景切分的优势图谱

| 用户场景 | 最佳选择 | 原因 |
|---|---|---|
| 回忆"上次在哪看过 X" | Rewind / Recall | 记忆索引最强 |
| 面试/销售实时话术 | Cluely | 实时浮层 |
| 会议总结 + 行动项 | Highlight / Littlebird | 多路输入融合 |
| 开发者自建定制 | Screenpipe | 开源可扩展 |
| 企业级隐私合规 | Recall / 自建本地方案 | 全本地 |
| **主动工作建议** | **Littlebird** | 唯一原生主打 |

### 行业共性痛点（差异化空间）

1. **"主动"的阈值难把握**：推送频率、时机、置信度是未解问题，用户容易觉得被打扰然后关掉
2. **隐私-能力权衡**：全本地能力弱，云隐私差，中间态不彻底
3. **理解深度浅**：多数产品只做 OCR + 截图输入 LLM，缺乏对任务/意图/工作流的结构化建模
4. **持续运行代价**：24/7 录屏的 CPU/磁盘/电池开销是硬约束（Rewind 吃电是常见吐槽）
5. **跨设备/跨应用上下文对齐**：几乎没人做好

## 五、自研方案分析：按键 Hook + 定时截屏

### 方案本质拆解

两个组件解决不同问题：

| 组件 | 作用 | 本质 |
|---|---|---|
| 按键 Hook | 触发信号 / 意图探测 | **事件源**：告诉你"该看了" |
| 定时截屏 | 状态快照 | **数据源**：告诉你"看到了啥" |

真正的差异化不是"截屏代替录屏"，而是**事件驱动采样 vs 连续盲目采样**。

### 资源开销对比（核心优势）

| 方案 | CPU | 磁盘 IO | 电池 | 相对值 |
|---|---|---|---|---|
| Rewind/Screenpipe 连续录屏 | 视频编码持续占用 | 持续写入 | 高耗电 | 100 |
| Recall 定时截屏（~5s 盲采）| 周期性峰值 | 周期性写入 | 中 | 20 |
| **本方案**（事件驱动截屏）| 事件尖峰 | 按需写入 | 低 | **5-10** |

这是方案最大优势：对续航敏感的 MacBook 用户天然友好。

### 语义完整度（结构性劣势）

| 场景 | 连续录屏 | 定时盲采 | 按键事件驱动 |
|---|---|---|---|
| 敲代码 | ✓ | ✓ | ✓✓（意图最强）|
| 看视频/读文档 | ✓ | ✓ | ✗（无按键盲区）|
| 拖拽/设计 | ✓ | ✓ | ✗（纯鼠标丢失）|
| 开会说话 | ✓（带音频）| ✗ | ✗ |
| 弹窗/瞬时 UI | ✓ | ✗ | ✗ |

**致命盲区**：阅读、看视频、设计、浏览这类只读/鼠标型工作流，纯按键驱动完全捕捉不到。

### 隐私和工程风险

| 维度 | 本方案 | 连续录屏方案 |
|---|---|---|
| 用户心理 | **高风险**（"keylogger" 标签）| 中 |
| macOS 权限 | 辅助功能 + 输入监控**两道弹窗** | 屏幕录制权限 |
| Windows 实现 | `SetWindowsHookEx` **常被杀软误报** | DXGI 截屏较干净 |
| Linux 实现 | X11 可行，**Wayland 基本不可能** | Wayland 有专门 API |

"按键 Hook" 在用户认知里等于键盘记录器，这是比技术更难的信任门槛。

### 与竞品对位

**能打赢的场景**：
1. 资源轻量（续航/发热敏感用户）
2. 开发/写作类键盘密集工作流
3. 低存储（可做"当前状态→建议"，不做长期记忆）
4. 可解释的触发时机（比靠模型猜时机更稳）

**打不过的场景**：
1. 纯阅读/浏览 → 输给 Recall/Rewind
2. 会议助手 → 输给 Cluely/Highlight
3. 长期回溯搜索 → 输给 Rewind/Screenpipe
4. 跨应用全景理解 → 输给 Littlebird
5. macOS App Store 上架几乎无望

## 六、方案改进建议

### 1. 按键 Hook 只取元数据，不记录内容

- 按键频率（判断是否专注）
- 修饰键组合（`Cmd+Tab`/`Cmd+C`/`Ctrl+S` 等状态变化信号）
- 输入间隔（任务切换识别）

把"只存元数据，不记录按键内容"写进产品承诺和架构约束，规避 keylogger 标签。

### 2. 补充低成本信号源弥补盲区

| 信号 | 能补什么 | 成本 |
|---|---|---|
| 活跃窗口/应用 API | 应用切换事件 | 低，无敏感权限 |
| 鼠标活动级别 | 操作 vs 挂机 | 低 |
| 系统空闲时间 | 任务段边界 | 低 |
| 剪贴板变化事件 | 强意图信号 | 低 |

加上这四样后，盲区只剩纯阅读，可靠低频兜底截屏补救。

### 3. 截屏策略：事件触发 + 低频兜底

```
按键停顿 300ms（状态稳定）→ 截屏
应用切换                  → 截屏
剪贴板变化                → 截屏
30s 无任何事件            → 兜底截屏
```

比 Recall 的 5s 盲采更精准，比纯事件驱动更鲁棒。

### 4. 理解层分两级降本

- **本地轻量层**：OCR + 窗口标题 + 快速分类（IDE/浏览器/聊天），过滤无意义帧
- **远程大模型层**：仅在需要生成建议时，把最近 N 张有意义截屏 + 行为摘要上传

目标：LLM 调用频率压到每分钟 1-2 次。

## 七、最终定位建议

**方案方向正确，但不应与 Rewind/Recall 对标**。产品定位应为：

> 轻量级、意图驱动的"工作流副驾"，聚焦开发和写作类键盘密集场景，不追求全景记忆，只追求"看懂当前在干什么并给建议"。

主要对手不是 Rewind（产品形态不同），而是 **Cluely 的实时提示路线**——但比 Cluely 更尊重隐私、更懂"连续工作"而非"对话"。

### 风险与硬约束

1. **macOS 权限门槛**：辅助功能 + 输入监控需要用户手动授权，上来就劝退一批用户
2. **用户心理门槛**：keylogger 标签需要正面澄清并写入产品承诺
3. **Wayland 不可行**：Linux 版本只能支持 X11 或放弃
4. **Windows 杀软误报**：`SetWindowsHookEx` 需要做签名 + 白名单适配
5. **阅读/设计场景盲区**：靠兜底截屏缓解，但用户价值打折

### 下一步

- [ ] 最小可行验证：在 macOS 上用 Swift/Python 实现事件驱动截屏 + 元数据采集
- [ ] 确认按键元数据的最小必要集合（隐私审计）
- [ ] 本地 OCR + 分类管线选型（Tesseract / Vision framework）
- [ ] LLM 接入方式与成本上限设计

## 参考来源

- [Screen Assistant AI in 2026 — Screenpipe Blog](https://screenpi.pe/blog/screen-assistant-ai-2026)
- [Littlebird raises $11M — TechCrunch](https://techcrunch.com/2026/03/23/littlebird-raises-11m-to-capture-context-from-your-computer-so-you-can-query-your-data/)
- [Screenpipe GitHub](https://github.com/mediar-ai/screenpipe)
- [Screenpipe vs Rewind](https://docs.screenpi.pe/vs-rewind)
- [Cluely](https://cluely.com/)
- [Highlight AI](https://highlightai.com/)
- [Desktop Companion](https://desktopaicompanion.com/en)
- [Microsoft Recall — Engadget](https://www.engadget.com/with-recall-microsoft-is-using-ai-to-fix-windows-eternally-broken-search-172510698.html)
