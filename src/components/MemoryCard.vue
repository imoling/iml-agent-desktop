<template>
    <div class="memory-card group relative bg-[#1c1c21] hover:bg-[#25252b] border border-white/10 hover:border-indigo-500/30 rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-0.5">
        <div class="flex items-start justify-between gap-4">
            <div class="flex-1 space-y-3">
                <!-- Header with Category and Time -->
                <div class="flex items-center gap-2 mb-2">
                    <span 
                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                        :class="getCategoryClass(item.category || 'note')"
                    >
                        <component :is="getCategoryIcon(item.category || 'note')" class="w-3.5 h-3.5" />
                        {{ getCategoryLabel(item.category || 'note') }}
                    </span>
                    
                    <span 
                        v-if="item.priority === 'high'" 
                        class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse-slow"
                    >
                        <AlertCircle class="w-3.5 h-3.5" />
                        {{ t('memory.highPriority') }}
                    </span>
                    
                    <span class="text-[11px] text-gray-400 font-mono ml-auto flex items-center gap-1">
                        <Clock class="w-3 h-3" />
                        {{ formatTime(item.updatedAt || item.metadata.timestamp) }}
                    </span>
                </div>

                <!-- Content Area -->
                <div class="relative group/content bg-black/20 rounded-xl p-3 border border-white/5 transition-all duration-300"
                    :class="[(item.encrypted && !isDecrypted) ? 'min-h-[110px]' : 'min-h-[60px]']">
                    <!-- Encryption Overlay -->
                    <div v-if="item.encrypted && !isDecrypted" class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md rounded-xl transition-all">
                        <div class="flex flex-col items-center gap-2 text-gray-400">
                            <Lock class="w-6 h-6 text-indigo-400" />
                            <span class="text-xs font-medium">{{ t('memory.encryptedContent') }}</span>
                            <button 
                                @click.stop="handleDecrypt"
                                class="mt-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
                            >
                                {{ t('memory.tapToUnlock') }}
                            </button>
                        </div>
                    </div>

                    <!-- Actual Content -->
                    <div class="flex items-start gap-3">
                        <p 
                            class="text-[13px] leading-relaxed text-gray-200 whitespace-pre-wrap font-mono break-all line-clamp-4"
                            :class="{ 'opacity-0': item.encrypted && !isDecrypted }"
                        >
                            {{ item.content }}
                        </p>
                    </div>
                </div>

                <!-- Footer Metadata -->
                <div v-if="item.tags && item.tags.length" class="flex flex-wrap items-center gap-2 pt-1">
                    <span 
                        v-for="tag in item.tags" 
                        :key="tag" 
                        class="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-white/5 text-gray-500 border border-white/10 hover:bg-white/10 hover:text-gray-300 transition-colors cursor-default"
                    >
                        <Tag class="w-3 h-3 mr-1 opacity-70" />
                        {{ tag }}
                    </span>
                </div>
            </div>

            <!-- Side Actions -->
            <div class="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 -mr-2 pt-1">
                <button 
                    @click="$emit('delete', item.id)"
                    class="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                    :title="t('memory.deleteMemory')"
                >
                    <Trash2 class="w-4 h-4" />
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Trash2, Lock, Unlock, AlertCircle, User, Briefcase, Heart, Key, Clock, FileText, Tag } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
    item: any
}>()

const emit = defineEmits<{
    (e: 'delete', id: string): void
}>()

const { t } = useI18n()

const isDecrypted = ref(false)
const decryptedContent = ref('')



const formatTime = (ts?: number) => {
    if (!ts) return ''
    return new Date(ts).toLocaleString()
}

const handleDecrypt = async () => {
    // Special handling for demo item
    if (props.item.id === 'demo-preview') {
        decryptedContent.value = props.item.content
        isDecrypted.value = true
        return
    }

    try {
        // Deep clone to remove Vue reactivity/Proxy
        const plainItem = JSON.parse(JSON.stringify(props.item))
        const result = await window.electron.memoryDecrypt(plainItem) as { success: boolean, content?: string, error?: string }
        if (result.success && result.content) {
            decryptedContent.value = result.content
            isDecrypted.value = true
        } else {
            alert('Failed to decrypt: ' + (result.error || 'Unknown error'))
        }
    } catch (e: any) {
        alert('Error: ' + e.message)
    }
}

const getCategoryIcon = (category: string) => {
    switch (category) {
        case 'personal': return User
        case 'project': return Briefcase
        case 'preference': return Heart
        case 'credential': return Key
        case 'temporary': return Clock
        default: return FileText
    }
}

const getCategoryLabel = (category: string) => {
    // Use i18n for category labels
    const key = category?.toLowerCase() || 'unknown'
    return t(`memory.category.${key}`, key)
}

const getCategoryClass = (category: string) => {
    switch (category) {
        case 'credential': return 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
        case 'project': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
        case 'personal': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
        case 'temporary': return 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
        case 'note': return 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
        default: return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
    }
}
</script>

<style scoped>
.animate-pulse-slow {
    animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: .7; }
}
</style>
