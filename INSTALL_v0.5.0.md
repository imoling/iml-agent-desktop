[🇨🇳 中文](INSTALL_v0.5.0_zh.md)

# iML Agent Desktop v0.5.0 Installation Guide

## 📦 Package Contents

This release contains three files:

1.  **`iml-agent-desktop-darwin-arm64-0.5.0.zip`**
    -   **Type**: Application
    -   **Description**: The main application package. Unzip to get `iML Agent Desktop.app` (approx. 400MB).
2.  **`iml-skills.zip`**
    -   **Type**: Resources (Required)
    -   **Description**: Contains the required skills for the agent.
3.  **`iml-models-whisper.zip`**
    -   **Type**: Resources (Required for Speech-to-Text)
    -   **Description**: Contains the offline Whisper models.

---

## 🚀 Installation

### 1. Install Application
Double-click `iml-agent-desktop-darwin-arm64-0.5.0.zip` to unzip it. Drag the resulting **iML Agent Desktop.app** into your **Applications** folder.

### 2. Install Resources (Crucial Step)
You **must manually install** the skills and models for the application to function correctly, as they are distributed separately to reduce the app package size.

1.  **Locate the App Resources Folder**:
    -   Go to your **Applications** folder.
    -   Right-click **iML Agent Desktop.app** and select **"Show Package Contents"**.
    -   Navigate to `Contents` -> `Resources`.

2.  **Install Skills**:
    -   Unzip `iml-skills.zip`. You will get a `skills` folder.
    -   Copy (`cmd+c`) the entire **`skills`** folder.
    -   Paste (`cmd+v`) it into the **`Resources`** folder you opened in step 1.
    -   *Result*: You should see `Contents/Resources/skills`.

3.  **Install Whisper Models**:
    -   Unzip `iml-models-whisper.zip`. You will get a `whisper` folder.
    -   Copy (`cmd+c`) the **`whisper`** folder.
    -   In the **`Resources`** folder, navigate into the **`models`** folder (create it if it doesn't exist, though `Xenova` should already be there).
        - *Note: If you see `temp_resources` or just `Xenova` inside `models`, that is fine.*
        - *Wait, let's look at the structure.* `Resources/models` should exist.
    -   Navigate to `Contents` -> `Resources` -> `models`.
    -   Paste (`cmd+v`) the **`whisper`** folder here.
    -   *Result*: You should see `Contents/Resources/models/whisper`.

### 3. First Run & Gatekeeper
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
