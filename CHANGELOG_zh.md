[🇺🇸 English](CHANGELOG.md)

# 更新日志 (Changelog)

本项目的所有重要变更都将记录在此文件中。

## [0.5.0] - 2026-02-09

### 🚀 新特性 (New Features)
- **原生智能体架构 (Native Agent Architecture)**: 实现了 "大脑 + 技能" 架构，采用 Zero-Wrapper 原生实现 (Electron + Vue + Vectra)，不依赖 LangChain 等重型框架。
- **通用技能协议 (Universal Skill Protocol)**: 支持通过动态解析 `SKILL.md` 注册技能，让 Agent 能够像人一样 "阅读" 工具说明书。
- **本地记忆系统 (Local Memory System - RAG)**:
    - 集成 `vectra` + `transformers.js` (Xenova)，实现 100% 本地向量记忆。
    - 支持 **加密存储** (AES-256)，确保存储在记忆中的敏感凭证安全。
    - 实现了丰富的元数据支持 (分类、优先级、标签)。
- **语音交互 (Voice Interaction)**: 集成离线 **Whisper** 模型，实现私密且解放双手的语音指令交互。
- **连续执行协议 (Continuous Execution Protocol)**: 实施了严格的 System Prompt 协议，防止 AI "偷懒"，确保长链路任务能够不间断地自动执行。

### 📝 文档 (Documentation)
- **双语支持**:
    - 新增 `README_zh.md` (中文) 并更新 `README.md` (英文)。
    - 新增双语安装指南 (`INSTALL_v0.5.0.md` & `INSTALL_v0.5.0_zh.md`)。
- **截图画廊**: 添加了包含 8 张高清截图的画廊，展示核心功能 (技能生态、记忆管理、深色模式等)。
- **架构图**: 新增 Mermaid 架构图，直观展示系统原理。

### 🐛 修复 (Fixes)
- **Git 大文件处理**: 通过更新 `.gitignore` 修复了因大资源文件 (`.zip`, `.bin`) 导致的 git 操作失败问题。
- **任务中断**: 通过优化 System Prompt 和增加上下文限制 (8k tokens)，修复了复杂任务中途停止的问题。
- **打包问题**: 修复了 `SkillManager` 和 `LLMService` 中的路径解析问题，确保打包后的应用能正确加载资源。

### 📦 构建 (Build)
- 版本号更新至 `0.5.0`。
- 生成了 `iml-agent-desktop-darwin-arm64-0.5.0.zip` (应用包) 和 `iml-resources-0.5.0.zip` (资源包)。
