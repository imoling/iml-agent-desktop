/// <reference types="vite/client" />

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    const component: DefineComponent<{}, {}, any>
    export default component
}

interface Window {
    electron: {
        getSkills: () => Promise<any[]>;
        executeSkill: (skillId: string, args: any) => Promise<any>;
        getConfig: (key?: string) => Promise<any>;
        setConfig: (key: string, value: any) => Promise<void>;
        chat: (messages: any[], options?: { cwd?: string | null }) => Promise<string>;
        onStreamUpdate: (callback: (event: { type: string, content: string, data?: any }) => void) => () => void;
        createSkill: (skillData: { name: string; description: string; inputs: any[] }) => Promise<{ success: boolean; error?: string; path?: string; skillId?: string }>;

        // Added methods
        updateSkill: (id: string, data: any) => Promise<{ success: boolean; error?: string }>;
        readSkillScript: (id: string) => Promise<{ success: boolean; content?: string; error?: string }>;
        updateSkillScript: (id: string, content: string) => Promise<{ success: boolean; error?: string }>;
        deleteSkill: (id: string) => Promise<{ success: boolean; error?: string }>;
        selectDirectory: () => Promise<string | null>;
        selectFile: () => Promise<string | null>;
        openFile: (path: string) => Promise<boolean>;
        stopGeneration: () => Promise<boolean>;
        confirmToolExecution: (allowed: boolean) => Promise<boolean>;
        importSkill: (url: string) => Promise<{ success: boolean; error?: string; skillId?: string }>;
        generateSkill: (prompt: string) => Promise<{ success: boolean; data?: import('./types').SkillGenerationResult; error?: string }>;
        listSkillFiles: (skillId: string) => Promise<Array<{ name: string; path: string; isDir: boolean; size: number; mtime: number }>>;
        readSkillFile: (skillId: string, relativePath: string) => Promise<string>;
        writeSkillFile: (skillId: string, relativePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
        deleteSkillFile: (skillId: string, relativePath: string) => Promise<{ success: boolean; error?: string }>;
        createSkillFile: (skillId: string, relativePath: string, isDir: boolean) => Promise<{ success: boolean; error?: string }>;
        onPermissionRequest: (callback: (request: { requestId: string; permission: string; context?: any }) => void) => () => void;
        resolvePermissionRequest: (requestId: string, allow: boolean, options?: { persist?: boolean }) => void;

        // Workflows
        getWorkflows: () => Promise<any[]>;
        saveWorkflow: (workflow: any) => Promise<void>;
        deleteWorkflow: (id: string) => Promise<void>;
        executeWorkflow: (id: string, context?: any) => Promise<any>;
        stopWorkflow: (id: string) => Promise<boolean>;
        onWorkflowProgress: (callback: (data: { stepId: string; status: string; output?: any }) => void) => () => void;

        // Encryption (Phase 1)
        encryptionHasMasterPassword: () => Promise<boolean>;
        encryptionSetMasterPassword: (password: string) => Promise<boolean>;
        encryptionUnlock: (password?: string) => Promise<boolean>;
        encryptionVerifyPassword: (password: string) => Promise<boolean>;
        encryptionIsUnlocked: () => Promise<boolean>;
        encryptionLock: () => Promise<void>;
        encryptionClearAll: () => Promise<void>;

        // Enhanced Memory (Phase 2-5)
        memoryAddEnhanced: (options: any) => Promise<any>;
        memoryListEnhanced: () => Promise<any[]>;
        memorySearchEnhanced: (query: string, options?: any) => Promise<any[]>;
        memoryGetStatistics: () => Promise<any>;
        memorySuggestCategory: (content: string) => Promise<string>;
        memoryDecrypt: (memory: any) => Promise<{ success: boolean; content?: string }>;
        memoryAddManual: (options: any) => Promise<{ success: boolean; memory?: any; error?: string }>;
        memoryGetUsageForMessage: (messageId: string, query: string) => Promise<{ success: boolean; memoryUsage?: any[] }>;

        // Memory Optimization (Phase 5)
        memoryFindDuplicates: (threshold?: number) => Promise<{ success: boolean; duplicates?: any[] }>;
        memoryMergeDuplicates: (id1: string, id2: string) => Promise<{ success: boolean; merged?: any }>;
        memoryOptimizeAll: () => Promise<{ success: boolean; optimized?: number; removed?: number; merged?: number }>;
        memorySuggestCategoryAdvanced: (content: string) => Promise<{ success: boolean; category?: string; confidence?: number; keywords?: string[] }>;

        // System
        copyToClipboard: (text: string) => Promise<boolean>;

        // Legacy Memory (keeping for compatibility)
        memoryAdd: (content: string, metadata: any) => Promise<void>;
        memorySearch: (query: string, limit: number) => Promise<any[]>;
        memoryList: () => Promise<any[]>;
        memoryDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
        memoryDeleteBySource: (source: string) => Promise<number>;
        memoryAddFile: (path: string) => Promise<{ success: boolean; error?: string }>;
        fsListDir: (path: string) => Promise<Array<{ name: string; isDirectory: boolean; path: string }>>;

        // Voice
        voiceGetConfig: () => Promise<{ id: string; downloaded: boolean; downloading: boolean; path: string | null }>;
        voiceSetModel: (modelId: string) => Promise<any>;
        voiceDownloadModel: () => Promise<boolean>;
        voiceTranscribe: (input: string | Float32Array) => Promise<any>;
        onVoiceDownloadProgress: (callback: (progress: any) => void) => () => void;

        // Chat History
        historyList: () => Promise<Array<{ id: string; title: string; createdAt: number; updatedAt: number; messageCount: number }>>;
        historyGet: (id: string) => Promise<any>;
        historySave: (session: any) => Promise<any>;
        historyCreate: () => Promise<any>;
        historyDelete: (id: string) => Promise<boolean>;
        historyRename: (id: string, title: string) => Promise<any>;
        shellOpenPath: (path: string) => Promise<void>;
        showItemInFolder: (path: string) => Promise<boolean>;
        pathResolve: (...args: string[]) => string;
    }
}
