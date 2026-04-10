# monitor

桌面 AI Copilot 原型：实时观察屏幕，理解用户在做什么，并主动给出建议。

目前仓库处于 **MVU（最小可验证单元）** 阶段，验证「截图 → 云端 vision LLM → 中文建议」这条最核心的链路是否成立。Electron 外壳、卡住检测、托盘浮窗等完整原型工作尚未开始，分阶段任务清单见 [`.tasks/`](.tasks/)。

## 快速开始（MVU）

```bash
npm install
cp config.example.json config.json
# 编辑 config.json，填入真实的 Anthropic apiKey
npm run mvu
```

预期：脚本截一张当前屏幕，调用 Claude vision，几秒内打印一段中文建议。详细的验证判定标准见 [`.tasks/00-mvu.md`](.tasks/00-mvu.md)。

## 文档

所有设计与规划文档集中在 [`.docs/`](.docs/)，按阅读顺序：

1. [`initial_intention.md`](.docs/initial_intention.md) — 最初的一句话需求
2. [`requirement_breakdown.md`](.docs/requirement_breakdown.md) — 需求拆分与方向问题
3. [`competitor_analysis.md`](.docs/competitor_analysis.md) — 竞品调研与自研路线分析
4. [`implementation_plan.md`](.docs/implementation_plan.md) — 原型架构与技术选型

任务拆解和阶段进度在 [`.tasks/README.md`](.tasks/README.md)。

## 项目结构

```
.
├── README.md                  本文件
├── config.example.json        LLM provider 配置模板
├── package.json               依赖与脚本
├── src/
│   ├── llm/                   LLM provider 抽象 + Claude 实现 + prompt 模板
│   └── mvu/runOnce.ts         MVU 入口：截图 → LLM → 打印
├── .docs/                     设计与规划文档
└── .tasks/                    分阶段任务清单
```
