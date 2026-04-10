# 阶段 6：验证

> ⚠️ **本阶段大部分子任务 blocked，等待 [`.docs/todo.md`](../.docs/todo.md) #1「跨平台构建与验证环境」决策落地。**
>
> **原因**：开发环境是 macOS host 上的 Linux 容器（aarch64 / linuxkit / 无 KVM），没有可信通路到真 Windows 桌面。已排除"容器 SSH 进 host VM"方案 —— 会破坏环境隔离。
>
> **当前可做的子集**（不依赖真 Windows）：
> - 6.1 环境准备里的 `npm install` / typecheck 部分，可在容器内跑
> - 6.6 LLM provider 切换的前半段（纯 API 调用，不依赖桌面行为）
>
> **必须等环境决策的子集**：6.2 / 6.3 / 6.4 / 6.5 / 6.7 全部 —— 这些都需要真实 Windows 桌面 + 托盘 + 浮窗 + 全局键鼠 hook。
>
> **解封触发条件**：`.docs/todo.md` #1 决策完成，且至少 1 台 Windows 构建机就位。

## 目标

按照 `.docs/implementation_plan.md` 的"验证方式"逐项跑通，确认原型达到 demo 标准。发现问题就回到对应阶段修。

## 子任务

### 6.1 环境准备
- [ ] `npm install` 干净环境跑通
- [ ] 配置文件路径确认（Windows 下 `electron-store` 默认在 `%APPDATA%/<appName>/config.json`）
- [ ] 在配置文件里填好至少 1 家 LLM provider 的真实 apiKey
- [ ] `npm run dev` 启动，托盘出现，无报错

### 6.2 重复按键测试
- [ ] 打开记事本，光标聚焦
- [ ] 反复按 Enter ≥ 6 次（在 8 秒内）
- [ ] **预期**：右下角弹出建议卡片，内容跟"反复回车"相关
- [ ] 立刻再按 6 次 → **预期**：30s 内不重复弹

### 6.3 屏幕画面无变化测试
- [ ] 打开任意窗口（比如一份文档）
- [ ] 完全停手 30 秒（不动键盘鼠标）
- [ ] **预期**：浮窗弹出，建议跟当前画面内容相关
- [ ] 立刻保持静止 → **预期**：60s 内不重复弹

### 6.4 隐私过滤测试
- [ ] 在配置 blacklist 里加入"记事本"或"Notepad"
- [ ] 在记事本反复按 Enter
- [ ] **预期**：浮窗不弹出，控制台打印"skip: in blacklist"

### 6.5 LLM PASS 路径测试
- [ ] 把屏幕显示成全白（最大化画图工具/白色壁纸）
- [ ] 触发 ScreenIdle
- [ ] **预期**：LLM 返回 `PASS`，浮窗不弹

### 6.6 Provider 切换测试
- [ ] 配置两家不同 provider
- [ ] active 切到第一家，重启，触发 → 验证可用
- [ ] active 切到第二家，重启，触发 → 验证可用
- [ ] 把第一家 apiKey 故意改错，触发 → **预期**：控制台报错，进程不 crash

### 6.7 托盘控制测试
- [ ] 点击"暂停监控" → 触发卡住信号 → **预期**：浮窗不弹
- [ ] 点击"继续监控" → 再触发 → **预期**：浮窗弹
- [ ] 点击"打开配置文件" → **预期**：默认编辑器打开 JSON
- [ ] 点击"退出" → **预期**：进程干净退出

## 出问题怎么办

| 现象 | 排查方向 |
|---|---|
| 托盘不出现 | 检查 tray 图标路径，Win 上 PNG 不能太大 |
| 截图为空 | desktopCapturer 权限 / 多屏配置 |
| uiohook 报错 | 装 VC++ 运行时，或退化到只用 ScreenIdleDetector |
| LLM 调用超时 | 检查代理 / baseUrl / 网络 |
| 浮窗不消失 | 检查 IPC channel 名称是否一致 |
| 浮窗抢焦点 | 确认 focusable: false 配置 |

## Definition of Done

- [ ] 6.2 ~ 6.7 全部通过
- [ ] 写一段简短的"演示脚本"放进 `README.md`，告诉别人怎么 5 分钟跑通 demo
- [ ] 在 `.tasks/README.md` 把 6 个阶段全部勾上
