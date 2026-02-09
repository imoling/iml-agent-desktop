<template>
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="bg-[#1a1a1f] rounded-2xl shadow-2xl w-full max-w-2xl border border-white/10 max-h-[90vh] overflow-hidden flex flex-col">
            <!-- Header -->
            <div class="flex items-center justify-between p-6 border-b border-white/10">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <Pin class="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-white">{{ isEdit ? '编辑记忆' : '添加记忆' }}</h2>
                        <p class="text-sm text-gray-400">{{ isEdit ? '修改记忆内容和设置' : '保存为长期记忆' }}</p>
                    </div>
                </div>
                <button
                    @click="handleClose"
                    class="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                    <X class="w-5 h-5" />
                </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
                <!-- Content Editor -->
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">
                        记忆内容 *
                    </label>
                    <textarea
                        v-model="formData.content"
                        class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:bg-black/40 transition-all resize-none"
                        rows="4"
                        placeholder="输入要记住的内容..."
                        required
                    />
                </div>

                <!-- Category Selector -->
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">
                        分类
                    </label>
                    <div class="grid grid-cols-5 gap-2">
                        <button
                            v-for="cat in categories"
                            :key="cat.value"
                            @click="formData.category = cat.value"
                            :class="[
                                'px-3 py-2 rounded-lg text-xs font-medium transition-all',
                                formData.category === cat.value
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            ]"
                        >
                            <component :is="cat.icon" class="w-4 h-4 mx-auto mb-1" />
                            {{ cat.label }}
                        </button>
                    </div>
                    <p v-if="suggestedCategory && suggestedCategory !== formData.category" class="mt-2 text-xs text-gray-400">
                        💡 建议分类：<button @click="formData.category = suggestedCategory" class="text-indigo-400 hover:underline">{{ getCategoryLabel(suggestedCategory) }}</button>
                    </p>
                </div>

                <!-- Priority Selector -->
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">
                        优先级
                    </label>
                    <div class="flex gap-2">
                        <button
                            v-for="priority in priorities"
                            :key="priority.value"
                            @click="formData.priority = priority.value"
                            :class="[
                                'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                formData.priority === priority.value
                                    ? priority.activeClass
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            ]"
                        >
                            {{ priority.label }}
                        </button>
                    </div>
                </div>

                <!-- Tags Input -->
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">
                        标签
                    </label>
                    <div class="flex flex-wrap gap-2 mb-2">
                        <span
                            v-for="(tag, index) in formData.tags"
                            :key="index"
                            class="inline-flex items-center gap-1 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg text-sm"
                        >
                            {{ tag }}
                            <button @click="removeTag(index)" class="hover:text-white transition-colors">
                                <X class="w-3 h-3" />
                            </button>
                        </span>
                    </div>
                    <div class="flex gap-2">
                        <input
                            v-model="newTag"
                            @keydown.enter.prevent="addTag"
                            class="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                            placeholder="输入标签后按回车"
                        />
                        <button
                            @click="addTag"
                            class="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 transition-colors"
                        >
                            添加
                        </button>
                    </div>
                </div>

                <!-- Encryption Toggle -->
                <div class="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div class="flex items-center gap-3">
                        <Lock class="w-5 h-5 text-gray-400" />
                        <div>
                            <p class="text-sm font-medium text-white">加密此记忆</p>
                            <p class="text-xs text-gray-400">敏感信息将自动加密</p>
                        </div>
                    </div>
                    <button
                        @click="formData.encrypted = !formData.encrypted"
                        :class="[
                            'relative w-12 h-6 rounded-full transition-colors',
                            formData.encrypted ? 'bg-indigo-500' : 'bg-white/10'
                        ]"
                    >
                        <span
                            :class="[
                                'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform',
                                formData.encrypted && 'translate-x-6'
                            ]"
                        />
                    </button>
                </div>

                <!-- Expiration -->
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">
                        过期时间（可选）
                    </label>
                    <div class="flex gap-2">
                        <button
                            v-for="exp in expirationOptions"
                            :key="exp.value"
                            @click="setExpiration(exp.value)"
                            :class="[
                                'flex-1 px-3 py-2 rounded-lg text-xs transition-all',
                                selectedExpiration === exp.value
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            ]"
                        >
                            {{ exp.label }}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between p-6 border-t border-white/10">
                <button
                    @click="handleClose"
                    class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium transition-colors"
                >
                    取消
                </button>
                <button
                    @click="handleSave"
                    :disabled="!formData.content || isLoading"
                    class="px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
                    <span>{{ isLoading ? '保存中...' : '保存记忆' }}</span>
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Pin, X, Lock, Loader2, User, FolderCode, Heart, Key, Clock } from 'lucide-vue-next'

