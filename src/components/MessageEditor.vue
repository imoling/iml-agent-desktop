<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { Check, X, Eye, Edit2, Copy } from 'lucide-vue-next'
import MarkdownIt from 'markdown-it'

const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'save'): void
  (e: 'cancel'): void
}>()

const mode = ref<'write' | 'preview'>('write')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const localContent = ref(props.modelValue || '')

// Markdown Parser
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

// Auto-resize logic
const adjustHeight = () => {
    if (textareaRef.value) {
        textareaRef.value.style.height = 'auto'
        textareaRef.value.style.height = (textareaRef.value.scrollHeight + 20) + 'px'
    }
}

watch(localContent, (newVal) => {
    emit('update:modelValue', newVal)
    nextTick(adjustHeight)
})

watch(() => props.modelValue, (newVal) => {
    localContent.value = newVal || ''
})

onMounted(() => {
    nextTick(adjustHeight)
})

const handlePaste = (e: ClipboardEvent) => {
    // Optional: Handle image paste later if needed
}
</script>

<template>
  <div class="flex flex-col border border-indigo-500/30 rounded-lg bg-black/40 overflow-hidden transition-all duration-300">
    <!-- Toolbar -->
    <div class="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5">
        <div class="flex items-center gap-1 bg-black/20 p-0.5 rounded-lg border border-white/5">
            <button 
                @click="mode = 'write'"
                class="px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
                :class="mode === 'write' ? 'bg-indigo-600/80 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'"
            >
                <Edit2 class="w-3.5 h-3.5" /> 编辑
            </button>
            <button 
                @click="mode = 'preview'"
                class="px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
                :class="mode === 'preview' ? 'bg-indigo-600/80 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'"
            >
                <Eye class="w-3.5 h-3.5" /> 预览
            </button>
        </div>

        <div class="flex items-center gap-2"> 
            <span class="text-[10px] text-gray-500 font-mono hidden sm:inline-block">Markdown Supported</span>
        </div>
    </div>

    <!-- Content Area -->
    <div class="relative w-full">
        <!-- Write Mode -->
        <textarea 
            v-show="mode === 'write'"
            ref="textareaRef"
            v-model="localContent" 
            class="w-full bg-transparent text-gray-200 p-4 outline-none resize-y font-mono text-sm leading-7 min-h-[200px] custom-scrollbar"
            @input="adjustHeight"
            @keydown.ctrl.enter.prevent="emit('save')"
            @keydown.meta.enter.prevent="emit('save')"
            @keydown.esc="emit('cancel')"
            placeholder="在此输入内容..."
            spellcheck="false"
        ></textarea>

        <!-- Preview Mode -->
        <div 
            v-if="mode === 'preview'"
            class="w-full p-4 markdown-content min-h-[200px] bg-black/10 overflow-y-auto max-h-[800px] custom-scrollbar"
            v-html="md.render(localContent)"
        ></div>
    </div>

    <!-- Footer Actions -->
    <div class="flex justify-between items-center px-3 py-2 border-t border-white/5 bg-white/5">
        <div class="text-[10px] text-gray-500">
            Esc 取消 • Ctrl+Enter 保存
        </div>
        <div class="flex items-center gap-2">
            <button 
                @click="emit('cancel')" 
                class="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 text-xs font-medium flex items-center gap-1 transition-colors"
            >
                <X class="w-3.5 h-3.5" /> 取消
            </button>
            <button 
                @click="emit('save')" 
                class="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 text-xs font-medium flex items-center gap-1 transition-all shadow-sm"
            >
                <Check class="w-3.5 h-3.5" /> 保存修改
            </button>
        </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
}
</style>
