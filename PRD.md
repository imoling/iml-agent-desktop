# Agents Platform - 产品需求文档 (PRD)

> **版本**: v1.0 (正式版)  
> **更新日期**: 2026-01-14  
> **状态**: 开发中

---

## 1. 产品概述

### 1.1 产品愿景

打造一款面向普通用户的 **AI Agent 协作平台**，让用户无需编写代码，仅通过**自然语言**即可完成复杂的自动化任务。系统基于 **Claude Agent SDK** 构建，核心理念是 **Skills 驱动的智能调度**。

### 1.2 核心价值

| 价值点 | 描述 |
|--------|------|
| 🎯 **零门槛使用** | 普通用户通过自然语言表达需求，无需技术背景 |
| 🔧 **Skills 即服务** | 将复杂能力封装为可复用的 Skills，自动编排执行 |
| 🔌 **可扩展生态** | 支持 MCP Server、Workflow 等多种工具集成 |
| 📊 **透明可控** | 任务执行过程实时可视化，用户可干预和确认 |
| 🌐 **离线可用** | 支持本地模型（Ollama/CherryStudio）离线运行 |

---

## 2. 核心技术规范

### 2.1 技术栈（正式确认）

| 模块 | 技术选型 | 说明 |
|---|---|---|
| **桌面框架** | Electron + Electron Forge | 跨平台支持，Forge 处理构建打包 |
| **渲染框架** | Vue 3 + Element Plus | 响应式 UI 开发 |
| **状态管理** | Pinia | 轻量级状态管理 |
| **Agent Core** | Claude Agent SDK | 智能任务调度与执行 |
| **LLM Provider** | Claude API / Ollama / Cherry | 支持云端与本地大模型 |
| **Security** | Local Encrypted Storage | API Key 本地高强度加密存储 |

### 2.2 Skill 文件规范

符合 Anthropic 官方规范，每个 Skill 包含 `SKILL.md` 和辅助文件：

#### 目录结构
```
skills/
└── my-skill-name/
    ├── SKILL.md          # 核心定义文件
    └── scripts/          # 可执行脚本
        └── task.py
```

#### 执行环境
- **内置 Runtime**：客户端内置 Node.js/Python 运行时，确保 Skill 脚本开箱即用，无需用户配置环境。

#### SKILL.md 模板
```markdown
---
name: my-skill-name        # 仅限小写字母、数字、连字符
description: 简短描述该 Skill 的功能和适用场景（Max 200 chars）
---

# My Skill Name

Detailed instructions for Claude...

## Usage
Examples of how to use this skill...

## Reference
[Link to reference](/path/to/reference)
```

---

## 3. 功能设计

### 3.1 主界面布局

采用非典型的**现代极简布局**，避免与 Claude Cowork 雷同，使用 **Vibe Coding** 风格：

- **风格**：高对比度、科技感、毛玻璃特效
- **图标**：Lucide Icons
- **布局**：
    - **左侧边栏**：导航、历史会话、Skills 库、设置
    - **中央主区**：流式对话 + 动态卡片（非固定三栏）
    - **右侧抽屉**：Context 上下文、Artifacts 产物（默认收起，按需展开）

### 3.2 预设 Skills 库（MVP）

系统内置首批高频场景 Skills，确保开箱即用：

| 分类 | Skill 名称 | 描述 | 产物示例 |
|---|---|---|---|
| **效率** | `meeting-notes` | 整理会议录音/文本，提取待办 | `summary.md`, `tasks.json` |
| **创作** | `content-writer` | 博客、推文、邮件等多风格写作 | `article.md` |
| **视觉** | `quick-diagram` | 根据描述生成流程图/时序图 (Mermaid) | `diagram.svg` |
| **分析** | `data-analyst` | CSV/Excel 数据清洗与图表生成 | `report.html`, `chart.png` |
| **开发** | `code-scaffold` | 生成特定技术栈的项目脚手架 | `project.zip` |
| **生活** | `travel-planner` | 根据日期和偏好生成旅行计划 | `itinerary.md` |

### 3.3 核心功能模块

#### 3.3.1 自然语言转 Skills
- 输入："帮我做一个下周去日本的旅游攻略"
- 动作：匹配 `travel-planner` Skill，提取参数（地点=日本，时间=下周）
- 执行：调用 LLM 生成计划

#### 3.3.2 交互式确认配置
设置中提供**确认粒度**选项：
- **Safe Mode (默认)**：关键操作（文件读写、API调用）需人工确认
- **Auto Mode**：全自动执行，仅在出错时暂停

---

## Future Roadmap: The Next Level 🚀

### 6. Phase 10: True Vision (Multimodal) 👁️
**Goal**: Enable the Agent to "see" and interact with any interface, bypassing DOM limitations.
- **Visual Understanding**: Integrate GPT-4o / Claude 3.5 Sonnet vision capabilities.
- **Screenshot Analysis**: Analyze UI screenshots to key coordinates for interaction.
- **Canvas/Game Support**: Interact with non-DOM elements (Canvas, Games, Remote Desktops).

### 7. Phase 11: Workflow Automation 🔄
**Goal**: Define and execute reusable, scheduled, or triggered workflows.
- **Workflow Builder**: UI to create sequences of tasks (e.g., "Morning Report", "Price Comparison").
- **Triggers**: Schedule-based (Cron) or Event-based execution.
- **Macros**: "Save as Workflow" from chat history.

### 8. Phase 12: Long-term Memory (Butler Mode) 🧠
**Goal**: Evolve from "Goldfish Memory" to a persistent, context-aware partner.
- **Vector Database**: Store user preferences, project context, and historical facts.
- **Knowledge Recall**: RAG-based retrieval for queries like "Where did we leave off?".
- **Proactive Agents**: Background monitoring and notification (e.g., "Price Drop Alert").

---

## 4. MVP 开发计划

### Phase 1: 核心框架 (Week 1-2)
- [ ] Electron + Vue3 项目初始化
- [ ] 接入 Claude Agent SDK
- [ ] 实现 LLM 适配层 (Claude/Ollama)
- [ ] 实现安全存储模块 (API Keys)

### Phase 2: Skills 引擎 (Week 3-4)
- [ ] Skill 加载器（解析 SKILL.md）
- [ ] 内置 Runtime 集成 (Node/Python)
- [ ] 预设 Skills 实现
- [ ] 自然语言意图识别模块

### Phase 3: UI 交互 (Week 5-6)
- [ ] 主界面开发（Vibe Coding 风格）
- [ ] 交互式参数确认组件
- [ ] 任务进度可视化

---

## 5. 里程碑
- **v0.1**: 基础框架跑通，支持手动调用一个 Skill
- **v0.5**: 支持自然语言调用，包含 3 个预设 Skills
- **v1.0**: 完整 UI，支持自定义 Skill，发布 Beta 版

---
