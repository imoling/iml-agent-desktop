# iML Agent Desktop

iML Agent Desktop 是一款基于第一性原理设计的桌面级全能智能体助手。它追求极致简洁的设计美感，提供强大的自动化、数据分析、创意设计和日程管理能力。

![App Screenshot](file:///Users/imoling/.gemini/antigravity/brain/a0495db6-ad4a-4b75-a312-2ead2b3a224a/uploaded_image_1768937347639.png)

## ✨ 核心特性

- 🤖 **智能自动化**：深度集成桌面自动化和浏览器自动化，一键完成复杂工作流。
- 📊 **数据分析**：内置强大的数据处理和可视化引擎，洞察数据背后的价值。
- 🎨 **创意设计**：集成 HTML 转图片、Canvas 设计、海报生成等多种设计工具。
- 📅 **日程管理**：智能安排任务和日程，让工作更有条理。
- 🧠 **本地记忆库**：内置向量数据库（Vectra），为智能体提供持久的本地知识库。
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
