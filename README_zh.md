[🇺🇸 English](README.md)

# iML Agent Desktop

iML Agent Desktop 是一款基于第一性原理设计的桌面级全能智能体助手。它追求极致简洁的设计美感，提供强大的自动化、数据分析、创意设计和日程管理能力。

![App Screenshot](docs/images/app-screenshot.png)

## ✨ 核心特性

- 🤖 **智能自动化**：深度集成桌面自动化和浏览器自动化，一键完成复杂工作流。
- 📊 **数据分析**：内置强大的数据处理和可视化引擎，洞察数据背后的价值。
- 🧠 **本地记忆库 (RAG)**：内置向量数据库（Vectra）与 **本地嵌入模型** (Xenova)。支持 **加密存储** 敏感凭证以及富元数据管理。
- 🎙️ **语音交互**：基于 **Whisper** 模型的离线语音识别，保护隐私的同时彻底解放双手。
- ⚡ **稳健执行**：实现 "连续执行协议" (Continuous Execution Protocol)，确保长链路复杂任务不中断。
- 🎨 **创意设计**：集成 HTML 转图片、Canvas 设计、海报生成等多种设计工具。
- 📅 **日程管理**：智能安排任务和日程，让工作更有条理。
- 🔌 **技能生态**：支持 20+ 内置技能，涵盖文件处理、网页搜索、音频转录等。

## 🚀 快速开始

### 运行环境
- macOS (目前主要支持 arm64)
- Node.js 18+

### 开发与打包

```bash
# 安装依赖
npm install

# 启动开发环境
npm start

# 打包应用 (生成的安装包在 out/make/ 目录下)
npm run make
```

## 🛠️ 技术栈

- **Frontend**: Vue 3 + Vite + Tailwind CSS + Element Plus
- **Desktop**: Electron + Electron Forge
- **AI/ML**: OpenAI API + Anthropic SDK + @xenova/transformers (本地嵌入)
- **Database**: Vectra (Vector DB)

## 🔒 隐私与安全

- **本地优先**：所有的向量记忆和录音文件均存储在本地。
- **凭证加密**：存储在记忆中的敏感信息（API Keys、密码）使用 AES-256 自动加密。
- **安全模式**：关键的文件系统及 Shell 操作需要用户明确确认。

## 🌍 多语言与跨平台

- **双语界面**：完美支持 **简体中文** 与 **English**。
- **智能检测**：首次启动自动检测系统语言。

## 📄 开源协议

本项目采用 **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)** 协议。

**您可以：**
- **共享** — 在任何媒介以任何形式复制、发行本作品。
- **演绎** — 修改、转换或以本作品为基础进行创作。

**但必须遵守下列条件：**
- **署名** — 您必须给出适当的署名，提供指向本许可协议的链接，同时标明是否对本作品作了修改。
- **非商业性使用** — 您不得将本作品用于商业目的。

详情请参阅 [LICENSE](LICENSE) 文件。

---

*Made with ❤️ by imoling.cn@gmail.com*
