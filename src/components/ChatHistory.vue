<script setup lang="ts">
import { onMounted } from 'vue'
import { useChatStore } from '../stores/chat'
import { Plus, Trash2, MessageCircle, Clock, X, History } from 'lucide-vue-next'

import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'

const chatStore = useChatStore()
const { t, locale } = useI18n()

onMounted(async () => {
    // Use initialize() which has a guard against duplicate calls
    await chatStore.initialize()
})

const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    // Today
    if (diff < 86400000 && date.getDate() === now.getDate()) {
        return date.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
    }
    // Yesterday
    if (diff < 172800000) {
        return locale.value === 'zh-CN' ? '昨天' : 'Yesterday'
    }
    // This week
    if (diff < 604800000) {
        if (locale.value === 'zh-CN') {
            const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
            return days[date.getDay()]
        } else {
             return date.toLocaleDateString(locale.value, { weekday: 'short' })
        }
    }
    // Older
    return date.toLocaleDateString(locale.value, { month: 'short', day: 'numeric' })
}

const handleNewChat = async () => {
    await chatStore.newSession()
}

const handleLoadSession = async (id: string) => {
    await chatStore.loadSession(id)
    if (window.innerWidth < 768) {
        chatStore.toggleHistory()
    }
}

const handleDeleteSession = async (id: string, e: Event) => {
    e.stopPropagation()
    if (confirm(t('sidebar.deleteChat'))) {
        await chatStore.deleteSession(id)
    }
}
</script>

<template>
    <div class="history-sidebar">
        <!-- Header -->
        <div class="sidebar-header">
            <div class="header-title">
                <History class="icon" />
                <span>{{ t('sidebar.history') }}</span>
            </div>
            <button @click="chatStore.toggleHistory" class="close-btn md:hidden">
                <X class="w-4 h-4" />
            </button>
        </div>
        
        <!-- New Chat Button -->
        <div class="px-3 pt-4 mb-3">
            <button @click="handleNewChat" class="new-chat-btn">
                <Plus class="w-4 h-4" />
                <span>{{ t('sidebar.newChat') }}</span>
            </button>
        </div>
        
        <!-- Session List -->
        <div class="session-list">
            <div v-if="chatStore.sessions.length === 0" class="empty-state">
                <MessageCircle class="w-8 h-8 opacity-30" />
                <p>{{ t('sidebar.noHistory') }}</p>
            </div>
            
            <div 
                v-for="session in chatStore.sessions" 
                :key="session.id"
                @click="handleLoadSession(session.id)"
                :class="['session-item', { active: session.id === chatStore.currentSessionId }]"
            >
                <div class="session-icon">
                    <MessageCircle class="w-4 h-4" />
                </div>
                <div class="session-content">
                    <h3 class="session-title">{{ session.title || 'New Chat' }}</h3>
                    <div class="session-meta">
                        <Clock class="w-3 h-3" />
                        <span>{{ formatDate(session.updatedAt) }}</span>
                        <span class="dot">•</span>
                        <span>{{ session.messageCount }} 条</span>
                    </div>
                </div>
                <button 
                    @click="(e) => handleDeleteSession(session.id, e)"
                    class="delete-btn"
                    title="删除"
                >
                    <Trash2 class="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.history-sidebar {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary, linear-gradient(180deg, rgba(15, 15, 25, 0.95) 0%, rgba(10, 10, 20, 0.98) 100%));
    border-right: 1px solid var(--border-color, rgba(255, 255, 255, 0.06));
}

.sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    height: 44px;
    box-sizing: border-box;
    border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.06));
}

.header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, rgba(255, 255, 255, 0.9));
}

.header-title .icon {
    width: 18px;
    height: 18px;
    color: #818cf8;
}

.close-btn {
    padding: 6px;
    border-radius: 8px;
    color: var(--text-muted, rgba(255, 255, 255, 0.4));
    transition: all 0.2s;
}

.close-btn:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.1));
    color: var(--text-primary, white);
}

.new-chat-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    font-size: 13px;
    font-weight: 600;
    border-radius: 10px;
    transition: all 0.2s;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.new-chat-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
}

.new-chat-btn:active {
    transform: scale(0.98);
}

.session-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 8px 8px;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 40px 20px;
    color: rgba(255, 255, 255, 0.3);
    font-size: 13px;
}

.session-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    margin-bottom: 4px;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid transparent;
}

.session-item:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.04));
}

.session-item.active {
    background: rgba(99, 102, 241, 0.12);
    border-color: rgba(99, 102, 241, 0.2);
}

.session-icon {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-surface, rgba(255, 255, 255, 0.05));
    border-radius: 8px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
}

.session-item.active .session-icon {
    background: rgba(99, 102, 241, 0.2);
    color: #a5b4fc;
}

.session-content {
    flex: 1;
    min-width: 0;
}

.session-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary, rgba(255, 255, 255, 0.85));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
}

.session-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-muted, rgba(255, 255, 255, 0.35));
}

.session-meta .dot {
    opacity: 0.5;
}

.delete-btn {
    flex-shrink: 0;
    padding: 6px;
    border-radius: 6px;
    color: var(--text-muted, rgba(255, 255, 255, 0.3));
    opacity: 0;
    transition: all 0.15s;
}

.session-item:hover .delete-btn {
    opacity: 1;
}

.delete-btn:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
}

/* Custom scrollbar */
.session-list::-webkit-scrollbar {
    width: 4px;
}

.session-list::-webkit-scrollbar-track {
    background: transparent;
}

.session-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4px;
}

.session-list::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.15);
}
</style>
