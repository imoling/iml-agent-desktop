<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ShieldAlert, Check, X, Terminal } from 'lucide-vue-next'

const isOpen = ref(false)
const currentRequest = ref<{ requestId: string; permission: string; context?: any } | null>(null)

let unsub: (() => void) | null = null

onMounted(() => {
    if (window.electron && window.electron.onPermissionRequest) {
        unsub = window.electron.onPermissionRequest((request) => {
            currentRequest.value = request
            isOpen.value = true
        })
    }
})

onUnmounted(() => {
    if (unsub) unsub()
})

const handleResponse = (allow: boolean, options?: { persist?: boolean }) => {
    if (currentRequest.value && window.electron) {
        window.electron.resolvePermissionRequest(currentRequest.value.requestId, allow, options)
    }
    isOpen.value = false
    currentRequest.value = null
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
    <div class="w-full max-w-lg bg-[#16161a] border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-red-500/20">
      
      <!-- Header -->
      <div class="flex items-center gap-3 px-6 py-4 border-b border-white/5 bg-red-500/5">
        <div class="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <ShieldAlert class="w-5 h-5 text-red-400" />
        </div>
        <div>
            <h2 class="text-lg font-semibold text-white">Permission Request</h2>
            <p class="text-xs text-gray-400">The Agent is requesting elevated privileges.</p>
        </div>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-4">
          
          <div class="space-y-1">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Permission Type</label>
              <div class="text-sm font-mono text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded w-max border border-indigo-500/20">
                  {{ currentRequest?.permission }}
              </div>
          </div>

          <div v-if="currentRequest?.context" class="space-y-2">
               <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Details</label>
               <div class="bg-black/30 rounded-lg p-3 border border-white/5 font-mono text-xs text-gray-300 max-h-40 overflow-y-auto">
                   <div v-if="typeof currentRequest.context === 'string'">{{ currentRequest.context }}</div>
                   <pre v-else>{{ JSON.stringify(currentRequest.context, null, 2) }}</pre>
               </div>
          </div>

          <p class="text-sm text-gray-400">
              Allowing this action grants the Agent access to system resources. 
              Only approve if you understand what it will do.
          </p>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 bg-white/5 border-t border-white/5 flex justify-end gap-3">
        <button 
          @click="handleResponse(false)"
          class="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-xl transition-all border border-red-500/20 hover:border-red-500/40"
        >
          <X class="w-4 h-4" />
          Deny
        </button>
        
        <!-- Allow Session (Persist) -->
         <button 
          v-if="currentRequest?.context?.tool"
          @click="handleResponse(true, { persist: true })"
          class="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-xl transition-all border border-emerald-500/20 hover:border-emerald-500/40"
          :title="$t('permission.allowSessionTooltip', 'Allow all checks for this tool in this session')"
        >
          <Check class="w-4 h-4" />
          Allow Session
        </button>

        <button 
          @click="handleResponse(true)"
          class="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/20"
        >
          <Check class="w-4 h-4" />
          Allow Once
        </button>
      </div>

    </div>
  </div>
</template>
