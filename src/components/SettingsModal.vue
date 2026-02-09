<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { X, Shield, Globe, Save, CheckCircle2, Settings, Mic, Lock, Trash2, Plus, Moon, Sun, Monitor, Languages, Brain } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import VoiceSettings from './settings/VoiceSettings.vue'
import ContextSettings from './settings/ContextSettings.vue'
import { useAppStore } from '../stores/app'
import { storeToRefs } from 'pinia'

const emit = defineEmits(['close'])

const appStore = useAppStore()
const { settingsTab: activeTab } = storeToRefs(appStore)

const safeMode = ref(true)
const browserMode = ref('gui')
const tavilyApiKey = ref('') 
const loading = ref(false)
const saved = ref(false)
const voiceSettingsRef = ref<any>(null)
const contextSettingsRef = ref<any>(null)
const secrets = ref<string[]>([])
const newSecret = ref('')
const theme = ref<'system' | 'dark' | 'light'>('system')
const language = ref<'zh-CN' | 'en'>('zh-CN')

const { locale } = useI18n()

const visionModel = ref({
    enabled: false,
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: '',
    baseURL: ''
})

const tabs = [
    { id: 'general', label: 'settings.general.title', icon: Settings },
    { id: 'context', label: '上下文管理', icon: Brain },
    { id: 'vision', label: 'settings.vision.title', icon: Globe },
    { id: 'voice', label: 'settings.voice.title', icon: Mic },
    { id: 'secrets', label: 'settings.secrets.title', icon: Lock },
]

const addSecret = () => {
    if (newSecret.value && !secrets.value.includes(newSecret.value)) {
        secrets.value.push(newSecret.value)
        newSecret.value = ''
    }
}

const removeSecret = (index: number) => {
    secrets.value.splice(index, 1)
}

const applyTheme = (mode: 'system' | 'dark' | 'light') => {
    const root = document.documentElement
    
    if (mode === 'system') {
        // Use system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.toggle('dark', prefersDark)
        root.classList.toggle('light', !prefersDark)
    } else {
        root.classList.toggle('dark', mode === 'dark')
        root.classList.toggle('light', mode === 'light')
    }
}

onMounted(async () => {
  if (window.electron && window.electron.getConfig) {
    const config = await window.electron.getConfig()
    if (config) {
      safeMode.value = config.safeMode ?? true
      browserMode.value = config.browserMode ?? 'gui'
      tavilyApiKey.value = config.tavilyApiKey || ''
      secrets.value = config.secrets || []
      theme.value = config.theme ?? 'system'
      language.value = config.language ?? 'zh-CN'
      locale.value = language.value
      if (config.visionModel) {
          visionModel.value = { 
              provider: 'openai', // default 
              ...config.visionModel 
          }
      }
    }
  }
})

