# 阶段 1：项目骨架（Foundation）

## 目标

搭建 Electron + TypeScript 项目，能 `npm run dev` 启动主进程并创建一个隐藏的占位窗口，控制台无报错。

## 子任务

### 1.1 包管理与依赖
- [ ] 创建 `package.json`，填写 name / version / scripts (`dev` / `build` / `start`)
- [ ] 装核心依赖：`electron`, `electron-vite`, `typescript`, `@types/node`
- [ ] 装运行依赖（占位，后续阶段会用到）：`electron-store`, `get-windows`, `sharp`
- [ ] **不要**装 `uiohook-napi`，等阶段 2.4 再装（可能编译失败需要单独排错）

### 1.2 TypeScript 配置
- [ ] 创建 `tsconfig.json`：target ES2022 / module ESNext / strict / esModuleInterop / outDir 由 vite 接管
- [ ] 创建 `tsconfig.node.json`（main 进程）和 `tsconfig.web.json`（renderer）如有需要

### 1.3 electron-vite 配置
- [ ] 创建 `electron.vite.config.ts`，定义 main / preload / renderer 三段入口
- [ ] main 入口：`src/main/index.ts`
- [ ] renderer 入口：`src/overlay/index.html`

### 1.4 入口骨架
- [ ] 创建 `src/main/index.ts`：`app.whenReady()` → `console.log('ready')`，暂时不开窗口
- [ ] 创建 `src/shared/types.ts`：定义 `StuckSignal`, `ChatMessage`, `ProviderConfig` 等共享类型（占位即可）

### 1.5 工程文件
- [ ] 创建 `.gitignore`：`node_modules/`, `dist/`, `out/`, `*.log`, `config.local.json`
- [ ] 创建 `README.md`：写明启动命令、配置文件路径、如何加 LLM key

## Definition of Done

- [ ] `cd /workspace/monitor && npm install` 无错
- [ ] `npm run dev` 控制台打印 `ready`，进程不退出，无 unhandled exception
- [ ] `Ctrl+C` 能正常退出

## 文件清单（本阶段创建）

```
package.json
tsconfig.json
electron.vite.config.ts
.gitignore
README.md
src/main/index.ts
src/shared/types.ts
```
