<p align="center">
  <img src="assets/icons/icon-256.png" width="128" alt="AI Status Beacon">
</p>
<h1 align="center">AI Status Beacon</h1>
<p align="center">
  <a href="README.md">English</a>
  ·
  <a href="README.ko-KR.md">한국어</a>
  ·
  <a href="README.ja-JP.md">日本語</a>
</p>
<p align="center">
  <a href="https://github.com/zhaolu83949426-hub/ai-status-beacon/releases"><img src="https://img.shields.io/github/v/release/zhaolu83949426-hub/ai-status-beacon" alt="Release"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey" alt="Platform">
</p>

AI Status Beacon 是一个面向 AI 编码 Agent 的桌面状态中心。它把运行状态、权限请求、额度快照集中到一个轻量级桌面窗口里，让你不用一直盯着终端，也能知道各个 Agent 当前在做什么。

## 功能特点

- 实时状态栏展示 Agent 执行状态和提醒信号
- Agent 管理页支持按 Agent 配置状态监控、Hook 状态和审批接管
- 对已接入的 Agent 提供桌面弹窗审批
- 支持额度账号管理，并可配置两个状态栏展示位
- 提供提示音、自启动、托盘控制等桌面工具能力
- 已集成 GitHub Releases 的 Windows 和 macOS 打包发布流程

## 支持的 Agent

- Claude Code
- Codex CLI
- Gemini CLI
- Kimi CLI
- Qwen Code
- opencode
- CodeBuddy
- Qoder
- Antigravity CLI
- Cursor Agent
- Copilot CLI
- Kiro CLI
- Pi
- OpenClaw
- Hermes

## 支持的额度提供方

- GitHub Copilot
- Kimi
- 智谱 GLM
- MiniMax
- DeepSeek
- StepFun
- SiliconFlow
- OpenRouter
- Novita

## 发布包

- Windows：x64 的 NSIS 安装包
- macOS：x64 和 Apple Silicon 的 DMG 安装包
- 本项目不支持 Linux

可在 [GitHub Releases](https://github.com/zhaolu83949426-hub/ai-status-beacon/releases) 页面下载正式构建产物。

## 开发

```bash
npm ci
npm run dev
```

## 技术栈

- Electron
- React
- TypeScript
- electron-builder
- electron-updater
