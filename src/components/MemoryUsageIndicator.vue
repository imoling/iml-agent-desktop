<template>
    <div class="memory-usage-indicator bg-black/10 rounded-xl border border-white/5 overflow-hidden my-3">
        <!-- Header -->
        <button
            @click="isExpanded = !isExpanded"
            class="w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/5 transition-colors group"
        >
            <div class="flex items-center gap-2">
                <BrainCircuit class="w-4 h-4 text-indigo-400" />
                <span class="text-sm font-medium text-indigo-300">
                    使用了 {{ memoryUsage.length }} 条记忆
                </span>
            </div>
            <ChevronDown 
                :class="['w-4 h-4 text-gray-400 transition-transform', isExpanded && 'rotate-180']" 
            />
        </button>

        <!-- Memory List -->
        <Transition
            enter-active-class="transition-all duration-200"
            enter-from-class="max-h-0 opacity-0"
            enter-to-class="max-h-[500px] opacity-100"
            leave-active-class="transition-all duration-200"
            leave-from-class="max-h-[500px] opacity-100"
            leave-to-class="max-h-0 opacity-0"
        >
            <div v-if="isExpanded" class="border-t border-white/5">
                <div class="p-3 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                    <div
                        v-for="(usage, index) in sortedMemoryUsage"
                        :key="index"
                        class="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors cursor-pointer group"
                        @click="handleMemoryClick(usage)"
                    >
                        <!-- Header -->
                        <div class="flex items-start justify-between gap-2 mb-2">
                            <div class="flex items-center gap-2">
                                <component 
                                    :is="getCategoryIcon(usage.memory.category)" 
                                    class="w-4 h-4 text-gray-400 shrink-0"
                                />
                                <span class="text-xs font-medium text-gray-300">
                                    {{ getCategoryLabel(usage.memory.category) }}
                                </span>
                                <Lock v-if="usage.memory.encrypted" class="w-3 h-3 text-yellow-400" />
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-xs text-gray-400">
                                    相关度: {{ Math.round(usage.relevanceScore * 100) }}%
                                </span>
                            </div>
                        </div>

                        <!-- Relevance Bar -->
                        <div class="w-full h-1 bg-black/30 rounded-full mb-2 overflow-hidden">
                            <div 
                                class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                                :style="{ width: `${usage.relevanceScore * 100}%` }"
                            />
                        </div>

                        <!-- Content Preview -->
                        <div class="text-sm text-gray-300 line-clamp-2">
                            {{ getContentPreview(usage.memory) }}
                        </div>

                        <!-- Tags -->
                        <div v-if="usage.memory.tags.length > 0" class="flex flex-wrap gap-1 mt-2">
                            <span
                                v-for="tag in usage.memory.tags.slice(0, 3)"
                                :key="tag"
                                class="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-xs"
                            >
                                {{ tag }}
                            </span>
                            <span v-if="usage.memory.tags.length > 3" class="text-xs text-gray-500">
                                +{{ usage.memory.tags.length - 3 }}
                            </span>
                        </div>

                        <!-- Priority Badge -->
                        <div class="mt-2 flex items-center gap-2">
                            <span
                                :class="[
                                    'px-2 py-0.5 rounded text-xs font-medium',
                                    getPriorityClass(usage.memory.priority)
                                ]"
                            >
                                {{ getPriorityLabel(usage.memory.priority) }}
                            </span>
                            <span class="text-xs text-gray-500">
                                {{ formatDate(usage.memory.createdAt) }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- Memory Detail Dialog -->
        <Teleport to="body">
            <div
                v-if="selectedMemory"
                class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                @click.self="selectedMemory = null"
            >
                <div class="bg-[#1a1a1f] rounded-2xl shadow-2xl w-full max-w-2xl border border-white/10 p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-bold text-white">记忆详情</h3>
                        <button
                            @click="selectedMemory = null"
                            class="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                            <X class="w-5 h-5" />
                        </button>
                    </div>

                    <div class="space-y-4">
                        <!-- Category & Priority -->
                        <div class="flex items-center gap-3">
                            <component 
                                :is="getCategoryIcon(selectedMemory.category)" 
                                class="w-5 h-5 text-gray-400"
                            />
                            <span class="text-sm text-gray-300">
                                {{ getCategoryLabel(selectedMemory.category) }}
                            </span>
                            <span
                                :class="[
                                    'px-2 py-1 rounded text-xs font-medium',
                                    getPriorityClass(selectedMemory.priority)
                                ]"
                            >
                                {{ getPriorityLabel(selectedMemory.priority) }}
                            </span>
                            <Lock v-if="selectedMemory.encrypted" class="w-4 h-4 text-yellow-400" />
                        </div>

                        <!-- Content -->
                        <div class="bg-black/20 rounded-lg p-4">
                            <p class="text-sm text-gray-300 whitespace-pre-wrap">
                                {{ decryptedContent || selectedMemory.content }}
                            </p>
                        </div>

                        <!-- Tags -->
                        <div v-if="selectedMemory.tags.length > 0" class="flex flex-wrap gap-2">
                            <span
                                v-for="tag in selectedMemory.tags"
                                :key="tag"
                                class="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg text-sm"
                            >
                                {{ tag }}
                            </span>
                        </div>

                        <!-- Metadata -->
                        <div class="text-xs text-gray-500 space-y-1">
                            <p>创建时间: {{ formatDate(selectedMemory.createdAt) }}</p>
                            <p v-if="selectedMemory.expiresAt">
                                过期时间: {{ formatDate(selectedMemory.expiresAt) }}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { BrainCircuit, ChevronDown, Lock, X, User, FolderCode, Heart, Key, Clock } from 'lucide-vue-next'

