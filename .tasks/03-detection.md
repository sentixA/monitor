# 阶段 3：行为理解与卡住检测

## 目标

把感知层的原始信号聚合到 Aggregator，再由两个 Detector 分析得出 `StuckSignal`。控制台能看到"检测到卡住，原因 = X"的日志。

## 子任务

### 3.1 Aggregator（滑动窗口）
- [ ] 创建 `src/main/perception/aggregator.ts`
- [ ] 内部维护两个环形缓冲：
  - `inputEvents: {ts, type, payload}[]` — TTL 60s
  - `screenshots: {ts, phash}[]` — 最多 20 帧
- [ ] 提供 API：
  - `recordInput(event)`
  - `recordScreenshot(phash)`
  - `recentInputs(windowMs): InputEvent[]`
  - `recentScreenshots(): ScreenshotEntry[]`
- [ ] 启动定时器：每 1.5s 触发一次截图采集

### 3.2 pHash 工具
- [ ] 创建 `src/main/perception/phash.ts`
- [ ] 输入：PNG buffer
- [ ] 处理：sharp resize 32x32 → 灰度 → 简化 DCT（或直接均值 hash 也行）→ 64-bit
- [ ] 输出：`bigint`
- [ ] 工具函数：`hammingDistance(a, b): number`

### 3.3 RepeatInputDetector
- [ ] 创建 `src/main/detector/repeatInputDetector.ts`
- [ ] 订阅 Aggregator 的 input 事件
- [ ] 维护按 key 分组的时间戳列表
- [ ] 触发条件：
  - 同一按键 ≥ 6 次 / 8s
  - 同一坐标点击 ≥ 4 次 / 8s（半径 30px）
- [ ] 触发后冷却 30s
- [ ] 输出 `StuckSignal { reason: 'repeat-input', evidence: {...} }`

### 3.4 ScreenIdleDetector
- [ ] 创建 `src/main/detector/screenIdleDetector.ts`
- [ ] 订阅 Aggregator 的 screenshot 事件
- [ ] 检查最近 20 帧（≈30s）pHash 两两 Hamming distance ≤ 5
- [ ] 排除条件：这 30s 内 input 事件 > 50 次（用户在打字）
- [ ] 触发后冷却 60s
- [ ] 输出 `StuckSignal { reason: 'screen-idle', evidence: {...} }`

### 3.5 StuckOrchestrator
- [ ] 创建 `src/main/detector/stuckOrchestrator.ts`
- [ ] 注册多个 detector，统一发出 `'stuck'` 事件（EventEmitter）
- [ ] 全局冷却：任意 detector 触发后 20s 内不再发新信号

### 3.6 烟雾测试
- [ ] 在 main 里串起来：capture → aggregator → detector → orchestrator
- [ ] 手动按 Enter 6 次 → 控制台应打印 `STUCK: repeat-input`
- [ ] 静止 30s → 控制台应打印 `STUCK: screen-idle`
- [ ] 测试通过后保留 console.log（阶段 5 接 LLM 时会替换）

## Definition of Done

- [ ] 重复按键能触发，且冷却期内不重复触发
- [ ] 屏幕静止能触发，且打字时不会误触发
- [ ] 两类 detector 互不阻塞，可同时启用

## 文件清单

```
src/main/perception/aggregator.ts
src/main/perception/phash.ts
src/main/detector/types.ts
src/main/detector/repeatInputDetector.ts
src/main/detector/screenIdleDetector.ts
src/main/detector/stuckOrchestrator.ts
```
