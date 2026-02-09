[🇨🇳 中文](INSTALL_v0.5.0_zh.md)

# iML Agent Desktop v0.5.0 Installation Guide

## 📦 Package Contents

This release contains two files:

1.  **`iml-agent-desktop-darwin-arm64-0.5.0.zip`**
    -   **Type**: Application
    -   **Description**: The main application package. Unzip to get `iML Agent Desktop.app`.
2.  **`iml-resources-0.5.0.zip`**
    -   **Type**: Assets
    -   **Description**: Contains all built-in skills (`skills/`) and offline models (`resources/models/`).
    -   **Note**: The application already includes these resources. This zip is provided as a backup or for developer reference.

---

## 🚀 Installation

### 1. Unzip and Install
Double-click `iml-agent-desktop-darwin-arm64-0.5.0.zip` to unzip it. Drag the resulting **iML Agent Desktop.app** into your **Applications** folder.

### 2. First Run & Gatekeeper
Since this is an experimental release (unsigned by Apple Developer), you may see a **"Cannot be opened because the developer cannot be verified"** warning on first launch.

**Solution**:
1.  Find the App in your **Applications** folder.
2.  **Right-click** (or Ctrl+Click) the App icon.
3.  Select **"Open"**.
4.  Click **"Open"** again in the dialog box.

*(You only need to do this once. Afterwards, you can launch it normally.)*

---

## 🔐 Permissions

To enable automated agent capabilities, you must grant the following permissions:

1.  **Accessibility**
    -   Used for controlling mouse clicks and keyboard input.
    -   **Path**: `System Settings` -> `Privacy & Security` -> `Accessibility` -> Add `iML Agent Desktop`.
2.  **Screen Recording**
    -   Used for the agent to "see" your screen (visual analysis).
    -   **Path**: `System Settings` -> `Privacy & Security` -> `Screen Recording` -> Add `iML Agent Desktop`.

> **Tip**: If you have added it before, it is recommended to remove and re-add it to ensure permissions are active.

---

## ⚙️ Initial Setup

1.  Launch the application.
2.  Click the **Settings** icon in the bottom left.
3.  Configure your Model Provider in **LLM Settings**:
    -   **OpenAI**: Enter API Key and Base URL.
    -   **Anthropic**: Enter API Key.
4.  Click **Save**.

Now you are ready to experience the native iML Agent Desktop!
