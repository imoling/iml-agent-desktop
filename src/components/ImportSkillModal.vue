<script setup lang="ts">
import { ref } from 'vue'
import { X, Download, Github } from 'lucide-vue-next'
import { useSkillsStore } from '../stores/skills'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits(['close', 'success'])

const skillsStore = useSkillsStore()
const url = ref('')
const loading = ref(false)
const error = ref('')

const handleImport = async () => {
    if (!url.value) return
    
    loading.value = true
    error.value = ''
    
    try {
        const result = await window.electron.importSkill(url.value)
        if (result.success) {
            emit('success', result.skillId)
            emit('close')
            url.value = ''
            await skillsStore.fetchSkills()
        } else {
            error.value = result.error || 'Import failed'
        }
    } catch (e: any) {
        error.value = e.message || 'Unknown error'
    } finally {
        loading.value = false
    }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div class="w-full max-w-md bg-[#16161a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
        <h2 class="text-lg font-semibold text-white flex items-center gap-2">
            <Download class="w-5 h-5 text-indigo-400" />
            {{ $t('skills.importSkill') }}
        </h2>
        <button @click="$emit('close')" class="text-gray-400 hover:text-white transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-4">
          
          <div class="space-y-2">
              <label class="text-sm font-medium text-gray-300">{{ $t('skills.githubUrl') }}</label>
              <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Github class="w-4 h-4 text-gray-500" />
                  </div>
                  <input 
                    v-model="url"
                    type="text" 
                    placeholder="https://github.com/username/repo OR .../tree/main/path/to/skill"
                    class="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-gray-600"
                    @keyup.enter="handleImport"
                  />
              </div>
              <p class="text-xs text-gray-500">
                  {{ $t('skills.importDesc') }}
              </p>
          </div>

          <!-- Error Alert -->
          <div v-if="error" class="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-start gap-2">
               <span>⚠️ {{ error }}</span>
          </div>

      </div>

      <!-- Footer -->
      <div class="px-6 py-4 bg-white/5 border-t border-white/5 flex justify-end gap-3">
        <button 
          @click="$emit('close')"
          class="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
        >
          {{ $t('builder.cancel') }}
        </button>
        <button 
          @click="handleImport"
          :disabled="loading || !url"
          class="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-wait"
        >
          <Download class="w-4 h-4" v-if="!loading"/>
          <div v-else class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          {{ loading ? 'Importing...' : $t('skills.import') }}
        </button>
      </div>

    </div>
  </div>
</template>
