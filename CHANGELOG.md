[🇨🇳 中文](CHANGELOG_zh.md)

# Changelog

All notable changes to this project will be documented in this file.

## [0.5.0] - 2026-02-09

### 🚀 New Features (新特性)
- **Native Agent Architecture**: Implemented a "Brain + Skills" architecture with Zero-Wrapper implementation (Electron + Vue + Vectra), bypassing heavy frameworks like LangChain.
- **Universal Skill Protocol**: Added support for dynamic skill registration via `SKILL.md` parsing, allowing the agent to "read" tool manuals.
- **Local Memory System (RAG)**:
    - Integrated `vectra` + `transformers.js` (Xenova) for 100% local vector memory.
    - Added support for **Encrypted Storage** (AES-256) for sensitive credentials.
    - Implemented rich metadata support (Category, Priority, Tags).
- **Voice Interaction**: Integrated offline **Whisper** model for private, hands-free voice commands.
- **Continuous Execution Protocol**: Implemented a strict system prompt protocol to prevent AI "laziness" and ensure long-running tasks complete without interruption.

### 📝 Documentation (文档)
- **Bilingual Support**:
    - Added `README_zh.md` (Chinese) and updated `README.md` (English).
    - Added bilingual Installation Guides (`INSTALL_v0.5.0.md` & `INSTALL_v0.5.0_zh.md`).
- **Screenshot Gallery**: Added a comprehensive gallery of 8 screenshots showcasing key features (Skill Ecosystem, Memory Management, Dark Mode, etc.).
- **Architecture Diagrams**: Added Mermaid diagrams illustrating the core system architecture.

### 🐛 Fixes (修复)
- **Git Large File Handling**: Fixed issues with large resource files (`.zip`, `.bin`) causing git operation failures by updating `.gitignore`.
- **Task Interruption**: Fixed issue where complex tasks would stop midway by optimizing the System Prompt and increasing context limits (8k tokens).
- **Packaging**: Fixed path resolution issues in `SkillManager` and `LLMService` to ensure correct resource loading in packaged apps.

### 📦 Build (构建)
- Updated version to `0.5.0`.
- Generated `iml-agent-desktop-darwin-arm64-0.5.0.zip` (App) and `iml-resources-0.5.0.zip` (Assets).
