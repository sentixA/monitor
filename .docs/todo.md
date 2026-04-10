# 待决策事项 / TODO

> 本文件只记录"已识别但暂缓决策"的事项。每条要写明 **背景 / 已排除方案 / 倾向方向 / 待解问题**,方便未来回到这个话题时直接接上下文。

---

## 1. 跨平台构建与验证环境

**状态**:暂缓 — 等 MVP 主路径(MVU + 阶段 1~5)在本地容器内跑通后再决定。

### 背景

项目目标平台是 Windows(MVP),但日常开发环境是 macOS host 上 Docker Desktop 里的 Linux 容器(`aarch64` / linuxkit / 无 `/dev/kvm`)。这导致:

- Electron 的 `desktopCapturer` / `uiohook-napi` / 托盘等 Windows 行为无法在容器内验证。
- macOS 自身的兼容性(若未来扩平台)同样缺验证渠道。
- Linux 也需要一份独立验证(避免容器内 xvfb 假象掩盖真实桌面环境的问题)。

### 已排除方案

| 方案 | 排除原因 |
|---|---|
| **dockur/windows 在当前容器内跑** | 需要 `--device=/dev/kvm`,Docker Desktop for Mac 的 LinuxKit VM 不暴露 KVM,架构上不可能 |
| **macOS host 上 UTM 跑 Windows 11 ARM,容器 SSH 进去驱动** | **破坏环境隔离** — 如果 dev container 能 SSH 到 host 上的 VM,被攻陷的容器就拥有了对 VM 的完全控制权,把"代码跑在容器里"的安全收益全部抹掉。不能把 host 当成可信的后端服务来用 |
| **GitHub Actions windows-latest** | 仅能覆盖 Windows 一项;且如果仓库私有会产生分钟数费用;且把源码推到第三方 CI 上也是一种信任面扩张,需要单独评估 |
| **Wine + xvfb** | uiohook-napi / desktopCapturer 在 Wine 下行为不真实,验证结论不可信 |

### 倾向方向

**租三台独立的构建/测试服务器**,每台一个 OS:
- 1 × Windows(用于 MVP 主验证)
- 1 × macOS(用于未来跨平台扩展)
- 1 × Linux(用于服务器侧/CI 一致性验证)

每台都是**独立信任域**,与开发容器之间通过显式的 artifact 传输(git push + 拉构建产物)交互,不互相 SSH。

### 待解问题(决策时需要回答)

- [ ] 供应商选型:云厂商(AWS / Azure / GCP / 阿里云)? 还是 MacStadium / Scaleway 这类专做 macOS/Windows 的?
- [ ] 成本上限:每月预算?按需启停还是常驻?
- [ ] 触发模式:本地 push → webhook → 服务器拉代码跑构建?还是手动按需触发?
- [ ] 凭据与机密管理:API key / 证书放在哪里,如何避免泄漏到公网仓库
- [ ] 产物回传方式:S3 bucket / artifact 服务 / 直接 scp 回本地?
- [ ] 跟现有 GitHub / Gitea / 私有 git 的集成方式

### 触发本决策的时机

- MVU 验证通过 + 阶段 1~5 在容器内能 typecheck/lint 通过之后
- 即:任务计划进入"必须在真实 Windows 上验证 6.x 用例"的节点时

---
