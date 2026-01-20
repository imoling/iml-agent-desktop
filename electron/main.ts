import { app, BrowserWindow, ipcMain, dialog, shell, clipboard } from 'electron';
import path from 'path';
import fs from 'fs';
import { SkillManager } from './services/SkillManager';
import { ConfigManager } from './services/ConfigManager';
import { LLMService } from './services/LLMService';
import { PermissionManager } from './services/PermissionManager';
import { WorkflowManager } from './services/WorkflowManager';
import { VectorStore } from './services/memory/VectorStore';
import { VoiceService } from './services/VoiceService';
import { ChatHistoryService } from './services/ChatHistoryService';

const configManager = new ConfigManager();
const permissionManager = new PermissionManager();
const skillManager = new SkillManager(configManager);
const llmService = new LLMService(configManager, skillManager, permissionManager);
const workflowManager = new WorkflowManager(skillManager, llmService);
const vectorStore = new VectorStore(llmService);
const voiceService = new VoiceService();
const chatHistoryService = new ChatHistoryService();

skillManager.setLLMService(llmService);
skillManager.setVectorStore(vectorStore);
skillManager.setVoiceService(voiceService);
llmService.setVectorStore(vectorStore);
llmService.setWorkflowManager(workflowManager);

// Note: We need to pass permissionManager to LLMService/SkillManager if they need it later
// For now LLMService will need it.
// Updating LLMService constructor... wait, I need to update LLMService first to accept it?
// Or I can just pass it via setter or update constructor later.
// Let's assume I update LLMService constructor in the next step.
// But for now, just initialization.

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        title: 'iML Agent Desktop',
        width: 1440,
        height: 960,
        minWidth: 1080,
        minHeight: 720,
        webPreferences: {
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false, // Allow file:// protocol for local image display
            preload: path.resolve(__dirname, 'preload.js'),
        },
        titleBarStyle: 'hiddenInset', // Mac style
        vibrancy: 'under-window', // Mac blur effect
        visualEffectState: 'active',
        ...(process.platform !== 'darwin' ? { icon: path.join(__dirname, '../../resources/icon.icns') } : {})
    });

    if (process.platform === 'darwin') {
        try {
            app.dock?.setIcon(path.join(__dirname, '../../resources/icon.png'));
        } catch (e) {
            console.error('Failed to set dock icon:', e);
        }
    }

    // Set main window for permission requests
    permissionManager.setMainWindow(mainWindow);

    // and load the index.html of the app.
    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
        mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }

    // Handle Mic/Camera permissions
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'media') {
            callback(true); // Approve microphone/camera
            return;
        }
        callback(false);
    });
};

