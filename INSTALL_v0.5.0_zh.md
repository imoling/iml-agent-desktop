[🇺🇸 English](INSTALL_v0.5.0.md)

# iML Agent Desktop v0.5.0 安装说明

## 📦 软件包清单 (Package Contents)

本次发布包含三个文件：

1.  **`iml-agent-desktop-darwin-arm64-0.5.0.zip`**
    -   **类型**: 应用程序 (Application)
    -   **描述**: 主程序安装包。解压后得到 `iML Agent Desktop.app` (约 400MB)。
2.  **`iml-skills.zip`**
    -   **类型**: 资源包 (必须安装)
    -   **描述**: 包含 Agent 运行所需的技能文件。
3.  **`iml-models-whisper.zip`**
    -   **类型**: 资源包 (语音功能必须)
    -   **描述**: 包含离线语音识别 (Whisper) 模型文件。

---

## 🚀 安装步骤 (Installation)

### 1. 安装主程序
双击解压 `iml-agent-desktop-darwin-arm64-0.5.0.zip`，将解压得到的 **iML Agent Desktop.app** 拖入 **应用程序 (Applications)** 文件夹。

### 2. 安装资源文件 (关键步骤)
由于为了减小主应用体积，**技能和模型作为独立文件分发，您必须手动安装它们**，否则应用功能将受限。

1.  **定位应用资源目录**:
    -   进入 **应用程序 (Applications)** 文件夹。
    -   右键点击 **iML Agent Desktop.app**，选择 **"显示包内容" (Show Package Contents)**。
    -   依次进入目录: `Contents` -> `Resources`。

2.  **安装技能 (Skills)**:
    -   双击解压 `iml-skills.zip`，得到 `skills` 文件夹。
    -   复制 (`cmd+c`) 整个 **`skills`** 文件夹。
    -   粘贴 (`cmd+v`) 到刚才打开的 **`Resources`** 目录中。
    -   *检查*: 确保路径为 `Contents/Resources/skills`。

3.  **安装 Whisper 模型**:
    -   双击解压 `iml-models-whisper.zip`，得到 `whisper` 文件夹。
    -   复制 (`cmd+c`) **`whisper`** 文件夹。
    -   在 **`Resources`** 目录中，进入 **`models`** 文件夹 (如果不存在请创建，但通常已有 `Xenova` 目录)。
    -   粘贴 (`cmd+v`) **`whisper`** 文件夹到这里。
    -   *检查*: 确保路径为 `Contents/Resources/models/whisper`。

### 3. 首次运行与安全信任
由于是体验版本（未进行 Apple 开发者签名），首次运行时可能会提示 **"无法打开，因为无法验证开发者"**。

**解决方法**:
1.  在 **应用程序** 文件夹中找到 App。
2.  **右键点击** (或 Ctrl+点击) App 图标。
3.  选择 **"打开"** (Open)。
4.  在弹出的对话框中再次点击 **"打开"**。

*(只需操作一次，后续可直接双击运行)*

---

## 🔐 权限配置 (Permissions)

为了让 Agent 实现自动化操作，必须授予以下权限：

1.  **辅助功能 (Accessibility)**
    -   用于控制鼠标点击、键盘输入。
    -   **设置路径**: `系统设置` -> `隐私与安全性` -> `辅助功能` -> 添加 `iML Agent Desktop`。
2.  **屏幕录制 (Screen Recording)**
    -   用于 Agent "看见" 屏幕内容（进行视觉分析）。
    -   **设置路径**: `系统设置` -> `隐私与安全性` -> `屏幕录制` -> 添加 `iML Agent Desktop`。

> **提示**: 如果之前已添加过，建议先删除再重新添加，以确保权限生效。

---

## ⚙️ 初始配置 (Initial Setup)

1.  启动应用。
2.  点击左下角的 **设置 (Settings)** 图标。
3.  在 **LLM 设置** 中配置您的模型提供商：
    -   **OpenAI**: 输入 API Key 和 Base URL。
    -   **Anthropic**: 输入 API Key。
4.  点击 **保存**。

现在，您可以开始体验原生的 iML Agent Desktop 了！
