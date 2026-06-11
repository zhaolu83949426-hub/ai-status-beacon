<p align="center">
  <img src="assets/icons/icon-256.png" width="128" alt="AI Status Beacon">
</p>
<h1 align="center">AI Status Beacon</h1>
<p align="center">
  <a href="README.md">English</a>
  ·
  <a href="README.zh-CN.md">简体中文</a>
  ·
  <a href="README.ja-JP.md">日本語</a>
</p>
<p align="center">
  <a href="https://github.com/zhaolu83949426-hub/ai-status-beacon/releases"><img src="https://img.shields.io/github/v/release/zhaolu83949426-hub/ai-status-beacon" alt="Release"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey" alt="Platform">
</p>

AI Status Beacon은 AI 코딩 에이전트를 위한 데스크톱 상태 허브입니다. 실행 상태, 권한 요청, 사용량 정보를 하나의 가벼운 유틸리티 창에 모아 두어, 터미널을 계속 보고 있지 않아도 각 에이전트의 현재 작업을 바로 확인할 수 있습니다.

## 주요 기능

- 에이전트 실행 상태와 주의 신호를 실시간으로 보여주는 상태 바
- 에이전트별 상태 모니터링, Hook 상태, 권한 처리 전환을 설정하는 관리 페이지
- 지원되는 에이전트에 대한 데스크톱 승인 팝업
- 두 개의 상태 바 표시 슬롯을 포함한 사용량 계정 관리
- 사운드 알림, 자동 시작, 트레이 제어 등 유틸리티형 데스크톱 경험
- Windows 및 macOS용 GitHub Releases 패키징/배포 흐름 내장

## 지원 에이전트

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

## 지원 사용량 제공자

- GitHub Copilot
- Kimi
- Zhipu GLM
- MiniMax
- DeepSeek
- StepFun
- SiliconFlow
- OpenRouter
- Novita

## 배포 패키지

- Windows: x64용 NSIS 설치 파일
- macOS: x64 및 Apple Silicon용 DMG
- 이 프로젝트는 Linux를 지원하지 않습니다

패키지된 빌드는 [GitHub Releases](https://github.com/zhaolu83949426-hub/ai-status-beacon/releases) 페이지에서 받을 수 있습니다.

## 개발

```bash
npm ci
npm run dev
```

## 기술 스택

- Electron
- React
- TypeScript
- electron-builder
- electron-updater
