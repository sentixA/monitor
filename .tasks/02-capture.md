# 阶段 2：感知层（Capture）

## 目标

实现三类信号采集，每类有独立的接口和 Windows 实现。能在主进程里订阅事件并打印到控制台。

## 子任务

### 2.1 接口定义
- [ ] 创建 `src/main/capture/types.ts`，定义三个接口：
  - `ScreenCapturer { capture(): Promise<Buffer> }`
  - `WindowWatcher { current(): Promise<WindowInfo | null> }`
  - `InputHook { on(event, handler), start(), stop() }`
- [ ] 定义事件类型：`KeyEvent`, `MouseEvent`, `WindowInfo`

### 2.2 ScreenCapturer（屏幕截图）
- [ ] 创建 `src/main/capture/screenCapturer.ts`
- [ ] 用 `desktopCapturer.getSources({types: ['screen']})` 获取主屏 source
- [ ] 用 `nativeImage` 转 PNG buffer
- [ ] 用 `sharp` 缩放到长边 ≤ 1280px，控制 LLM 调用成本
- [ ] 测试：`new ScreenCapturer().capture()` 返回非空 buffer

### 2.3 WindowWatcher（前台窗口轮询）
- [ ] 创建 `src/main/capture/windowWatcher.ts`
- [ ] 引入 `get-windows` 包
- [ ] 实现 `current()` 返回 `{app, title, pid}`
- [ ] **不做**事件订阅，由上层 Aggregator 节流轮询

### 2.4 InputHook（全局键鼠 hook）
- [ ] 安装 `uiohook-napi`（可能需要 `--build-from-source`，失败的话先跳过）
- [ ] 创建 `src/main/capture/inputHook.ts`
- [ ] 包装 uiohook 的 `keydown` / `mousedown` / `mousemove` 事件
- [ ] 用 EventEmitter 暴露 `on('key' | 'click' | 'move')`
- [ ] **降级方案**：如果 uiohook-napi 装不上，导出一个空实现，主流程跳过 RepeatInputDetector

### 2.5 烟雾测试
- [ ] 在 `src/main/index.ts` 临时加测试代码：
  - 实例化三个 capturer
  - 截一张图，打印 buffer 长度
  - 取一次前台窗口，打印 app 名
  - 启动 input hook，按几个键看是否打印
- [ ] 测试通过后**删掉测试代码**

## Definition of Done

- [ ] 控制台能看到屏幕截图大小、当前窗口、按键事件
- [ ] 每个 capturer 文件能独立 import，无循环依赖
- [ ] 即使 uiohook-napi 装失败，整个 app 仍能启动（降级处理）

## 文件清单

```
src/main/capture/types.ts
src/main/capture/screenCapturer.ts
src/main/capture/windowWatcher.ts
src/main/capture/inputHook.ts
```
