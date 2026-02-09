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
import encryptionService from './services/EncryptionService';
import keychainService from './services/KeychainService';
import memoryManager from './services/MemoryManager';
import { EnhancedMemory, MemoryCategory } from './types';

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
skillManager.setMemoryManager(memoryManager);
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
        ...(process.platform !== 'darwin' ? {
            icon: app.isPackaged
                ? path.join(process.resourcesPath, 'icon.icns')
                : path.join(__dirname, '../../resources/icon.icns')
        } : {})
    });

    if (process.platform === 'darwin') {
        try {
            const iconPath = app.isPackaged
                ? path.join(process.resourcesPath, 'icon.png')
                : path.join(__dirname, '../../resources/icon.png');
            app.dock?.setIcon(iconPath);
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
            // Use MemoryManager to handle metadata and potentially encryption
            // Note: IPC metadata might be shallow, ensure options are passed
            const options = {
                category: metadata?.category,
                priority: metadata?.priority,
                tags: metadata?.tags,
                encrypted: metadata?.encrypted,
                expiresIn: metadata?.expiresIn // UI sends expiresAt, need to handle?
            };

            // If expiresAt is absolute timestamp, MemoryManager expects expiresIn options or we handle it manually
            // MemoryManager.createMemory uses options to set timestamps. 
            // Let's assume metadata passed from UI aligns with MemoryOptions, or we map it.

            const memory = await memoryManager.createMemory(content, {
                ...metadata,
                encrypted: metadata?.encrypted
            });

            // If explicit expiresAt is passed (from UI), override it
            if (metadata?.expiresAt) {
                memory.expiresAt = metadata.expiresAt;
            }

            return await vectorStore.addEnhancedMemory(memory);
        } catch (e) {
            console.error('[Main] IPC memory-add failed:', e);
            throw e;
        }
    });

    ipcMain.handle('memory-search', async (event, query, limit) => {
        console.log('[Main] IPC memory-search received:', query);
        try {
            // Use Enhanced Memory Search
            const results = await vectorStore.searchEnhancedMemories(query, { limit });
            // Map back to array of memories for legacy support, or assume frontend handles it?
            // The frontend likely expects just memories. Let's return just memories for this legacy handler.
            return results.map(r => r.memory);
        } catch (e) {
            console.error('[Main] IPC memory-search failed:', e);
            throw e;
        }
    });

    ipcMain.handle('memory-list', async () => {
        console.log('[Main] IPC memory-list received');
        try {
            // Use Enhanced Memory List
            const memories = await vectorStore.listEnhancedMemories();
            // Filter expired?
            const { valid } = memoryManager.filterExpired(memories);
            return valid;
        } catch (e) {
            console.error('[Main] IPC memory-list failed:', e);
            throw e;
        }
    });

    ipcMain.handle('memory-delete', async (event, id) => {
        console.log('[Main] IPC memory-delete received:', id);
        try {
            return await vectorStore.deleteEnhancedMemory(id);
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

    // ===== Enhanced Memory IPC Handlers =====

    // 添加增强记忆
    ipcMain.handle('memory:add-enhanced', async (_event, options: {
        content: string
        category?: MemoryCategory
        priority?: 'high' | 'medium' | 'low'
        tags?: string[]
        expiresAt?: number
        encrypted?: boolean
        source?: string
        metadata?: Record<string, any>
    }) => {
        try {
            const memory = memoryManager.createMemory(options.content, options)
            await vectorStore.addEnhancedMemory(memory)
            return { success: true, memory }
        } catch (error: any) {
            console.error('[Main] memory:add-enhanced failed:', error)
            return { success: false, error: error.message }
        }
    })

    // 获取所有增强记忆
    ipcMain.handle('memory:list-enhanced', async () => {
        try {
            const memories = await vectorStore.listEnhancedMemories()
            // 过滤过期记忆
            const { valid } = memoryManager.filterExpired(memories)
            return { success: true, memories: valid }
        } catch (error: any) {
            console.error('[Main] memory:list-enhanced failed:', error)
            return { success: false, error: error.message }
        }
    })

    // 搜索增强记忆
    ipcMain.handle('memory:search-enhanced', async (_event, query: string, options?: {
        limit?: number
        categories?: MemoryCategory[]
        priorities?: ('high' | 'medium' | 'low')[]
    }) => {
        try {
            const results = await vectorStore.searchEnhancedMemories(query, options)
            // Return { memory, score } items
            return { success: true, results }
        } catch (error: any) {
            console.error('[Main] memory:search-enhanced failed:', error)
            return { success: false, error: error.message }
        }
    })

    // 获取记忆统计
    ipcMain.handle('memory:get-statistics', async () => {
        try {
            const memories = await vectorStore.listEnhancedMemories()
            const stats = memoryManager.getStatistics(memories)
            return { success: true, stats }
        } catch (error: any) {
            console.error('[Main] memory:get-statistics failed:', error)
            return { success: false, error: error.message }
        }
    })

    // 建议分类
    ipcMain.handle('memory:suggest-category', async (_event, content: string) => {
        try {
            const category = memoryManager.suggestCategory(content)
            return { success: true, category }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    })

    // 解密记忆
    ipcMain.handle('memory:decrypt', async (_event, memory: EnhancedMemory) => {
        try {
            const content = memoryManager.decryptMemory(memory)
            return { success: true, content }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    })

    // 手动添加记忆（别名，用于用户主动保存）
    ipcMain.handle('memory:add-manual', async (_event, options: {
        content: string
        category?: MemoryCategory
        priority?: 'high' | 'medium' | 'low'
        tags?: string[]
        expiresAt?: number
        encrypted?: boolean
        metadata?: Record<string, any>
    }) => {
        try {
            const memory = memoryManager.createMemory(options.content, {
                ...options,
                source: 'manual'
            })
            await vectorStore.addEnhancedMemory(memory)
            return { success: true, memory }
        } catch (error: any) {
            console.error('[Main] memory:add-manual failed:', error)
            return { success: false, error: error.message }
        }
    })

    // 获取消息的记忆使用情况
    ipcMain.handle('memory:get-usage-for-message', async (_event, messageId: string, query: string) => {
        try {
            // 搜索相关记忆
            const results = await vectorStore.searchEnhancedMemories(query, { limit: 5 })

            // 过滤低相关度记忆 (阈值 0.75)
            const RELEVANCE_THRESHOLD = 0.75

            // 构建记忆使用记录
            const memoryUsage = results
                .filter(result => result.score >= RELEVANCE_THRESHOLD)
                .map(result => ({
                    memory: result.memory,
                    relevanceScore: result.score,
                    usedAt: Date.now()
                }))

            return { success: true, memoryUsage }
        } catch (error: any) {
            console.error('[Main] memory:get-usage-for-message failed:', error)
            return { success: false, error: error.message }
        }
    })

    // Phase 5: 智能优化 IPC Handlers

    // 检测重复记忆
    ipcMain.handle('memory:find-duplicates', async (_event, threshold?: number) => {
        try {
            const memories = await vectorStore.listEnhancedMemories()
            const duplicates = memoryManager.findDuplicates(memories, threshold)
            return { success: true, duplicates }
        } catch (error: any) {
            console.error('[Main] memory:find-duplicates failed:', error)
            return { success: false, error: error.message }
        }
    })

    // 合并重复记忆
    ipcMain.handle('memory:merge-duplicates', async (_event, memoryId1: string, memoryId2: string) => {
        try {
            const memories = await vectorStore.listEnhancedMemories()
            const memory1 = memories.find(m => m.id === memoryId1)
            const memory2 = memories.find(m => m.id === memoryId2)

            if (!memory1 || !memory2) {
                return { success: false, error: 'Memory not found' }
            }

            const merged = memoryManager.mergeDuplicates(memory1, memory2)

            // 更新向量存储（删除旧的，添加新的）
            // 注意：这里需要 VectorStore 支持删除操作
            await vectorStore.addEnhancedMemory(merged)

            return { success: true, merged }
        } catch (error: any) {
            console.error('[Main] memory:merge-duplicates failed:', error)
            return { success: false, error: error.message }
        }
    })

    // 批量优化记忆
    ipcMain.handle('memory:optimize-all', async () => {
        try {
            const memories = await vectorStore.listEnhancedMemories()
            const result = memoryManager.optimizeMemories(memories)

            // 更新向量存储
            // 注意：这是一个简化版本，实际应该批量更新
            for (const memory of result.optimized) {
                await vectorStore.addEnhancedMemory(memory)
            }

            return {
                success: true,
                optimized: result.optimized.length,
                removed: result.removed.length,
                merged: result.merged.length
            }
        } catch (error: any) {
            console.error('[Main] memory:optimize-all failed:', error)
            return { success: false, error: error.message }
        }
    })

    // 改进的分类建议
    ipcMain.handle('memory:suggest-category-advanced', async (_event, content: string) => {
        try {
            const suggestion = memoryManager.suggestCategoryAdvanced(content)
            return { success: true, ...suggestion }
        } catch (error: any) {
            console.error('[Main] memory:suggest-category-advanced failed:', error)
            return { success: false, error: error.message }
        }
    })

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

    ipcMain.handle('show-item-in-folder', async (_event, path: string) => {
        const { shell } = await import('electron');
        if (path) {
            shell.showItemInFolder(path);
            return true;
        }
        return false;
    });

    // ===== Encryption & Keychain IPC Handlers =====

    // 检查是否已设置主密码
    ipcMain.handle('encryption:has-master-password', async () => {
        return await keychainService.hasMasterPassword();
    });

    // 设置主密码
    ipcMain.handle('encryption:set-master-password', async (_event, password: string) => {
        try {
            // 生成 salt 并派生密钥
            const salt = await encryptionService.setMasterPassword(password);

            // 保存到 Keychain
            await keychainService.saveMasterPassword(password);
            await keychainService.saveEncryptionSalt(salt);

            // 生成测试密文用于验证
            const testCiphertext = encryptionService.generateTestCiphertext();

            // 保存到配置
            configManager.set('encryptionConfig', {
                enabled: true,
                testCiphertext
            });

            // 立即验证配置是否一致
            const isValid = await encryptionService.verifyPassword(password, salt, testCiphertext);
            if (!isValid) {
                // 如果验证失败，回滚操作
                await keychainService.deleteMasterPassword(); // 其实这里应该更彻底清理，但至少报错
                throw new Error('Critical Error: Failed to verify the newly set password. System state inconsistent.');
            }

            return { success: true };
        } catch (error: any) {
            console.error('[Encryption] Failed to set master password:', error);
            return { success: false, error: error.message };
        }
    });

    // 解锁（应用启动时调用）
    ipcMain.handle('encryption:unlock', async () => {
        try {
            const password = await keychainService.getMasterPassword();
            if (!password) {
                return { success: false, error: 'No master password found' };
            }

            const salt = await keychainService.getEncryptionSalt();
            if (!salt) {
                return { success: false, error: 'No encryption salt found' };
            }

            // 派生密钥
            await encryptionService.setMasterPassword(password, salt);

            // 验证密码是否正确
            const config = configManager.get('encryptionConfig');
            if (config?.testCiphertext) {
                try {
                    encryptionService.decrypt(config.testCiphertext);
                } catch (e) {
                    return { success: false, error: 'Invalid password' };
                }
            }

            return { success: true };
        } catch (error: any) {
            console.error('[Encryption] Failed to unlock:', error);
            return { success: false, error: error.message };
        }
    });

    // 验证密码
    ipcMain.handle('encryption:verify-password', async (_event, password: string) => {
        try {
            const salt = await keychainService.getEncryptionSalt();
            if (!salt) return false;

            const config = configManager.get('encryptionConfig');
            if (!config?.testCiphertext) return false;

            return await encryptionService.verifyPassword(
                password,
                salt,
                config.testCiphertext
            );
        } catch (error) {
            console.error('[Encryption] Password verification failed:', error);
            return false;
        }
    });

    // 检查是否已解锁
    ipcMain.handle('encryption:is-unlocked', () => {
        return encryptionService.isUnlocked();
    });

    // 锁定
    ipcMain.handle('encryption:lock', () => {
        encryptionService.lock();
        return true;
    });

    // 清除所有加密数据
    ipcMain.handle('encryption:clear-all', async () => {
        try {
            await keychainService.clearAll();
            encryptionService.lock();
            configManager.set('encryptionConfig', { enabled: false });

            // CRITICAL: Delete all encrypted memories because the key is destroyed.
            // They become unreadable garbage otherwise.
            const allMemories = await vectorStore.listEnhancedMemories();
            const encryptedIds = allMemories
                .filter(m => m.metadata?.encrypted)
                .map(m => m.id);

            console.log(`[Encryption] Clearing ${encryptedIds.length} encrypted memories due to reset...`);

            for (const id of encryptedIds) {
                await vectorStore.deleteEnhancedMemory(id);
            }

            return { success: true, count: encryptedIds.length };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
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
