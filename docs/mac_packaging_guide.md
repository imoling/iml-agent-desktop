# macOS Packaging Guide

This guide explains how to package the **iML Agent Desktop** application for macOS and manage the bundled resources.

## 1. Building the Application

To create a distributable `.app` bundle (and `.zip`), run the following command in the project root:

```bash
npm run package
```

or creating a distributable zip:

```bash
npm run make
```

### Output Location
The packaged application will be generated in the `out/` directory:
- `out/iml-agent-desktop-darwin-x64/` (or arm64 depending on your machine)
- Inside this folder, you will find `iML Agent Desktop.app`.

## 2. Resource Structure

When the application is packaged, the `skills` and `models` directories are copied directly into the application bundle's Resource root. The structure inside `iML Agent Desktop.app` is as follows:

```
iML Agent Desktop.app/
└── Contents/
    └── Resources/
        ├── app.asar         (Coupled code)
        ├── skills/          (Your skills folder)
        ├── icon.png
        ├── icon.icns
        └── models/          (All local models)
            ├── Xenova/      (Embedding models)
            └── whisper/     (Whisper binary and models)
```

## 3. Managing Models

### Embedding & Whisper Models
All models are located in `Contents/Resources/models`.

If you need to manually add or replace models after packaging:
1. Right-click `iML Agent Desktop.app`.
2. Select **Show Package Contents**.
3. Navigate to `Contents/Resources/models`.
4. Place your model files here. 

- **Embeddings**: `models/Xenova/...`
- **Whisper**: `models/whisper/models/...` (and binary in `models/whisper/bin/...`)

## 4. Troubleshooting
If the application fails to load skills or models:
1. Open **Console.app** on macOS.
2. Filter by `iML Agent Desktop`.
3. Look for logs starting with `[SkillManager]`, `[LLMService]`, or `[VoiceService]` to see the resolved paths.
