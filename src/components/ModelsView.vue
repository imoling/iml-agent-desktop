<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Plus, Trash2, Cpu, Globe, Key, Save, CheckCircle2, Zap, MoreVertical, X } from 'lucide-vue-next'
import { v4 as uuidv4 } from 'uuid'

interface ModelProfile {
    id: string;
    name: string;
    provider: 'anthropic' | 'openai';
    model: string;
    apiKey: string;
    baseURL?: string;
}

const profiles = ref<ModelProfile[]>([])
const activeProfileId = ref('')
const loading = ref(false)

// Edit/Create State
const showEditModal = ref(false)
const editingProfile = ref<ModelProfile | null>(null)
const isEditingNew = ref(false)

onMounted(() => {
    fetchConfig()
})

const fetchConfig = async () => {
  if (window.electron && window.electron.getConfig) {
    const config = await window.electron.getConfig()
    if (config) {
       // Load Profiles
      if (config.profiles && config.profiles.length > 0) {
          // Deep copy to avoid reference issues
          profiles.value = JSON.parse(JSON.stringify(config.profiles)) 
          activeProfileId.value = config.activeProfileId || profiles.value[0].id
      } else {
          profiles.value = []
      }
    }
  }
}

const saveProfiles = async () => {
    loading.value = true
    try {
        if (window.electron && window.electron.setConfig) {
             await window.electron.setConfig('profiles', JSON.parse(JSON.stringify(profiles.value)))
             await window.electron.setConfig('activeProfileId', activeProfileId.value)
        }
    } catch (e) {
        console.error(e)
    } finally {
        loading.value = false
    }
}

const openCreateProfile = () => {
    isEditingNew.value = true
    editingProfile.value = {
        id: uuidv4(),
        name: 'New Profile',
        provider: 'openai',
        model: 'deepseek-chat',
        apiKey: '',
        baseURL: 'https://api.deepseek.com/v1'
    }
    showEditModal.value = true
}

const openEditProfile = (profile: ModelProfile) => {
    isEditingNew.value = false
    // Deep copy for editing
    editingProfile.value = JSON.parse(JSON.stringify(profile))
    showEditModal.value = true
}

const confirmSaveProfile = async () => {
    if (!editingProfile.value) return
    
    if (isEditingNew) {
        profiles.value.push(editingProfile.value)
        // If first profile, auto-set active
        if (profiles.value.length === 1) {
            activeProfileId.value = editingProfile.value.id
        }
    } else {
        const index = profiles.value.findIndex(p => p.id === editingProfile.value!.id)
        if (index !== -1) {
            profiles.value[index] = editingProfile.value
        }
    }
    
    await saveProfiles()
    showEditModal.value = false
}

const deleteProfile = async (id: string) => {
    if (profiles.value.length <= 1) {
        // Prevent deleting last one maybe? Or allow empty
        // logic: if deleting active, switch active first
    }
    
    const index = profiles.value.findIndex(p => p.id === id)
    if (index !== -1) {
        profiles.value.splice(index, 1)
        
        if (activeProfileId.value === id) {
            // Pick another one if exists
            if (profiles.value.length > 0) {
                activeProfileId.value = profiles.value[0].id
            } else {
                activeProfileId.value = ''
            }
        }
        await saveProfiles()
    }
}

const setActive = async (id: string) => {
    activeProfileId.value = id
    await saveProfiles()
}
</script>

