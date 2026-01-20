import { defineStore } from 'pinia';
import { ref, watch, computed } from 'vue';
import i18n from '../i18n';

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    reasoning?: string
    tool_calls?: any[]
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    steps?: Array<{ name: string; status: 'pending' | 'done'; result?: string; progress?: string; args?: any }>
    plan?: Array<{ id: string; description: string; status: 'pending' | 'in-progress' | 'completed' }>
    question?: { text: string; options: Array<{ value: string; label: string; description?: string }>; multiple?: boolean }
    isEditing?: boolean
    _editContent?: string
}

interface Artifact {
    id: string;
    name: string;
    path: string;
    type: 'file' | 'image' | 'code' | 'json';
    createdAt: number;
}

interface ChatSession {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messages: Message[];
    artifacts?: Artifact[];
}

interface SessionSummary {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messageCount: number;
}

export const useChatStore = defineStore('chat', () => {
    // Helper to get translated greeting
    const getGreeting = () => i18n.global.t('chat.greeting');

    const messages = ref<Message[]>([
        { id: '1', role: 'assistant', content: getGreeting() }
    ]);

    // Current session ID
    const currentSessionId = ref<string | null>(null);

    // Session list (metadata only)
    const sessions = ref<SessionSummary[]>([]);

    // Initialization flag to prevent duplicate session creation
    const isInitialized = ref(false);

    // Map of messageId -> usage object
    const usages = ref<Record<string, { prompt_tokens: number; completion_tokens: number; total_tokens: number }>>({});

    // Add a message to the chat
    function addMessage(msg: Omit<Message, 'id'>) {
        messages.value.push({
            id: Date.now().toString(),
            ...msg
        });
    }

    // Set input value (for pre-filling from skills)
    const currentInput = ref('');

    // Session State
    const isStreaming = ref(false);

    function clearMessages() {
        messages.value = [
            { id: '1', role: 'assistant', content: getGreeting() }
        ];
        artifacts.value = [];
        usages.value = {};
    }

    // Load sessions list from backend
    async function loadSessions() {
        try {
            sessions.value = await window.electron.historyList();
        } catch (e) {
            console.error('Failed to load sessions', e);
        }
    }

    // Initialize - call once from App.vue or ChatHistory
    async function initialize() {
        if (isInitialized.value) {
            console.log('[ChatStore] Already initialized, skipping');
            return;
        }

        console.log('[ChatStore] Initializing...');
        isInitialized.value = true;

        await loadSessions();

        // If we have sessions, load the most recent one
        if (sessions.value.length > 0) {
            await loadSession(sessions.value[0].id);
        } else {
            // Create first session
            const session = await window.electron.historyCreate();
            currentSessionId.value = session.id;
            await loadSessions();
        }

        console.log('[ChatStore] Initialized with session:', currentSessionId.value);
    }

    // Load a specific session
    async function loadSession(id: string) {
        // Save current session first if it exists and has content
        if (currentSessionId.value && messages.value.length > 1) {
            await saveCurrentSession();
        }

        try {
            console.log('[ChatStore] Loading session:', id);
            const session = await window.electron.historyGet(id);
            if (session) {
                currentSessionId.value = session.id;

                if (session.messages && session.messages.length > 0) {
                    messages.value = session.messages;
                    // Restore usages from messages
                    usages.value = {};
                    session.messages.forEach((m: any) => {
                        if (m.usage) {
                            usages.value[m.id] = m.usage;
                        }
                    });
                } else {
                    messages.value = [{ id: '1', role: 'assistant', content: getGreeting() }];
                }
                artifacts.value = session.artifacts || [];
                console.log('[ChatStore] Loaded session with', messages.value.length, 'messages');
            }
        } catch (e) {
            console.error('Failed to load session', e);
        }
    }

    // Save current session
    async function saveCurrentSession() {
        if (!currentSessionId.value) {
            console.log('[ChatStore] No current session, creating one...');
            const session = await window.electron.historyCreate();
            currentSessionId.value = session.id;
        }

        // Don't save if only the greeting message exists
        if (messages.value.length <= 1) {
            return;
        }

        // Create a deep copy of messages to avoid Proxy issues across IPC
        // Create a deep copy of messages to avoid Proxy issues across IPC
        const serializedMessages = JSON.parse(JSON.stringify(messages.value)).map((m: any) => {
            // Merge usage if exists (and deep clone to avoid Proxy)
            if (usages.value[m.id]) {
                m.usage = JSON.parse(JSON.stringify(usages.value[m.id]));
            }
            return m;
        });

        const serializedArtifacts = JSON.parse(JSON.stringify(artifacts.value));

        const session: ChatSession = {
            id: currentSessionId.value!,
            title: 'New Chat',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: serializedMessages,
            artifacts: serializedArtifacts
        };

        console.log('[ChatStore] Saving session with', messages.value.length, 'messages');
        await window.electron.historySave(session);
        await loadSessions();
    }

    // Create new session
    async function newSession() {
        // Save current session first if it has user messages
        if (currentSessionId.value && messages.value.length > 1) {
            await saveCurrentSession();
        }

        const session = await window.electron.historyCreate();
        currentSessionId.value = session.id;
        clearMessages();
        await loadSessions();
    }

    // Delete a session (keep at least one)
    async function deleteSession(id: string) {
        if (sessions.value.length <= 1) {
            console.log('[ChatStore] Cannot delete the last session');
            return;
        }

        await window.electron.historyDelete(id);
        await loadSessions();

        if (currentSessionId.value === id) {
            if (sessions.value.length > 0) {
                await loadSession(sessions.value[0].id);
            } else {
                await newSession();
            }
        }
    }

    // UI State
    const isRightDrawerOpen = ref(false);
    const isHistoryOpen = ref(false);

    // Artifacts State
    const artifacts = ref<Artifact[]>([]);

    function toggleRightDrawer() {
        isRightDrawerOpen.value = !isRightDrawerOpen.value;
    }

    function toggleHistory() {
        isHistoryOpen.value = !isHistoryOpen.value;
    }

    function addArtifact(artifact: Omit<Artifact, 'id' | 'createdAt'>) {
        const existing = artifacts.value.find(a => a.path === artifact.path);
        if (existing) return;

        artifacts.value.unshift({
            id: Date.now().toString(),
            createdAt: Date.now(),
            ...artifact
        });
    }

    // Working Directory (Shared with RightDrawer)
    const workingDirectory = ref<string | null>(null);

    // Token Usage Stats


    // Computed total usage for the session
    const sessionDetails = computed(() => {
        let totalPrompt = 0;
        let totalCompletion = 0;
        let total = 0;

        Object.values(usages.value).forEach(u => {
            totalPrompt += u.prompt_tokens;
            totalCompletion += u.completion_tokens;
            total += u.total_tokens;
        });

        return {
            totalPrompt,
            totalCompletion,
            total
        };
    });

    // Computed Active Skills
    const activeSkills = computed(() => {
        const skills = new Set<string>();
        messages.value.forEach(msg => {
            // Check tool calls
            if (msg.tool_calls && msg.tool_calls.length > 0) {
                msg.tool_calls.forEach((tc: any) => {
                    if (tc.function && tc.function.name) {
                        skills.add(tc.function.name);
                    }
                });
            }
            // Check legacy steps
            if (msg.steps) {
                msg.steps.forEach((step: any) => {
                    if (step.name) skills.add(step.name);
                });
            }
            // Check plan
            if (msg.plan) {
                // Plan items usually don't have skill IDs directly, but we can verify against executed steps
            }
        });
        return Array.from(skills);
    });

    function updateUsage(usage: any) {
        if (!usage) return;

        // We usually associate usage with the last assistant message
        // Find last assistant message
        const lastMsg = [...messages.value].reverse().find(m => m.role === 'assistant');
        if (lastMsg) {
            usages.value[lastMsg.id] = {
                prompt_tokens: usage.prompt_tokens || 0,
                completion_tokens: usage.completion_tokens || 0,
                total_tokens: usage.total_tokens || 0
            };
        }
    }

    return {
        messages,
        currentInput,
        workingDirectory,
        isStreaming,
        addMessage,
        clearMessages,
        isRightDrawerOpen,
        toggleRightDrawer,
        artifacts,
        addArtifact,
        // History features
        currentSessionId,
        sessions,
        isHistoryOpen,
        isInitialized,
        toggleHistory,
        initialize,
        loadSessions,
        loadSession,
        saveCurrentSession,
        newSession,
        deleteSession,
        // Stats
        usages,
        updateUsage,
        sessionDetails,
        activeSkills
    };
});