const saveSettings = async () => {
  loading.value = true
  try {
    // 1. Save Child Settings (Voice, Context) if active
    if (activeTab.value === 'voice' && voiceSettingsRef.value) {
      await voiceSettingsRef.value.save()
    }
    if (activeTab.value === 'context' && contextSettingsRef.value) {
      await contextSettingsRef.value.save()
    }

    // 2. Save Global Settings (General + Vision + Secrets) always
    if (window.electron && window.electron.setConfig) {
        // General
        await window.electron.setConfig('safeMode', safeMode.value)
        await window.electron.setConfig('browserMode', browserMode.value)
        await window.electron.setConfig('tavilyApiKey', tavilyApiKey.value)
        await window.electron.setConfig('secrets', JSON.parse(JSON.stringify(secrets.value)))
        await window.electron.setConfig('theme', theme.value)
        await window.electron.setConfig('language', language.value)
        
        // Apply theme immediately
        applyTheme(theme.value)
        locale.value = language.value
        
        // Vision
        const visionModelRaw = JSON.parse(JSON.stringify(visionModel.value));
        await window.electron.setConfig('visionModel', visionModelRaw)

        // Reload secrets globally
        await appStore.loadSecrets()
    }

    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
    
  } catch (err) {
    console.error('Failed to save settings', err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div class="w-full max-w-5xl bg-[#16161a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex h-[80vh]">
      
      <!-- Sidebar -->
      <div class="w-64 bg-black/20 border-r border-white/5 flex flex-col">
          <div class="p-6 border-b border-white/5">
              <h2 class="text-xl font-bold text-white tracking-tight">{{ $t('sidebar.settings') }}</h2>
          </div>
          <div class="flex-1 p-3 space-y-1 overflow-y-auto">
              <button 
                v-for="tab in tabs" 
                :key="tab.id"
                @click="activeTab = tab.id"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap shrink-0"
                :class="activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'"
              >
                  <component :is="tab.icon" class="w-4 h-4 shrink-0" />
                  {{ $t(tab.label) }}
              </button>
          </div>
          

      </div>

      <!-- Content Area -->
      <div class="flex-1 flex flex-col bg-[#16161a]">
          
          <!-- Main Content -->
          <div class="flex-1 overflow-y-auto custom-scrollbar relative">
              
              <!-- General Tab -->
              <div v-if="activeTab === 'general'" class="p-8 space-y-8 animate-fade-in">
                    <!-- Header -->
                    <div class="space-y-1">
                        <h2 class="text-xl font-bold flex items-center gap-2 text-white">
                            <Settings class="w-5 h-5 text-indigo-400" />
                            {{ $t('settings.general.title') }}
                        </h2>
                        <p class="text-sm text-gray-400">{{ $t('settings.general.subtitle') }}</p>
                    </div>

                    <!-- Theme Mode -->
                    <div class="bg-black/20 p-5 rounded-xl border border-white/5">
                        <div class="flex items-start gap-4">
                            <div class="p-3 bg-indigo-500/10 rounded-lg shrink-0">
                                <Monitor class="w-6 h-6 text-indigo-400" />
                            </div>
                            <div class="flex-1">
                                <h3 class="font-bold text-white text-base mb-3">{{ $t('settings.general.themeMode') }}</h3>
                                
                                <div class="grid grid-cols-3 gap-3 mb-2">
                                    <button 
                                        @click="theme = 'system'"
                                        class="px-4 py-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2"
                                        :class="theme === 'system' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-black/30 border-white/10 text-gray-400 hover:bg-white/5'"
                                    >
                                        <Monitor class="w-4 h-4" />
                                        {{ $t('settings.general.themeSystem') }}
                                    </button>
                                    <button 
                                        @click="theme = 'dark'"
                                        class="px-4 py-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2"
                                        :class="theme === 'dark' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-black/30 border-white/10 text-gray-400 hover:bg-white/5'"
                                    >
                                        <Moon class="w-4 h-4" />
                                        {{ $t('settings.general.themeDark') }}
                                    </button>
                                    <button 
                                        @click="theme = 'light'"
                                        class="px-4 py-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2"
                                        :class="theme === 'light' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-black/30 border-white/10 text-gray-400 hover:bg-white/5'"
                                    >
                                        <Sun class="w-4 h-4" />
                                        {{ $t('settings.general.themeLight') }}
                                    </button>
                                </div>
                                <p class="text-sm text-gray-400 leading-relaxed">
                                    {{ $t('settings.general.themeModeDesc') }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Language -->
                    <div class="bg-black/20 p-5 rounded-xl border border-white/5">
                        <div class="flex items-start gap-4">
                            <div class="p-3 bg-indigo-500/10 rounded-lg shrink-0">
                                <Languages class="w-6 h-6 text-indigo-400" />
                            </div>
                            <div class="flex-1">
                                <h3 class="font-bold text-white text-base mb-3">{{ $t('settings.general.language') }}</h3>
                                
                                <div class="grid grid-cols-2 gap-3 mb-2">
                                    <button 
                                        @click="language = 'zh-CN'"
                                        class="px-4 py-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2"
                                        :class="language === 'zh-CN' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-black/30 border-white/10 text-gray-400 hover:bg-white/5'"
                                    >
                                        🇨🇳 简体中文
                                    </button>
                                    <button 
                                        @click="language = 'en'"
                                        class="px-4 py-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2"
                                        :class="language === 'en' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-black/30 border-white/10 text-gray-400 hover:bg-white/5'"
                                    >
                                        🇺🇸 English
                                    </button>
                                </div>
                                <p class="text-sm text-gray-400 leading-relaxed">
                                    {{ $t('settings.general.languageDesc') }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Safe Mode -->
                    <div class="bg-black/20 p-5 rounded-xl border border-white/5">
                        <div class="flex items-start gap-4">
                            <div class="p-3 bg-indigo-500/10 rounded-lg shrink-0">
                                <Shield class="w-6 h-6 text-indigo-400" />
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center justify-between mb-2">
                                    <h3 class="font-bold text-white text-base">{{ $t('settings.general.safeMode') }}</h3>
                                    
                                    <button 
                                        @click="safeMode = !safeMode"
                                        class="w-11 h-6 bg-gray-700 rounded-full relative transition-colors duration-200 focus:outline-none"
                                        :class="safeMode ? 'bg-indigo-600' : 'bg-gray-700'"
                                    >
                                        <div 
                                            class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm"
                                            :class="safeMode ? 'translate-x-5' : 'translate-x-0'"
                                        ></div>
                                    </button>
                                </div>
                                <p class="text-sm text-gray-400 leading-relaxed">
                                    {{ $t('settings.general.safeModeDesc') }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Browser Mode -->
                    <div class="bg-black/20 p-5 rounded-xl border border-white/5">
                        <div class="flex items-start gap-4">
                            <div class="p-3 bg-indigo-500/10 rounded-lg shrink-0">
                                <span class="text-xl">🌐</span>
                            </div>
                            <div class="flex-1">
                                <h3 class="font-bold text-white text-base mb-3">{{ $t('settings.general.browserMode') }}</h3>
                                
                                <div class="grid grid-cols-2 gap-3 mb-2">
                                    <button 
                                        @click="browserMode = 'gui'"
                                        class="px-4 py-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2"
                                        :class="browserMode === 'gui' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-black/30 border-white/10 text-gray-400 hover:bg-white/5'"
                                    >
                                        <span class="w-2 h-2 rounded-full bg-green-400" v-if="browserMode === 'gui'"></span>
                                        {{ $t('settings.general.browserVisual') }}
                                    </button>
                                    <button 
                                        @click="browserMode = 'headless'"
                                        class="px-4 py-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2"
                                        :class="browserMode === 'headless' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-black/30 border-white/10 text-gray-400 hover:bg-white/5'"
                                    >
                                        <span class="w-2 h-2 rounded-full bg-gray-400" v-if="browserMode === 'headless'"></span>
                                        {{ $t('settings.general.browserHeadless') }}
                                    </button>
                                </div>
                                <p class="text-sm text-gray-400 leading-relaxed">
                                    {{ $t('settings.general.browserModeDesc') }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Tavily API Key -->
                    <div class="bg-black/20 p-5 rounded-xl border border-white/5">
                        <div class="flex items-start gap-4">
                            <div class="p-3 bg-indigo-500/10 rounded-lg shrink-0">
                                <Globe class="w-6 h-6 text-indigo-400" />
                            </div>
                            <div class="flex-1 space-y-3">
                                <h3 class="font-bold text-white text-base">{{ $t('models.tavilyKey') }}</h3>
                                <input 
                                    v-model="tavilyApiKey"
                                    type="password" 
                                    placeholder="tvly-..."
                                    class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-gray-600"
                                />
                                <p class="text-sm text-gray-400 leading-relaxed">{{ $t('models.tavilyDesc') }} <a href="https://tavily.com" target="_blank" class="text-indigo-400 hover:text-indigo-300">tavily.com</a>.</p>
                            </div>
                        </div>
                    </div>
              </div>

               <!-- Vision Tab -->
               <div v-if="activeTab === 'vision'" class="p-8 space-y-8 animate-fade-in">
                    <!-- Header -->
                    <div class="space-y-1">
                        <h2 class="text-xl font-bold flex items-center gap-2 text-white">
                            <Globe class="w-5 h-5 text-purple-400" />
                            {{ $t('settings.vision.title') }}
                        </h2>
                        <p class="text-sm text-gray-400">{{ $t('settings.vision.subtitle') }}</p>
                    </div>

                    <!-- Config Card -->
                    <div class="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6">
                        
                        <!-- Toggle -->
                        <div class="flex items-center justify-between">
                             <div class="space-y-1">
                                 <label class="text-sm font-medium text-white">
                                     {{ $t('settings.vision.enable') }}
                                 </label>
                                 <p class="text-xs text-gray-400">{{ $t('settings.vision.enableDesc') }}</p>
                             </div>
                             <button 
                                 @click="visionModel.enabled = !visionModel.enabled"
                                 class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                                 :class="visionModel.enabled ? 'bg-purple-600' : 'bg-gray-700'"
                             >
                                 <span class="sr-only">Toggle vision model</span>
                                 <span
                                     class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                                     :class="visionModel.enabled ? 'translate-x-6' : 'translate-x-1'"
                                 />
                             </button>
                         </div>

                         <div v-if="visionModel.enabled" class="space-y-4 pt-4 border-t border-white/5 animate-fade-in">
                             <!-- Provider -->
                             <div class="space-y-2">
                                <label class="text-sm font-medium text-white">{{ $t('settings.vision.provider') }}</label>
                                <div class="grid grid-cols-2 gap-3">
                                    <button 
                                        @click="visionModel.provider = 'openai'"
                                        class="px-4 py-2 rounded-lg border text-sm font-medium transition-all"
                                        :class="visionModel.provider === 'openai' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-black/30 border-white/10 text-gray-400 hover:bg-white/5'"
                                    >
                                        {{ $t('models.openaiCompatible') }}
                                    </button>
                                    <button 
                                        @click="visionModel.provider = 'anthropic'"
                                        class="px-4 py-2 rounded-lg border text-sm font-medium transition-all"
                                        :class="visionModel.provider === 'anthropic' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-black/30 border-white/10 text-gray-400 hover:bg-white/5'"
                                    >
                                        {{ $t('models.anthropic') }}
                                    </button>
                                </div>
                             </div>

                             <!-- Base URL -->
                             <div class="space-y-2">
                                <label class="text-sm font-medium text-white">{{ $t('settings.vision.baseUrl') }}</label>
                                <input 
                                    v-model="visionModel.baseURL"
                                    type="text"
                                    :placeholder="$t('settings.vision.baseUrlPlaceholder')"
                                    class="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600"
                                />
                                <p class="text-xs text-gray-500">{{ $t('settings.vision.baseUrlDesc') }}</p>
                            </div>

                             <!-- API Key -->
                             <div class="space-y-2">
                                <label class="text-sm font-medium text-white">{{ $t('settings.vision.apiKey') }}</label>
                                <input 
                                    v-model="visionModel.apiKey"
                                    type="password"
                                    :placeholder="$t('settings.vision.apiKeyPlaceholder')"
                                    class="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600"
                                />
                            </div>

                            <!-- Model Name -->
                             <div class="space-y-2">
                                <label class="text-sm font-medium text-white">{{ $t('settings.vision.modelName') }}</label>
                                <input 
                                    v-model="visionModel.model"
                                    type="text"
                                    :placeholder="$t('settings.vision.modelNamePlaceholder')"
                                    class="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600"
                                />
                                <p class="text-xs text-gray-500">{{ $t('settings.vision.modelNameDesc') }}</p>
                            </div>
                         </div>
                    </div>
               </div>

              <!-- Context Tab -->
              <ContextSettings v-if="activeTab === 'context'" ref="contextSettingsRef" />

              <!-- Voice Tab -->
              <VoiceSettings v-if="activeTab === 'voice'" ref="voiceSettingsRef" />

               <!-- Secrets Tab -->
               <div v-if="activeTab === 'secrets'" class="p-8 space-y-8 animate-fade-in">
                    <!-- Header -->
                    <div class="space-y-1">
                        <h2 class="text-xl font-bold flex items-center gap-2 text-white">
                            <Lock class="w-5 h-5 text-red-400" />
                            {{ $t('settings.secrets.title') }}
                        </h2>
                        <p class="text-sm text-gray-400">{{ $t('settings.secrets.subtitle') }}</p>
                    </div>

                    <!-- Add Secret -->
                    <div class="bg-black/20 p-5 rounded-xl border border-white/5 space-y-4">
                        <h3 class="font-bold text-white text-base">{{ $t('settings.secrets.add') }}</h3>
                        <div class="flex gap-2">
                            <input 
                                v-model="newSecret"
                                type="text"
                                :placeholder="$t('settings.secrets.placeholder')"
                                class="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/50 transition-all placeholder:text-gray-600"
                                @keydown.enter.prevent="addSecret"
                            />
                            <button 
                                @click="addSecret"
                                :disabled="!newSecret"
                                class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2 border border-white/5"
                            >
                                <Plus class="w-4 h-4" /> {{ $t('settings.secrets.addButton') }}
                            </button>
                        </div>
                        <p class="text-xs text-gray-500">{{ $t('settings.secrets.desc') }}</p>
                    </div>

                    <!-- List -->
                    <div class="space-y-2">
                         <div v-if="secrets.length === 0" class="text-center py-8 text-gray-500 text-sm border-2 border-dashed border-white/5 rounded-xl">
                             {{ $t('settings.secrets.empty') }}
                         </div>
                         <div v-else class="grid gap-2">
                             <div 
                                v-for="(pwd, idx) in secrets" 
                                :key="idx"
                                class="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-lg group hover:border-white/10 transition-colors"
                             >
                                 <span class="font-mono text-sm text-gray-300">{{ pwd }}</span>
                                 <button 
                                     @click="removeSecret(idx)"
                                     class="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                     :title="$t('settings.secrets.delete')"
                                 >
                                     <Trash2 class="w-4 h-4" />
                                 </button>
                             </div>
                         </div>
                    </div>
               </div>

          </div>

          <!-- Bottom Action Bar (Only for General mainly, but nice to be global) -->
          <div class="p-6 border-t border-white/5 bg-black/10 flex justify-end items-center gap-4">
             <span v-if="saved" class="text-green-400 text-sm font-medium animate-fade-in flex items-center gap-1">
                <CheckCircle2 class="w-4 h-4"/> {{ $t('settings.saved') }}
             </span>
             
             <div class="flex items-center gap-3">
                 <button 
                    @click="$emit('close')"
                    class="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                  >
                    {{ $t('settings.cancel') }}
                  </button>

             <button 
                @click="saveSettings"
                :disabled="loading"
                class="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
             >
                <Save class="w-4 h-4" />
                {{ loading ? $t('settings.saving') : $t('settings.save') }}
             </button>
          </div>

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

/* Custom Scrollbar for better blend */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