interface Props {
    initialContent?: string
    initialMemory?: any
    isEdit?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    initialContent: '',
    isEdit: false
})

const emit = defineEmits<{
    (e: 'save', memory: any): void
    (e: 'close'): void
}>()

const formData = ref({
    content: props.initialContent || props.initialMemory?.content || '',
    category: props.initialMemory?.category || 'project',
    priority: props.initialMemory?.priority || 'medium',
    tags: props.initialMemory?.tags || [],
    encrypted: props.initialMemory?.encrypted || false,
    expiresAt: props.initialMemory?.expiresAt
})

const newTag = ref('')
const isLoading = ref(false)
const suggestedCategory = ref<string | null>(null)
const selectedExpiration = ref<string | null>(null)

const categories = [
    { value: 'personal', label: '个人', icon: User },
    { value: 'project', label: '项目', icon: FolderCode },
    { value: 'preference', label: '偏好', icon: Heart },
    { value: 'credential', label: '凭证', icon: Key },
    { value: 'temporary', label: '临时', icon: Clock }
]

const priorities = [
    { value: 'high', label: '高', activeClass: 'bg-red-500 text-white' },
    { value: 'medium', label: '中', activeClass: 'bg-yellow-500 text-white' },
    { value: 'low', label: '低', activeClass: 'bg-green-500 text-white' }
]

const expirationOptions = [
    { value: 'never' as const, label: '永久' },
    { value: '1h' as const, label: '1小时' },
    { value: '1d' as const, label: '1天' },
    { value: '1w' as const, label: '1周' },
    { value: '1m' as const, label: '1个月' }
]

const getCategoryLabel = (value: string) => {
    return categories.find(c => c.value === value)?.label || value
}

const addTag = () => {
    if (newTag.value.trim() && !formData.value.tags.includes(newTag.value.trim())) {
        formData.value.tags.push(newTag.value.trim())
        newTag.value = ''
    }
}

const removeTag = (index: number) => {
    formData.value.tags.splice(index, 1)
}

const setExpiration = (value: string) => {
    selectedExpiration.value = value
    
    if (value === 'never') {
        formData.value.expiresAt = undefined
        return
    }
    
    const now = Date.now()
    const durations: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '1w': 7 * 24 * 60 * 60 * 1000,
        '1m': 30 * 24 * 60 * 60 * 1000
    }
    
    formData.value.expiresAt = now + (durations[value] || 0)
}

const handleSave = async () => {
    if (!formData.value.content) return
    
    isLoading.value = true
    
    try {
        emit('save', {
            content: formData.value.content,
            category: formData.value.category,
            priority: formData.value.priority,
            tags: formData.value.tags,
            encrypted: formData.value.encrypted,
            expiresAt: formData.value.expiresAt,
            source: 'manual'
        })
    } finally {
        isLoading.value = false
    }
}

const handleClose = () => {
    emit('close')
}

// 获取分类建议
onMounted(async () => {
    if (formData.value.content && !props.isEdit) {
        try {
            const result = await window.electron.memorySuggestCategory(formData.value.content)
            if (result.success) {
                suggestedCategory.value = result.category
            }
        } catch (error) {
            console.error('Failed to get category suggestion:', error)
        }
    }
})
</script>
