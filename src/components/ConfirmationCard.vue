<script setup lang="ts">
import { ShieldAlert, Check, X } from 'lucide-vue-next'

defineProps<{
  toolName: string
  args: any
}>()

defineEmits(['approve', 'deny'])
</script>

<template>
  <div class="my-4 bg-[#1e1e24] border border-orange-500/30 rounded-xl overflow-hidden shadow-lg animate-in fade-in slide-in-from-bottom-2">
    <!-- Header -->
    <div class="px-4 py-3 bg-orange-500/10 border-b border-orange-500/10 flex items-center gap-2">
       <ShieldAlert class="w-5 h-5 text-orange-400" />
       <h3 class="text-sm font-semibold text-orange-200">Safe Mode Confirmation</h3>
    </div>

    <!-- Content -->
    <div class="p-4 space-y-3">
        <p class="text-sm text-gray-300">
            The agent is requesting to execute a sensitive operation:
        </p>
        
        <div class="bg-black/30 rounded-lg p-3 font-mono text-xs text-gray-300 border border-white/5 overflow-x-auto">
            <div class="text-indigo-400 font-bold mb-1">{{ toolName }}</div>
            <pre class="whitespace-pre-wrap">{{ JSON.stringify(args, null, 2) }}</pre>
        </div>
    </div>

    <!-- Actions -->
    <div class="px-4 py-3 bg-black/20 flex justify-end gap-3">
        <button 
            @click="$emit('deny')"
            class="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2"
        >
            <X class="w-4 h-4" />
            Deny
        </button>
        <button 
            @click="$emit('approve')"
            class="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2"
        >
            <Check class="w-4 h-4" />
            Approve
        </button>
    </div>
  </div>
</template>