<template>
  <div class="h-full flex flex-col bg-gray-900 text-white">
      
      <!-- Header -->
      <div class="h-16 px-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-gray-900/50 backdrop-blur-xl">
          <div class="flex items-center gap-3">
              <div class="p-2 bg-indigo-500/10 rounded-lg">
                  <Cpu class="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                  <h2 class="text-lg font-medium text-white">{{ $t('models.title') }}</h2>
                  <p class="text-xs text-gray-400">{{ $t('models.subtitle') }}</p>
              </div>
          </div>
          
          <button 
            @click="openCreateProfile"
            class="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
          >
              <Plus class="w-4 h-4" />
              <span>{{ $t('models.addModel') }}</span>
          </button>
      </div>

      <!-- Content (Scrollable) -->
      <div class="flex-1 overflow-y-auto p-4">
          
          <!-- Grid -->
          <div v-if="profiles.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div 
            v-for="profile in profiles" 
            :key="profile.id"
            class="group relative bg-[#1c1c21]/80 border border-white/5 hover:border-indigo-500/30 rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:shadow-black/50 overflow-hidden"
          >
             <!-- Card Header -->
             <div class="flex items-start justify-between mb-4">
                 <div class="flex items-center gap-3">
                     <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border border-white/5 shadow-inner">
                         <Cpu v-if="profile.provider === 'openai'" class="w-5 h-5 text-emerald-400" />
                         <Cpu v-else class="w-5 h-5 text-amber-400" />
                     </div>
                     <div>
                         <h3 class="font-bold text-white leading-tight truncate max-w-[150px]">{{ profile.name }}</h3>
                          <span class="text-xs text-gray-500 capitalize">{{ profile.provider === 'openai' ? $t('models.openaiCompatible') : $t('models.anthropic') }}</span>
                     </div>
                 </div>
                 
                 <div class="relative z-10">
                      <button 
                        @click="openEditProfile(profile)"
                        class="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      >
                         <MoreVertical class="w-4 h-4" />
                      </button>
                 </div>
             </div>
             
             <!-- Model Badge -->
             <div class="mb-6">
                 <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-xs font-mono text-gray-300">
                     <Zap class="w-3 h-3 text-indigo-400" />
                     {{ profile.model }}
                 </div>
             </div>

             <!-- Footer / Active State -->
             <div class="flex items-center justify-between mt-auto">
                 <button 
                    v-if="activeProfileId !== profile.id"
                    @click="setActive(profile.id)"
                    class="text-xs font-medium text-gray-500 hover:text-emerald-400 transition-colors flex items-center gap-1 group/btn"
                 >
                    <div class="w-3 h-3 rounded-full border border-gray-600 group-hover/btn:border-emerald-500"></div>
                    {{ $t('models.setActive') }}
                 </button>
                 <div v-else class="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                     <CheckCircle2 class="w-3.5 h-3.5" />
                      {{ $t('models.active') }}
                  </div>

                 <!-- Delete (only if > 1) -->
                 <button 
                    v-if="profiles.length > 1 && !isEditingNew"
                    @click="deleteProfile(profile.id)"
                    class="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete"
                 >
                     <Trash2 class="w-4 h-4" />
                 </button>
             </div>
             
             <!-- Active Glow Effect -->
             <div v-if="activeProfileId === profile.id" class="absolute inset-0 border-2 border-emerald-500/20 rounded-2xl pointer-events-none"></div>
             <div v-if="activeProfileId === profile.id" class="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none"></div>

          </div>
      </div>
      
      <!-- Empty State -->
      <div v-else class="flex flex-col items-center justify-center py-20 text-gray-500 border border-dashed border-white/10 rounded-2xl">
          <Cpu class="w-12 h-12 mb-4 opacity-50" />
          <p>{{ $t('models.noProfiles') }}</p>
          <button @click="openCreateProfile" class="mt-4 text-indigo-400 hover:text-indigo-300 underline">{{ $t('models.createOne') }}</button>
      </div>

    
  </div>
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div class="w-full max-w-lg bg-[#16161a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div class="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                <h3 class="font-bold text-white">{{ isEditingNew ? $t('models.createProfile') : $t('models.editProfile') }}</h3>
                <button @click="showEditModal = false" class="text-gray-400 hover:text-white"><X class="w-5 h-5"/></button>
            </div>
            
            <div v-if="editingProfile" class="p-6 space-y-6 overflow-y-auto">
                 <!-- Name -->
                <div class="space-y-2">
                    <label class="text-sm font-medium text-gray-300">{{ $t('models.profileName') }}</label>
                    <input v-model="editingProfile.name" type="text" class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50" :placeholder="$t('models.profilePlaceholder')" />
                </div>

                <!-- Provider -->
                <div class="space-y-2">
                    <label class="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <Cpu class="w-4 h-4" /> {{ $t('models.provider') }}
                    </label>
                    <div class="relative">
                        <select v-model="editingProfile.provider" class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 appearance-none">
                            <option value="anthropic">{{ $t('models.anthropic') }}</option>
                            <option value="openai">{{ $t('models.openaiCompatible') }}</option>
                        </select>
                    </div>
                </div>
                
                 <!-- Base URL (OpenAI only) -->
                <div v-if="editingProfile.provider === 'openai'" class="space-y-2">
                    <label class="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <Globe class="w-4 h-4" /> {{ $t('models.baseUrl') }}
                    </label>
                    <input v-model="editingProfile.baseURL" type="text" placeholder="https://api.deepseek.com/v1" class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                </div>

                <!-- API Key -->
                <div class="space-y-2">
                    <label class="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <Key class="w-4 h-4" /> {{ $t('models.apiKey') }}
                    </label>
                    <input v-model="editingProfile.apiKey" type="password" placeholder="sk-..." class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                </div>

                <!-- Model -->
                <div class="space-y-2">
                    <label class="text-sm font-medium text-gray-300">{{ $t('models.modelName') }}</label>
                    <input v-if="editingProfile.provider === 'openai'" v-model="editingProfile.model" type="text" placeholder="e.g. deepseek-chat" class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                    <select v-else v-model="editingProfile.model" class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 appearance-none">
                        <option value="claude-3-5-sonnet-20240620">Claude 3.5 Sonnet</option>
                        <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                        <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                    </select>
                </div>
            </div>

            <div class="px-6 py-4 bg-white/5 border-t border-white/5 flex justify-end gap-3">
                <button @click="showEditModal = false" class="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white">{{ $t('models.cancel') }}</button>
                <button @click="confirmSaveProfile" :disabled="loading" class="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50">
                    <Save class="w-4 h-4" />
                    {{ loading ? $t('models.saving') : $t('models.saveProfile') }}
                </button>
            </div>
        </div>
    </div>

  </div>
</template>
