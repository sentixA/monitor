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
- [ ] 调用前必须 `await app.whenReady()`，否则 desktopCapturer 不可用
- [ ] 用 `screen.getPrimaryDisplay()` 拿尺寸 + scaleFactor，再调用
      `desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width:size.w*scale, height:size.h*scale } })`
  - **`thumbnailSize` 单位是 DIP 不是物理像素**，HiDPI 屏要手动乘 scaleFactor，不然图是糊的
- [ ] 多屏时用 `source.display_id === String(primary.id)` 过滤主屏；找不到就用 `sources[0]` 兜底
- [ ] 用 `thumbnail.toPNG()` 拿 PNG buffer（thumbnail 是 NativeImage，不要再走 nativeImage.createFromBuffer）
- [ ] 用 `sharp` 缩放到长边 ≤ 1280px，控制 LLM 调用成本
- [ ] 测试：`new ScreenCapturer().capture()` 返回非空 buffer

### 2.3 WindowWatcher（前台窗口轮询）
- [ ] 创建 `src/main/capture/windowWatcher.ts`
- [ ] 引入 `get-windows` 包（**ESM-only since v9，从 CJS main 进程必须用 `await import('get-windows')`，不能 require**）
- [ ] 实现 `current()` 返回 `{app, title, pid}`
  - get-windows 返回的形状是 `{ owner: { name, processId, ... }, title, ... }`，需要在我们的 watcher 里映射成 `{app, title, pid}`
  - 桌面无前台窗口时返回 `undefined`（不是 null），需要归一化
- [ ] **不做**事件订阅，由上层 Aggregator 节流轮询

### 2.4 InputHook（全局键鼠 hook）
- [ ] 安装 `uiohook-napi`（v1.5.5 经过验证可装上，npm 不需要 `--build-from-source`，自带 prebuild）
- [ ] 创建 `src/main/capture/inputHook.ts`
- [ ] **必须用 try/catch 包 `require('uiohook-napi')`**：在不支持的平台上原生 binding 加载会同步抛异常，不要用静态 ESM import 否则整个文件都加载不了
- [ ] 包装 uiohook 的 `keydown` / `mousedown` / `mousemove` 事件
- [ ] uiohook 的 `UiohookMouseEvent.button` 类型是 `unknown`，要 `typeof === 'number' ? : 0` 兜底
- [ ] uiohook 暴露的是单例 `uIOhook`（小写 i + 大写 IO），不是 class，整个进程只能有一个
- [ ] 用 EventEmitter 暴露 `on('key' | 'click' | 'move')`
- [ ] **降级方案**：如果 uiohook-napi 装不上 / prebuild 与平台不匹配，导出一个空实现 (`isAvailable=false`)，主流程跳过 RepeatInputDetector
- [ ] 已知：v1.5.5 的 `linux-arm64/uiohook-napi.node` 实际上是 x86-64 ELF（上游 prebuild bug），ARM Linux 上必跌进降级路径。Windows/macOS 的 prebuild 没遇到这个问题

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

---

## 验证记录（worktree: `verify-task02-capture`，2026-04-10）

> 第一轮在 `.claude/worktrees/verify-task02-capture/` 里搭最小骨架 + 写实现，环境是 Linux ARM64 容器无 X server，只能做装包 / TS 编译 / 模块加载 / 降级路径。
> **第二轮（2026-04-10 后续）**：用户在 Windows 上跑了 `npm run smoke`，三项跨平台空白补齐了，又多出 3 条新发现，见下方"Windows 实跑追加发现"。

### 验证项与结果

| 项目 | 结果 | 备注 |
|---|---|---|
| `npm install electron typescript @types/node sharp get-windows` | ✅ | 22 包，无错误 |
| `npm install uiohook-napi` | ✅ | 自带 prebuild，无需 `--build-from-source` |
| `tsc --noEmit` | ✅ | 见下方"必踩坑"修过几处 |
| 模块加载（脱离 Electron 进程，纯 Node `require`）| ✅ | `screenCapturer` / `windowWatcher` / `inputHook` 都能 `require`，不会爆炸 |
| `createInputHook()` 降级路径 | ✅ | linux-arm64 prebuild 加载失败 → 自动落到 `NoopInputHook`，warn 一行 |
| 实际 `desktopCapturer.getSources()` 调用 | ✅ | Windows 实跑：返回 ~927 KB PNG，header `89504e470d0a1a0a` 正确 |
| 实际 `get-windows.activeWindow()` 调用 | ✅ | Windows 实跑：返回 `{app, title, pid}`，但有 Terminal host 陷阱 → 见 9 |
| 实际 uiohook 键鼠事件 | ✅ | Windows 实跑：`isAvailable=true`，`start()` / `stop()` 干净 |

### 必踩坑（直接抄就行）

1. **TypeScript 6 把 `moduleResolution: "Node"` 列为硬错误**
   - `npm install typescript@latest` 现在拿到 6.0.x，旧的 `moduleResolution: "Node"` (= node10) 直接编译报错。
   - 修法：`tsconfig.json` 用 `"module": "Node16", "moduleResolution": "Node16"`。或者钉 typescript 5.x。

2. **`get-windows` 是 ESM-only，CJS main 进程要动态 import**
   ```ts
   const mod = await import('get-windows');
   const active = await mod.activeWindow();
   ```
   静态 `import { activeWindow } from 'get-windows'` 在 `module: Node16 + commonjs` 下会报错。