app.whenReady().then(async () => {
    // Handle Permission IPC
    ipcMain.on('permission-response', (event, { requestId, allow }) => {
        // This is actually handled inside PermissionManager constructor via ipcMain.on
        // But we need to make sure we don't double bind or mis-bind.
        // PermissionManager constructor binds it? Yes.
    });
    await skillManager.loadSkills();
    createWindow();

    // Skills IPC
    ipcMain.handle('get-skills', () => {
        return skillManager.getSkills();
    });

    ipcMain.handle('execute-skill', async (event, skillId, args) => {
        return await skillManager.executeSkill(skillId, args);
    });

    // Config IPC
    ipcMain.handle('get-config', (event, key) => {
        return key ? configManager.get(key) : configManager.getAll();
    });

    ipcMain.handle('set-config', (event, key, value) => {
        configManager.set(key, value);
    });

    ipcMain.handle('create-skill', async (event, data) => {
        return await skillManager.createSkill(data);
    });

    ipcMain.handle('update-skill', async (event, id, data) => {
        return await skillManager.updateSkill(id, data);
    });

    ipcMain.handle('delete-skill', async (event, id) => {
        return await skillManager.deleteSkill(id);
    });

    ipcMain.handle('read-skill-script', async (event, id) => {
        return await skillManager.readSkillScript(id);
    });

    ipcMain.handle('update-skill-script', async (event, id, content) => {
        return await skillManager.updateSkillScript(id, content);
    });

    ipcMain.handle('select-directory', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory']
        });
        if (result.canceled) return null;
        return result.filePaths[0];
    });

    ipcMain.handle('select-file', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile']
        });
        if (result.canceled) return null;
        return result.filePaths[0];
    });

    ipcMain.handle('open-file', async (event, path) => {
        if (!path) return false;
        try {
            await shell.openPath(path);
            return true;
        } catch (e) {
            console.error('Failed to open path:', e);
            return false;
        }
    });

    // Chat IPC
    ipcMain.handle('chat-message', async (event, messages, options) => {
        // Pass options (e.g., cwd) to llmService
        return await llmService.chat(messages, undefined, undefined, (streamEvent) => {
            event.sender.send('chat-stream-update', streamEvent);
        }, options);
    });

    ipcMain.handle('stop-generation', () => {
        llmService.stop();
        return true;
    });

    ipcMain.handle('confirm-tool-execution', (event, allowed) => {
        llmService.resolveConfirmation(allowed);
        return true;
    });

    // Workflow IPC handlers are below

    // ... existing code ...

    ipcMain.handle('import-skill', async (event, url) => {
        return await skillManager.importSkillFromUrl(url);
    });

    ipcMain.handle('generate-skill', async (event, prompt) => {
        return await skillManager.generateSkill(prompt);
    });

    ipcMain.handle('list-skill-files', async (event, skillId) => {
        return await skillManager.listSkillFiles(skillId);
    });

    ipcMain.handle('read-skill-file', async (event, skillId, relativePath) => {
        return await skillManager.readSkillFile(skillId, relativePath);
    });

    ipcMain.handle('write-skill-file', async (event, skillId, relativePath, content) => {
        return await skillManager.writeSkillFile(skillId, relativePath, content);
    });

    ipcMain.handle('delete-skill-file', async (event, skillId, relativePath) => {
        return await skillManager.deleteSkillFile(skillId, relativePath);
    });

    ipcMain.handle('create-skill-file', async (event, skillId, relativePath, isDir) => {
        return await skillManager.createSkillFile(skillId, relativePath, isDir);
    });

    // Workflow IPC
    ipcMain.handle('get-workflows', async () => {
        return await workflowManager.loadWorkflows();
    });

    ipcMain.handle('save-workflow', async (event, workflow) => {
        return await workflowManager.saveWorkflow(workflow);
    });

    ipcMain.handle('delete-workflow', async (event, id) => {
        return await workflowManager.deleteWorkflow(id);
    });

    ipcMain.handle('execute-workflow', async (event, id, context) => {
        // We can send progress updates via webContents if needed
        return await workflowManager.executeWorkflow(id, context, (stepId, status, output) => {
            event.sender.send('workflow-progress', { stepId, status, output });
        });
    });

    ipcMain.handle('stop-workflow', async (event, id) => {
        return await workflowManager.stopWorkflow(id);
    });

    // Memory / VectorStore IPC
    ipcMain.handle('memory-add', async (event, content, metadata) => {
        console.log('[Main] IPC memory-add received');
        try {
            return await vectorStore.addDocument(content, metadata);
        } catch (e) {
            console.error('[Main] IPC memory-add failed:', e);
            throw e;
        }
    });

    ipcMain.handle('memory-search', async (event, query, limit) => {
        console.log('[Main] IPC memory-search received:', query);
        try {
            return await vectorStore.search(query, limit);
        } catch (e) {
            console.error('[Main] IPC memory-search failed:', e);
            throw e;
        }
    });

    ipcMain.handle('memory-list', async () => {
        console.log('[Main] IPC memory-list received');
        try {
            return await vectorStore.listDocuments();
        } catch (e) {
            console.error('[Main] IPC memory-list failed:', e);
            throw e;
        }
    });

    ipcMain.handle('memory-delete', async (event, id) => {
        try {
            return await vectorStore.deleteDocument(id);
        } catch (e) {
            console.error('[Main] IPC memory-delete failed:', e);
            throw e;
        }
    });

    ipcMain.handle('memory-delete-by-source', async (event, source) => {
        try {
            return await vectorStore.deleteDocumentsBySource(source);
        } catch (e) {
            console.error('[Main] IPC memory-delete-by-source failed:', e);
            throw e;
        }
    });

    ipcMain.handle('memory-add-file', async (event, filePath) => {
        console.log('[Main] IPC memory-add-file received:', filePath);
        try {
            if (!filePath || !fs.existsSync(filePath)) {
                throw new Error('File not found: ' + filePath);
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            const filename = path.basename(filePath);
            await vectorStore.addDocument(content, {
                source: filename,
                path: filePath,
                type: 'file'
            });
            return { success: true };
        } catch (e: any) {
            console.error('[Main] IPC memory-add-file failed:', e);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('fs-list-dir', async (event, dirPath) => {
        // console.log('[Main] IPC fs-list-dir received:', dirPath);
        if (!dirPath) return [];
        try {
            const dirents = fs.readdirSync(dirPath, { withFileTypes: true });
            return dirents.map(dirent => ({
                name: dirent.name,
                isDirectory: dirent.isDirectory(),
                path: path.join(dirPath, dirent.name)
            })).sort((a, b) => {
                // Directories first
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });
        } catch (e) {
            console.error('[Main] IPC fs-list-dir failed:', e);
            return [];
        }
    });

    // Voice IPC
    ipcMain.handle('voice-get-config', async () => {
        return await voiceService.getModelStatus();
    });

    ipcMain.handle('voice-set-model', async (_event, modelId: string) => {
        voiceService.setModel(modelId);
        return await voiceService.getModelStatus();
    });

    ipcMain.handle('voice-download-model', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        return await voiceService.downloadModel((progress) => {
            if (win) {
                win.webContents.send('voice-download-progress', progress);
            }
        });
    });

    ipcMain.handle('voice-transcribe', async (event, filePath) => {
        return await voiceService.transcribe(filePath);
    });

    // ===== Chat History Handlers =====
    ipcMain.handle('history-list', async () => {
        return chatHistoryService.listSessions();
    });

    ipcMain.handle('history-get', async (_event, id: string) => {
        return chatHistoryService.getSession(id);
    });

    ipcMain.handle('history-save', async (_event, session: any) => {
        return chatHistoryService.saveSession(session);
    });

    ipcMain.handle('history-create', async () => {
        return chatHistoryService.createSession();
    });

    ipcMain.handle('history-delete', async (_event, id: string) => {
        return chatHistoryService.deleteSession(id);
    });

    ipcMain.handle('history-rename', async (_event, id: string, title: string) => {
        return chatHistoryService.renameSession(id, title);
    });

    // System
    ipcMain.handle('copy-to-clipboard', (_event, text: string) => {
        if (text) {
            clipboard.writeText(text);
            return true;
        }
        return false;
    });

    ipcMain.handle('shell-open-path', async (_event, path: string) => {
        const { shell } = await import('electron');
        return shell.openPath(path);
    });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
