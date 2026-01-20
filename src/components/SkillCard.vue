<script setup lang="ts">
import { computed } from 'vue'
import { Zap, Loader2, MoreVertical, Trash2, MessageSquare } from 'lucide-vue-next'
import type { Skill } from '../types'

const props = defineProps<{
  skill: Skill
  executing?: boolean
}>()

const emit = defineEmits<{
  (e: 'edit', id: string): void
  (e: 'delete', id: string): void
}>()
</script>


<template>
  <div 
    class="group relative bg-[#1c1c21]/80 border border-white/5 hover:border-indigo-500/30 rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:shadow-black/50 overflow-hidden flex flex-col h-[220px]"
    :class="executing ? 'opacity-80 scale-95' : ''"
  >
     <!-- Card Header -->
     <div class="flex items-start justify-between mb-4">
         <div class="flex items-center gap-3">
             <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border border-white/5 shadow-inner shrink-0">
                 <Zap class="w-5 h-5 text-indigo-400" />
             </div>
             <div class="overflow-hidden">
                 <h3 class="font-bold text-white leading-tight truncate max-w-[150px]" :title="skill.displayName || skill.name">
                    {{ skill.displayName || skill.name }}
                 </h3>
                 <span class="text-xs text-gray-500 font-mono truncate block" :title="skill.name">
                    {{ skill.name }}
                 </span>
             </div>
         </div>
         
         <div class="relative z-10 -mr-2">
              <button 
                @click.stop="emit('edit', skill.id)"
                class="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Edit Skill"
              >
                 <MoreVertical class="w-4 h-4" />
              </button>
         </div>
     </div>

     <!-- Body -->
     <!-- Body -->
     <p class="text-sm text-gray-400 line-clamp-3 leading-relaxed mb-4">
        {{ skill.description }}
     </p>
     
     <!-- Footer -->
     <div class="flex items-center justify-between mt-auto h-6">
         <!-- In Chat Badge -->
         <div v-if="skill.defaultInChat !== false" class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-400">
             <MessageSquare class="w-3 h-3" />
             <span>{{ $t('skills.inChat') }}</span>
         </div>
         <div v-else></div> <!-- Spacer -->

         <!-- Delete -->
         <button 
            @click.stop="emit('delete', skill.id)"
            class="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
            title="Delete Skill"
         >
             <Trash2 class="w-4 h-4" />
         </button>
     </div>
      
     <div v-if="executing" class="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
      <Loader2 class="w-8 h-8 animate-spin text-white" />
     </div>
  </div>
</template>
