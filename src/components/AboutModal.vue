<script setup lang="ts">
import { X, Globe } from 'lucide-vue-next'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="$emit('close')">
    
    <!-- Modal Content -->
    <div class="about-modal-content relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <!-- Header -->
        <div class="px-6 py-4 flex items-center justify-between" style="border-bottom: 1px solid var(--border-color); background-color: var(--bg-hover);">
            <h3 class="text-lg font-semibold" style="color: var(--text-primary)">{{ $t('about.title') }}</h3>
            <button @click="$emit('close')" class="transition-colors" style="color: var(--text-muted);" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-muted)'">
                <X class="w-5 h-5" />
            </button>
        </div>

        <!-- Body -->
        <div class="p-8 flex flex-col items-center text-center">
            
            <!-- Logo -->
            <!-- Logo -->
            <div class="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex flex-col items-center justify-center text-white mb-6 shadow-xl shadow-indigo-500/20 leading-none gap-1">
               <span class="font-black text-2xl tracking-tight">iML</span>
               <span class="font-bold text-[10px] opacity-80 uppercase tracking-wider">Agent</span>
            </div>
            
            <h2 class="text-2xl font-bold mb-2" style="color: var(--text-primary)">{{ $t('about.appName') }}</h2>
            
            <!-- Slogan -->
            <div class="text-sm font-medium mb-4 tracking-wide uppercase font-mono px-3 py-1 rounded-lg border" style="color: var(--accent-primary); background-color: rgba(99, 102, 241, 0.1); border-color: rgba(99, 102, 241, 0.2);">
                {{ $t('about.slogan') }}
            </div>

            <div class="text-sm font-mono mb-6 px-3 py-1 rounded-full border" style="color: var(--text-secondary); background-color: var(--bg-hover); border-color: var(--border-color);">
                {{ $t('about.version') }}: {{ $t('about.versionNumber') }}
            </div>
            
            <p class="leading-relaxed mb-8 text-left indent-8" style="color: var(--text-secondary)">
                {{ $t('about.description') }}
            </p>

            <!-- Feature Tags -->
            <div class="flex flex-wrap justify-center gap-3 mb-8">
                <span 
                    v-for="(tag, index) in ($tm('about.features') as string[])" 
                    :key="index"
                    class="px-3 py-1 text-xs font-medium rounded-lg border"
                    style="color: var(--accent-primary); background-color: rgba(99, 102, 241, 0.1); border-color: rgba(99, 102, 241, 0.2);"
                >
                    {{ tag }}
                </span>
            </div>
            
            <div class="w-full h-px mb-6" style="background-color: var(--border-color)"></div>
            
            <div class="flex flex-col gap-1 text-xs" style="color: var(--text-muted)">
                <p>{{ $t('about.copyright') }}</p>
                <div class="flex items-center justify-center gap-2 mt-2">
                     <a href="#" class="transition-colors flex items-center gap-1 hover:text-indigo-400">
                        <Globe class="w-3 h-3" />
                         Website
                     </a>
                     <span>•</span>
                     <a href="#" class="transition-colors hover:text-indigo-400">Github</a>
                </div>
            </div>

        </div>

        <!-- Footer -->
        <div class="px-6 py-4 flex justify-center" style="background-color: rgba(0, 0, 0, 0.1);">
             <button 
                @click="$emit('close')"
                class="px-6 py-2 text-sm font-medium rounded-xl transition-all border"
                style="background-color: var(--bg-hover); color: var(--text-primary); border-color: var(--border-color);"
            >
                {{ $t('builder.close') || 'Close' }}
            </button>
        </div>
    </div>
  </div>
</template>

<style scoped>
/* Dark mode (default) */
.about-modal-content {
    background-color: rgba(22, 22, 26, 0.95);
    border-color: rgba(255, 255, 255, 0.1);
}

/* Light mode */
:global(.light) .about-modal-content {
    background-color: #ffffff;
    border-color: rgba(0, 0, 0, 0.1);
}
</style>
