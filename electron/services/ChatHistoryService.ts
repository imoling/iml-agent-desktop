import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    reasoning?: string;
    tool_calls?: any[];
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    steps?: Array<{ name: string; status: 'pending' | 'done'; result?: string; progress?: string }>;
}

export interface ChatSession {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messages: ChatMessage[];
    artifacts?: Array<{
        id: string;
        name: string;
        path: string;
        type: 'file' | 'image' | 'code' | 'json';
        createdAt: number;
    }>;
}

interface HistoryStore {
    sessions: ChatSession[];
}

export class ChatHistoryService {
    private store: Store<HistoryStore>;

    constructor() {
        this.store = new Store<HistoryStore>({
            name: 'chat-history',
            defaults: {
                sessions: []
            }
        });
    }

    // Get all sessions (metadata only, without full messages for performance)
    listSessions(): Array<Omit<ChatSession, 'messages'> & { messageCount: number }> {
        const sessions = (this.store as any).get('sessions') || [];
        return sessions.map((s: ChatSession) => ({
            id: s.id,
            title: s.title,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            messageCount: s.messages?.length || 0
        })).sort((a: any, b: any) => b.updatedAt - a.updatedAt); // Most recent first
    }

    // Get full session with messages
    getSession(id: string): ChatSession | null {
        const sessions = (this.store as any).get('sessions') || [];
        return sessions.find((s: ChatSession) => s.id === id) || null;
    }

    // Create or update session
    saveSession(session: ChatSession): ChatSession {
        const sessions: ChatSession[] = (this.store as any).get('sessions') || [];
        const index = sessions.findIndex(s => s.id === session.id);

        // Update timestamp
        session.updatedAt = Date.now();

        // Auto-generate title from first user message if not set
        if (!session.title || session.title === 'New Chat') {
            const firstUserMsg = session.messages.find(m => m.role === 'user');
            if (firstUserMsg) {
                session.title = firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '');
            }
        }

        if (index >= 0) {
            sessions[index] = session;
        } else {
            session.createdAt = session.createdAt || Date.now();
            sessions.push(session);
        }

        (this.store as any).set('sessions', sessions);
        console.log(`[ChatHistory] Saved session: ${session.id} (${session.title})`);
        return session;
    }

    // Create new empty session
    createSession(): ChatSession {
        const session: ChatSession = {
            id: uuidv4(),
            title: 'New Chat',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: []
        };
        return this.saveSession(session);
    }

    // Delete session
    deleteSession(id: string): boolean {
        const sessions: ChatSession[] = (this.store as any).get('sessions') || [];
        const filtered = sessions.filter(s => s.id !== id);

        if (filtered.length < sessions.length) {
            (this.store as any).set('sessions', filtered);
            console.log(`[ChatHistory] Deleted session: ${id}`);
            return true;
        }
        return false;
    }

    // Rename session
    renameSession(id: string, title: string): ChatSession | null {
        const session = this.getSession(id);
        if (session) {
            session.title = title;
            return this.saveSession(session);
        }
        return null;
    }
}
