import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    onPermissionRequest: (callback: (request: any) => void) => {
        ipcRenderer.on('permission-request', (_event, request) => callback(request));
        return () => ipcRenderer.removeAllListeners('permission-request');
    },
    resolvePermissionRequest: (requestId: string, allow: boolean, options?: { persist?: boolean }) => ipcRenderer.send('permission-response', { requestId, allow, options }),

    // Existing methods...
    getSkills: () => ipcRenderer.invoke('get-skills'),
    executeSkill: (skillId: string, args: any) => ipcRenderer.invoke('execute-skill', skillId, args),
    getConfig: (key?: string) => ipcRenderer.invoke('get-config', key),
    setConfig: (key: string, value: any) => ipcRenderer.invoke('set-config', key, value),
    chat: (messages: any[], options?: any) => ipcRenderer.invoke('chat-message', messages, options),
    onStreamUpdate: (callback: (event: any) => void) => {
        const subscription = (_event: any, data: any) => callback(data)
        ipcRenderer.on('chat-stream-update', subscription)
        return () => ipcRenderer.removeListener('chat-stream-update', subscription)
    },
    createSkill: (data: any) => ipcRenderer.invoke('create-skill', data),
    updateSkill: (id: string, data: any) => ipcRenderer.invoke('update-skill', id, data),
    deleteSkill: (id: string) => ipcRenderer.invoke('delete-skill', id),
    readSkillScript: (id: string) => ipcRenderer.invoke('read-skill-script', id),
    updateSkillScript: (id: string, content: string) => ipcRenderer.invoke('update-skill-script', id, content),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    selectFile: () => ipcRenderer.invoke('select-file'),
    openFile: (path: string) => ipcRenderer.invoke('open-file', path),
    stopGeneration: () => ipcRenderer.invoke('stop-generation'),
    confirmToolExecution: (allowed: boolean) => ipcRenderer.invoke('confirm-tool-execution', allowed),
    importSkill: (url: string) => ipcRenderer.invoke('import-skill', url),
    generateSkill: (prompt: string) => ipcRenderer.invoke('generate-skill', prompt),
    listSkillFiles: (skillId: string) => ipcRenderer.invoke('list-skill-files', skillId),
    readSkillFile: (skillId: string, relativePath: string) => ipcRenderer.invoke('read-skill-file', skillId, relativePath),
    writeSkillFile: (skillId: string, relativePath: string, content: string) => ipcRenderer.invoke('write-skill-file', skillId, relativePath, content),
    deleteSkillFile: (skillId: string, relativePath: string) => ipcRenderer.invoke('delete-skill-file', skillId, relativePath),
    createSkillFile: (skillId: string, relativePath: string, isDir: boolean) => ipcRenderer.invoke('create-skill-file', skillId, relativePath, isDir),

    // Workflows
    getWorkflows: () => ipcRenderer.invoke('get-workflows'),
    saveWorkflow: (workflow: any) => ipcRenderer.invoke('save-workflow', workflow),
    deleteWorkflow: (id: string) => ipcRenderer.invoke('delete-workflow', id),
    executeWorkflow: (id: string, context: any) => ipcRenderer.invoke('execute-workflow', id, context),
    stopWorkflow: (id: string) => ipcRenderer.invoke('stop-workflow', id),
    onWorkflowProgress: (callback: (data: any) => void) => {
        const subscription = (_event: any, data: any) => callback(data);
        ipcRenderer.on('workflow-progress', subscription);
        return () => ipcRenderer.removeListener('workflow-progress', subscription);
    },

    // Memory
    memoryAdd: (content: string, metadata: any) => ipcRenderer.invoke('memory-add', content, metadata),
    memorySearch: (query: string, limit: number) => ipcRenderer.invoke('memory-search', query, limit),
    memoryList: () => ipcRenderer.invoke('memory-list'),
    memoryDelete: (id: string) => ipcRenderer.invoke('memory-delete', id),
    memoryDeleteBySource: (source: string) => ipcRenderer.invoke('memory-delete-by-source', source),
    memoryAddFile: (path: string) => ipcRenderer.invoke('memory-add-file', path),
    fsListDir: (path: string) => ipcRenderer.invoke('fs-list-dir', path),

    // Voice
    voiceGetConfig: () => ipcRenderer.invoke('voice-get-config'),
    voiceSetModel: (modelId: string) => ipcRenderer.invoke('voice-set-model', modelId),
    voiceDownloadModel: () => ipcRenderer.invoke('voice-download-model'),
    voiceTranscribe: (input: any) => ipcRenderer.invoke('voice-transcribe', input),
    onVoiceDownloadProgress: (callback: (progress: any) => void) => {
        const subscription = (_event: any, data: any) => callback(data);
        ipcRenderer.on('voice-download-progress', subscription);
        return () => ipcRenderer.removeListener('voice-download-progress', subscription);
    },

    // Chat History
    historyList: () => ipcRenderer.invoke('history-list'),
    historyGet: (id: string) => ipcRenderer.invoke('history-get', id),
    historySave: (session: any) => ipcRenderer.invoke('history-save', session),
    historyCreate: () => ipcRenderer.invoke('history-create'),
    historyDelete: (id: string) => ipcRenderer.invoke('history-delete', id),
    historyRename: (id: string, title: string) => ipcRenderer.invoke('history-rename', id, title),

    // Encryption
    encryptionHasMasterPassword: () => ipcRenderer.invoke('encryption:has-master-password'),
    encryptionSetMasterPassword: (password: string) => ipcRenderer.invoke('encryption:set-master-password', password),
    encryptionUnlock: () => ipcRenderer.invoke('encryption:unlock'),
    encryptionVerifyPassword: (password: string) => ipcRenderer.invoke('encryption:verify-password', password),
    encryptionIsUnlocked: () => ipcRenderer.invoke('encryption:is-unlocked'),
    encryptionLock: () => ipcRenderer.invoke('encryption:lock'),
    encryptionClearAll: () => ipcRenderer.invoke('encryption:clear-all'),

    // Enhanced Memory
    memoryAddEnhanced: (options: any) => ipcRenderer.invoke('memory:add-enhanced', options),
    memoryListEnhanced: () => ipcRenderer.invoke('memory:list-enhanced'),
    memorySearchEnhanced: (query: string, options?: any) => ipcRenderer.invoke('memory:search-enhanced', query, options),
    memoryGetStatistics: () => ipcRenderer.invoke('memory:get-statistics'),
    memorySuggestCategory: (content: string) => ipcRenderer.invoke('memory:suggest-category', content),
    memoryDecrypt: (memory: any) => ipcRenderer.invoke('memory:decrypt', memory),
    memoryAddManual: (options: any) => ipcRenderer.invoke('memory:add-manual', options),
    memoryGetUsageForMessage: (messageId: string, query: string) => ipcRenderer.invoke('memory:get-usage-for-message', messageId, query),

    // Phase 5: Memory Optimization
    memoryFindDuplicates: (threshold?: number) => ipcRenderer.invoke('memory:find-duplicates', threshold),
    memoryMergeDuplicates: (memoryId1: string, memoryId2: string) => ipcRenderer.invoke('memory:merge-duplicates', memoryId1, memoryId2),
    memoryOptimizeAll: () => ipcRenderer.invoke('memory:optimize-all'),
    memorySuggestCategoryAdvanced: (content: string) => ipcRenderer.invoke('memory:suggest-category-advanced', content),

    // System
    copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
    shellOpenPath: (path: string) => ipcRenderer.invoke('shell-open-path', path),
    showItemInFolder: (path: string) => ipcRenderer.invoke('show-item-in-folder', path),
    pathResolve: (...args: string[]) => require('path').resolve(...args),
});
