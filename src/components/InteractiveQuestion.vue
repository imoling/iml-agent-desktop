<script setup lang="ts">
import { ref } from 'vue'
import { useChatStore } from '../stores/chat'

const chatStore = useChatStore()

interface Option {
  value: string
  label: string
  description?: string
  icon?: any
}

const props = defineProps<{
  question: string
  options: Option[]
}>()

const emit = defineEmits<{
  (e: 'select', value: string, label: string): void
  (e: 'skip'): void
}>()

function selectOption(opt: Option) {
  if (chatStore.isStreaming) return
  emit('select', opt.value, opt.label)
}
</script>

<template>
  <div class="bg-black/40 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-white/10 w-full my-6 text-gray-200 animate-fade-in-up ring-1 ring-white/5">
    <!-- Question -->
    <h3 class="text-lg font-bold mb-6 text-white flex items-center gap-2">
      <span class="w-1 h-6 bg-indigo-500 rounded-full"></span>
      {{ question }}
    </h3>

    <!-- Options -->
    <!-- Options -->
    <!-- Options -->
    <div class="flex flex-col gap-2">
      <button 
        v-for="(opt, idx) in options" 
        :key="opt.value"
        @click="selectOption(opt)"
        :disabled="chatStore.isStreaming"
        class="w-full text-left group relative bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 rounded-xl p-3 transition-all duration-200 overflow-hidden flex items-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <!-- Icon / Number -->
        <div v-if="opt.icon" class="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center border border-white/5 shadow-inner shrink-0 group-hover:scale-110 transition-transform">
            <component :is="opt.icon" class="w-4 h-4 text-indigo-400" />
        </div>
        <div v-else class="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/5">
             <span class="font-mono font-bold text-gray-400 text-[10px]">{{ idx + 1 }}</span>
        </div>

        <!-- Text Content -->
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
                <h3 class="font-bold text-gray-200 text-sm leading-snug whitespace-normal break-words">
                   {{ opt.label }}
                </h3>
                <span class="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/20 font-mono hidden sm:inline-block" v-if="opt.value.startsWith('skill:')">
                   {{ opt.value.replace('skill:', '') }}
                </span>
            </div>
            
            <p v-if="opt.description" class="text-xs text-gray-500 mt-0.5 truncate group-hover:text-gray-400 transition-colors">
                {{ opt.description }}
            </p>
        </div>

        <!-- Arrow (Hover) -->
        <div class="w-4 h-4 text-gray-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all mr-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-full h-full">
                <path fill-rule="evenodd" d="M12.97 3.97a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 11-1.06-1.06l6.22-6.22H3a.75.75 0 010-1.5h16.19l-6.22-6.22a.75.75 0 010-1.06z" clip-rule="evenodd" />
            </svg>
        </div>
      </button>
    </div>

    <!-- Footer / Skip Action -->
    <div class="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
        <span class="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{{ $t('question.selectOption') }}</span>
        
        <button 
          @click="$emit('skip')"
          class="text-xs text-gray-400 hover:text-white hover:underline transition-colors px-2 py-1 rounded"
        >
          {{ $t('question.skip') }}
        </button>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in-up {
  animation: fadeInUp 0.4s ease-out forwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
