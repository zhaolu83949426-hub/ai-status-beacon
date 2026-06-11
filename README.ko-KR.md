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

## 상태등 로직

- 단일 라이트 모드에서는 한 번에 한 가지 색만 보이고, 3등 모드에서는 빨강, 노랑, 초록 램프를 각각 사용합니다
- 초록불은 지금 한가롭거나 조용한 상태이거나, 작업이 끝났다는 뜻입니다
- 작업이 막 끝나면 초록불이 몇 번 깜빡여서 한 사이클이 완료됐다는 것을 알려줍니다
- 노란불은 에이전트가 바쁘게 일하는 중이거나, 생각 중이거나, 사용자의 확인이나 주의가 필요하다는 뜻입니다
- 노란불이 계속 깜빡이면 지금 바로 확인하는 것이 좋은 알림이 있다는 의미입니다. 예를 들면 권한 확인 요청입니다
- 빨간불은 오류나 이상 상황을 뜻합니다
- 여러 에이전트가 동시에 돌아가면 상태 바는 그중에서 가장 먼저 봐야 할 신호를 우선해서 보여줍니다

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
