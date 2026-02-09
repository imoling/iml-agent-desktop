<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Brain, Zap, Info } from 'lucide-vue-next'

const enableSummary = ref(false)
const compressionStrategy = ref<'conservative' | 'balanced' | 'aggressive'>('balanced')

onMounted(async () => {
    const config = await window.electron.getConfig()
    if (config && config.contextManagement) {
        enableSummary.value = config.contextManagement.enableSummary
        compressionStrategy.value = config.contextManagement.compressionStrategy
    }
})

const save = async () => {
    await window.electron.setConfig('contextManagement', {
        enableSummary: enableSummary.value,
        compressionStrategy: compressionStrategy.value
    })
}

defineExpose({ save })
</script>

<template>
    <div class="p-8 space-y-8 animate-fade-in">
        <!-- Header -->
        <div class="space-y-1">
            <h2 class="text-xl font-bold flex items-center gap-2 text-white">
                <Brain class="w-5 h-5 text-indigo-400" />
                上下文管理
            </h2>
            <p class="text-sm text-gray-400">优化长对话的 token 使用</p>
        </div>

        <!-- Smart Summarization Card -->
        <div class="bg-black/20 p-5 rounded-xl border border-white/5">
            <div class="flex items-start gap-4">
                <div class="p-3 bg-indigo-500/10 rounded-lg shrink-0">
                    <Zap class="w-6 h-6 text-yellow-400" />
                </div>
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="font-bold text-white text-base">智能摘要</h3>
                        
                        <button 
                            @click="enableSummary = !enableSummary"
                            class="w-11 h-6 bg-gray-700 rounded-full relative transition-colors duration-200 focus:outline-none"
                            :class="enableSummary ? 'bg-indigo-600' : 'bg-gray-700'"
                        >
                            <div 
                                class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm"
                                :class="enableSummary ? 'translate-x-5' : 'translate-x-0'"
                            ></div>
                        </button>
                    </div>
                    <p class="text-sm text-gray-400 leading-relaxed">
                        使用 AI 自动总结旧对话，保留关键信息的同时节省 tokens
                    </p>
                    
                    <!-- Info Box -->
                    <div v-if="!enableSummary" class="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mt-3">
                        <Info class="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                        <p class="text-xs text-blue-300">
                            当前使用 P1 智能压缩（基于优先级）。启用智能摘要可以保留更长的对话历史。
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Compression Strategy Card -->
        <div class="bg-black/20 p-5 rounded-xl border border-white/5">
            <div class="flex items-start gap-4">
                <div class="p-3 bg-indigo-500/10 rounded-lg shrink-0">
                    <span class="text-xl">⚙️</span>
                </div>
                <div class="flex-1">
                    <h3 class="font-bold text-white text-base mb-3">压缩策略</h3>
                    
                    <div class="grid grid-cols-3 gap-3 mb-2">
                        <button
                            @click="compressionStrategy = 'conservative'"
                            class="px-4 py-3 rounded-lg border text-sm font-medium transition-all flex flex-col items-center justify-center gap-1"
                            :class="compressionStrategy === 'conservative' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-black/30 border-white/10 text-gray-400 hover:bg-white/5'"
                        >
                            <span class="w-2 h-2 rounded-full bg-green-400" v-if="compressionStrategy === 'conservative'"></span>
                            <div>保守</div>
                            <div class="text-xs opacity-70">保留 90%</div>
                        </button>
                        <button
                            @click="compressionStrategy = 'balanced'"
                            class="px-4 py-3 rounded-lg border text-sm font-medium transition-all flex flex-col items-center justify-center gap-1"
                            :class="compressionStrategy === 'balanced' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-black/30 border-white/10 text-gray-400 hover:bg-white/5'"
                        >
                            <span class="w-2 h-2 rounded-full bg-green-400" v-if="compressionStrategy === 'balanced'"></span>
                            <div>平衡</div>
                            <div class="text-xs opacity-70">保留 75%</div>
                        </button>
                        <button
                            @click="compressionStrategy = 'aggressive'"
                            class="px-4 py-3 rounded-lg border text-sm font-medium transition-all flex flex-col items-center justify-center gap-1"
                            :class="compressionStrategy === 'aggressive' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-black/30 border-white/10 text-gray-400 hover:bg-white/5'"
                        >
                            <span class="w-2 h-2 rounded-full bg-green-400" v-if="compressionStrategy === 'aggressive'"></span>
                            <div>激进</div>
                            <div class="text-xs opacity-70">保留 60%</div>
                        </button>
                    </div>
                    <p class="text-sm text-gray-400 leading-relaxed">
                        更激进的策略会删除更多消息，但可能丢失一些上下文
                    </p>
                </div>
            </div>
        </div>

        <!-- How it Works Card -->
        <div class="bg-black/20 p-5 rounded-xl border border-white/5">
            <div class="flex items-start gap-4">
                <div class="p-3 bg-indigo-500/10 rounded-lg shrink-0">
                    <Info class="w-6 h-6 text-indigo-400" />
                </div>
                <div class="flex-1">
                    <h3 class="font-bold text-white text-base mb-3">工作原理</h3>
                    <ul class="text-sm text-gray-400 space-y-2 leading-relaxed">
                        <li class="flex items-start gap-2">
                            <span class="text-indigo-400 mt-0.5">•</span>
                            <span>自动监测 token 使用情况</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-indigo-400 mt-0.5">•</span>
                            <span>超过限制时自动压缩对话历史</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-indigo-400 mt-0.5">•</span>
                            <span>优先保留用户消息和工具调用</span>
                        </li>
                        <li v-if="enableSummary" class="flex items-start gap-2">
                            <span class="text-yellow-400 mt-0.5">•</span>
                            <span>使用 AI 生成旧对话摘要</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
