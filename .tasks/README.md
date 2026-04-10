# 任务拆解 — 桌面 AI Copilot 原型

实施依据：[`../.docs/implementation_plan.md`](../.docs/implementation_plan.md)

阶段 0 是「最大假设是否成立」的最小可验证单元，独立先行；阶段 1-6 是原型本体，**严格按阶段顺序执行**，每个阶段完成后再进入下一阶段，避免半成品堆积。

| 阶段 | 文件 | 目标 | 依赖 |
|---|---|---|---|
| 0 | [00-mvu.md](00-mvu.md) | 验证「截图 → vision LLM → 有用建议」这条核心假设 | — |
| 1 | [01-foundation.md](01-foundation.md) | Electron + TS 项目骨架，能 `npm run dev` 起一个空窗口 | — |
| 2 | [02-capture.md](02-capture.md) | 屏幕截图 / 前台窗口 / 全局键鼠 三类信号能采到 | 阶段 1 |
| 3 | [03-detection.md](03-detection.md) | Aggregator + 两个 Detector 能输出 `StuckSignal` | 阶段 2 |
| 4 | [04-llm.md](04-llm.md) | 多 Provider LLM 抽象，能用配置文件切换并真正调通 vision API | 阶段 1（不依赖 2/3） |
| 5 | [05-presentation.md](05-presentation.md) | 托盘 + 浮窗 + 隐私过滤，端到端串起来 | 阶段 3 + 阶段 4 |
| 6 | [06-verification.md](06-verification.md) | 跑通 4 个手动测试场景 | 阶段 5 |

## 总体里程碑

- **M0（阶段 0 完成）**：MVU 跑通，确认 vision LLM 能从一张真实截图产出可行动建议
- **M1（阶段 1 完成）**：能 `npm run dev`，托盘出现，但无功能
- **M2（阶段 3 完成）**：控制台能打印"检测到卡住"日志
- **M3（阶段 4 完成）**：能用 curl 风格的脚本测试 LLM provider 单独可用
- **M4（阶段 5 完成）**：第一次端到端打通 — 重复按键 → 浮窗弹出建议
- **M5（阶段 6 完成）**：4 个验证场景全部通过，原型交付

## 进度追踪

- 子任务用 `- [ ]` / `- [x]` 标记
- 每完成一个任务勾选一次
- 阶段全部完成后在本文件对应行打勾：

- [ ] 阶段 0
- [ ] 阶段 1
- [ ] 阶段 2
- [ ] 阶段 3
- [ ] 阶段 4
- [ ] 阶段 5
- [ ] 阶段 6