interface MemoryUsage {
    memory: any
    relevanceScore: number
    usedAt: number
}

interface Props {
    memoryUsage: MemoryUsage[]
}

const props = defineProps<Props>()

const isExpanded = ref(false)
const selectedMemory = ref<any>(null)
const decryptedContent = ref<string | null>(null)

const sortedMemoryUsage = computed(() => {
    return [...props.memoryUsage].sort((a, b) => b.relevanceScore - a.relevanceScore)
})

const categoryIcons: Record<string, any> = {
    personal: User,
    project: FolderCode,
    preference: Heart,
    credential: Key,
    temporary: Clock
}

const categoryLabels: Record<string, string> = {
    personal: '个人',
    project: '项目',
    preference: '偏好',
    credential: '凭证',
    temporary: '临时'
}

const getCategoryIcon = (category: string) => {
    return categoryIcons[category] || FolderCode
}

const getCategoryLabel = (category: string) => {
    return categoryLabels[category] || category
}

const getPriorityClass = (priority: string) => {
    const classes: Record<string, string> = {
        high: 'bg-red-500/20 text-red-300',
        medium: 'bg-yellow-500/20 text-yellow-300',
        low: 'bg-green-500/20 text-green-300'
    }
    return classes[priority] || classes.medium
}

const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
        high: '高优先级',
        medium: '中优先级',
        low: '低优先级'
    }
    return labels[priority] || priority
}

const getContentPreview = (memory: any) => {
    if (memory.encrypted) {
        return '🔒 加密记忆（点击查看）'
    }
    return memory.content.length > 100 
        ? memory.content.substring(0, 100) + '...' 
        : memory.content
}

const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    
    return date.toLocaleDateString('zh-CN')
}

const handleMemoryClick = async (usage: MemoryUsage) => {
    selectedMemory.value = usage.memory
    decryptedContent.value = null
    
    // 如果是加密记忆，尝试解密
    if (usage.memory.encrypted) {
        try {
            const result = await window.electron.memoryDecrypt(usage.memory)
            if (result.success) {
                decryptedContent.value = result.content
            }
        } catch (error) {
            console.error('Failed to decrypt memory:', error)
        }
    }
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
}

.line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>