3. **`get-windows` 返回形状跟实施计划写的不一样**
   - 实施计划写的 `{app, title, pid}` 是**我们自己想要的**形状。
   - 上游真正返回的是 `{ owner: { name, processId, path, ... }, title, ... }`，无前台窗口时返回 `undefined`（不是 `null`）。
   - watcher 里要做映射 + null 归一。

4. **`desktopCapturer.thumbnailSize` 是 DIP 不是物理像素**
   - 直接传 `screen.getPrimaryDisplay().size` 在 HiDPI 屏会拿到糊图。
   - 要乘 `scaleFactor`，或者传一个超大值让 Electron clamp 到原生分辨率，然后用 sharp 做最终 resize。

5. **`uiohook-napi` v1.5.5 的 `linux-arm64` prebuild 是错的**
   - `node_modules/uiohook-napi/prebuilds/linux-arm64/uiohook-napi.node` 实际是 x86-64 ELF（`file` 命令证实）。
   - Linux ARM 上加载会报 `cannot open shared object file` —— 不是缺依赖，是架构不匹配。
   - 降级路径必须存在，否则 ARM Linux 用户跑不起来。Windows 不受影响。
   - 上游 issue 值得提一下；短期 workaround 就是降级。

6. **`UiohookMouseEvent.button` 类型是 `unknown`**
   - 直接赋值给 `number` 字段会编译失败。要 `typeof e.button === 'number' ? e.button : 0`。

7. **uiohook 是单例 `uIOhook`，不是 class**
   - 名字大小写敏感：`uIOhook`（小写 u + 大写 IO + 小写 hook）。
   - `start()` / `stop()` 重复调用要自己加 flag 防御，免得在某些平台 `stop()` 抛异常。

8. **`new EventEmitter()` 强类型重载的 implementation signature**
   - 多个 `on(event, handler)` 重载 + 一个宽签名实现，宽签名的 handler 参数要用 `(...args: never[]) => void`，否则 TS2394 overload-not-compatible。

9. **`get-windows` 在终端宿主里只能拿到 host 进程，不是内层 shell**（Windows 实跑发现）
   - 实测在 Windows Terminal 里跑 `cmd.exe`，返回值是：
     ```json
     { "app": "Windows Terminal Host", "title": "C:\\Windows\\system32\\cmd.exe ", "pid": 33304 }
     ```
   - `owner.name` 拿到的是宿主进程（WindowsTerminal / OpenConsole），**不是用户视角的"我在用 cmd"**。VS Code 集成终端 / Hyper / Tabby 应该都有同样问题。
   - **`title` 字段反而保留了真正的命令行**，所以下游 PromptBuilder 不能只看 `app`，必须 `app + title` 一起喂给 LLM，否则模型会以为用户在用一个 launcher。
   - 不影响 watcher 接口形状，影响的是阶段 4 的 prompt 模板。先在这里记一笔。

### 推荐依赖版本（已在 worktree 验证可装）

```jsonc
{
  "dependencies": {
    "electron": "^41.2.0",
    "get-windows": "^9.3.0",
    "sharp": "^0.34.5",
    "uiohook-napi": "^1.5.5"
  },
  "devDependencies": {
    "typescript": "^6.0.2",   // 注意要配 Node16 moduleResolution
    "@types/node": "^25.6.0"
  }
}
```

### 参考实现位置

可以直接拷过来的实现存在 worktree 分支 `verify-task02-capture` 下：

```
.claude/worktrees/verify-task02-capture/src/main/capture/
├── types.ts            # 接口 + 事件类型
├── screenCapturer.ts   # desktopCapturer + sharp
├── windowWatcher.ts    # get-windows 动态 import
└── inputHook.ts        # uiohook-napi + Noop 降级
```

合并方式建议：在 task01 完成后，把上面 4 个文件 cherry-pick 过来，再调 `tsconfig.json` 的 `moduleResolution` 即可。

### Windows 实跑追加发现（次要观察）

- **截图体积 ~927 KB**（长边 1280，sharp PNG compressionLevel 6）。对 vision LLM **计费没影响**（大多按分辨率算 token），但**上行延迟和总流量**不是零。如果嫌慢可以：
  - 把 sharp 输出换成 JPEG q=80，预计 150–250 KB
  - 或者把 `MAX_EDGE` 从 1280 降到 1024
  - 当前先不动，等阶段 4 接入真 LLM 后看实际延迟再决定
- **`DEP0169 url.parse DeprecationWarning`** 在 Electron 41 + Node 22 环境下出现，**不是我们的代码**，是依赖里调的（最可能是 `get-windows` 或 electron 内部某个早期模块）。Node 23/24 真删 `url.parse` 时这条会变 error，下次升 deps 时 grep 一下来源。

### 仍未验证（剩余 Windows 检查项）

- HiDPI 屏 thumbnailSize 缩放是否清晰（实跑机器是不是 HiDPI 未知）
- `get-windows` 在 UAC 提权进程 / 系统进程为前台时是否还能拿到 owner.name
- uiohook 全局 hook 在 Windows Defender / 杀软误杀情况
- `Ctrl+C` 关闭 Electron 时 uiohook 是否能干净 stop（否则鼠标会卡死）
