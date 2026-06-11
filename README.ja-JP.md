<p align="center">
  <img src="assets/icons/icon-256.png" width="128" alt="AI Status Beacon">
</p>
<h1 align="center">AI Status Beacon</h1>
<p align="center">
  <a href="README.md">English</a>
  ·
  <a href="README.zh-CN.md">简体中文</a>
  ·
  <a href="README.ko-KR.md">한국어</a>
</p>
<p align="center">
  <a href="https://github.com/zhaolu83949426-hub/ai-status-beacon/releases"><img src="https://img.shields.io/github/v/release/zhaolu83949426-hub/ai-status-beacon" alt="Release"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey" alt="Platform">
</p>

AI Status Beacon は、AI コーディングエージェント向けのデスクトップ状態ハブです。実行状態、権限リクエスト、利用量スナップショットを軽量なユーティリティウィンドウにまとめ、ターミナルを見続けなくても各エージェントの現在の動きを把握できます。

## 主な機能

- エージェントの実行状態と注意シグナルをリアルタイム表示するステータスバー
- エージェントごとの状態監視、Hook 状態、権限引き受けを設定できる管理ページ
- 対応エージェント向けのデスクトップ承認ポップアップ
- 2 つのステータスバー表示スロットを備えた利用量アカウント管理
- サウンド通知、自動起動、トレイ操作などのユーティリティ体験
- Windows と macOS 向け GitHub Releases パッケージ配布フローを内蔵

## 対応エージェント

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

## 対応利用量プロバイダー

- GitHub Copilot
- Kimi
- Zhipu GLM
- MiniMax
- DeepSeek
- StepFun
- SiliconFlow
- OpenRouter
- Novita

## 配布パッケージ

- Windows: x64 向け NSIS インストーラー
- macOS: x64 および Apple Silicon 向け DMG
- このプロジェクトは Linux をサポートしていません

パッケージ済みビルドは [GitHub Releases](https://github.com/zhaolu83949426-hub/ai-status-beacon/releases) ページから取得できます。

## 開発

```bash
npm ci
npm run dev
```

## 技術スタック

- Electron
- React
- TypeScript
- electron-builder
- electron-updater
