# 阶段 5：托盘 + 浮窗 + 端到端串联

## 目标

把前面所有模块串起来：托盘常驻 → 检测到卡住 → 隐私过滤 → 调 LLM → 浮窗显示建议。第一次跑通端到端闭环。

## 子任务

### 5.1 PrivacyFilter
- [ ] 创建 `src/main/privacy/appBlacklist.ts`
- [ ] 输入：当前 `WindowInfo` + 黑名单数组
- [ ] 匹配规则：App 名做小写包含匹配（粗糙但够用）
- [ ] 暴露 `shouldSkip(windowInfo): boolean`

### 5.2 OverlayWindow（main 侧）
- [ ] 创建 `src/main/overlayWindow.ts`
- [ ] 创建 BrowserWindow，配置：
  - `frame: false`
  - `transparent: true`
  - `alwaysOnTop: true`
  - `skipTaskbar: true`
  - `focusable: false`
  - `resizable: false`
  - 尺寸 360x120，定位主屏右下角（用 `screen.getPrimaryDisplay().workArea`）
- [ ] 加载 renderer 入口
- [ ] 默认隐藏（`.hide()`）
- [ ] 暴露 `showSuggestion(text: string)` / `hide()`

### 5.3 Overlay Renderer
- [ ] 创建 `src/overlay/index.html`：一个简单卡片容器
- [ ] 创建 `src/overlay/overlay.ts`：
  - 监听 IPC `show-suggestion`
  - 渲染文本到卡片
  - 触发 CSS 淡入
  - 启动 3s 计时器，到点淡出 + 通知 main 隐藏
  - 鼠标 hover 时取消计时器，离开时重启
  - 点击 X 立即关闭
- [ ] 创建 `src/overlay/overlay.css`：圆角卡片 + 淡入淡出动画 + 半透明背景
- [ ] 创建 `src/preload/overlay.ts`：用 contextBridge 暴露 IPC 方法

### 5.4 Tray
- [ ] 创建 `src/main/tray.ts`
- [ ] 创建 `Tray` 实例，加一个 `assets/tray.png` 图标（16x16，先用纯色 PNG 占位）
- [ ] 菜单项：
  - "暂停 / 继续监控"（toggle）
  - "打开配置文件"（调 store.openConfigFile）
  - "查看日志"（可选，留个 placeholder）
  - "退出"（`app.quit()`）

### 5.5 主流程串联
- [ ] 改写 `src/main/index.ts`，按 `.docs/implementation_plan.md` 里的"启动流程"装配：
  - 加载 config → 注册 providers
  - 创建 Tray + OverlayWindow
  - 实例化 capturer / aggregator / detectors / orchestrator
  - 监听 `orchestrator.on('stuck')`，做隐私过滤 → 取最近截图 → 构建 prompt → 调 LLM → 处理 PASS → 推送 IPC
- [ ] 加上必要的 try/catch，避免一处异常导致整个 app 崩
- [ ] 加上结构化日志（`console.log` 即可，前缀加模块名）

### 5.6 Tray 暂停/继续
- [ ] orchestrator 增加 `pause()` / `resume()` 方法
- [ ] Tray 菜单 toggle 时调用并更新菜单文案

## Definition of Done

- [ ] `npm run dev` 启动后托盘出现
- [ ] 在记事本反复按 Enter → 右下角浮窗弹出 LLM 建议
- [ ] 浮窗 3s 后自动消失，hover 时不消失
- [ ] 托盘暂停后，再触发 → 浮窗不弹
- [ ] 托盘"打开配置文件"能用默认编辑器打开 JSON 配置

## 文件清单

```
src/main/privacy/appBlacklist.ts
src/main/overlayWindow.ts
src/main/tray.ts
src/main/index.ts                 (改写)
src/main/ipc.ts                   (channel 名称常量)
src/preload/overlay.ts
src/overlay/index.html
src/overlay/overlay.ts
src/overlay/overlay.css
assets/tray.png
```
