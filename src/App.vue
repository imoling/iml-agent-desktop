<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { MessageSquare, LayoutGrid, Server, Cpu, Languages, Plus, Info, Settings, Download, Zap, Workflow, PanelRight, Database } from 'lucide-vue-next'
import { useSkillsStore } from './stores/skills'
import SkillCard from './components/SkillCard.vue'
import ChatInterface from './components/ChatInterface.vue'
import ModelsView from './components/ModelsView.vue'
import SkillModal from './components/SkillModal.vue'
import WorkflowsView from './components/WorkflowsView.vue'
import MemoryView from './components/MemoryView.vue'
import AboutModal from './components/AboutModal.vue'
import SettingsModal from './components/SettingsModal.vue'
import ImportSkillModal from './components/ImportSkillModal.vue'

import PermissionRequestModal from './components/PermissionRequestModal.vue'
import { useI18n } from 'vue-i18n'

import { useAppStore } from './stores/app'
import { useChatStore } from './stores/chat'

const { t, locale } = useI18n()

// Initialize locale from storage or default to zh-CN
const savedLocale = localStorage.getItem('user-locale')
if (savedLocale) {
    locale.value = savedLocale
} else {
    locale.value = 'zh-CN'
}
const appStore = useAppStore()
// const activeMenu = ref('chat') // Default to chat as per usual agent interaction
const skillsStore = useSkillsStore()
const chatStore = useChatStore()

// Skill Modal State
const showSkillModal = ref(false)
const showImportModal = ref(false)
const editingSkillId = ref<string | undefined>(undefined)
const showAboutModal = ref(false)
// Config / Profiles State
const profiles = ref<any[]>([])
const activeProfileId = ref('')

const fetchConfig = async () => {
    if (window.electron && window.electron.getConfig) {
        const config = await window.electron.getConfig()
        if (config) {
             if (config.profiles) {
                 profiles.value = config.profiles
             }
             if (config.activeProfileId) {
                 activeProfileId.value = config.activeProfileId
             } else if (profiles.value.length > 0) {
                 activeProfileId.value = profiles.value[0].id
             }
             
             // Apply theme
             if (config.theme) {
                 applyTheme(config.theme)
             }
             
             // Apply language
             if (config.language) {
                 locale.value = config.language
             }
        }
    }
}

const applyTheme = (mode: 'system' | 'dark' | 'light') => {
    const root = document.documentElement
    
    if (mode === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.toggle('dark', prefersDark)
        root.classList.toggle('light', !prefersDark)
    } else {
        root.classList.toggle('dark', mode === 'dark')
        root.classList.toggle('light', mode === 'light')
    }
}

const setActiveProfile = async (id: string) => {
    activeProfileId.value = id
    if (window.electron && window.electron.setConfig) {
        await window.electron.setConfig('activeProfileId', id)
    }
}

onMounted(() => {
  skillsStore.fetchSkills()
  fetchConfig()
})

const handleSettingsClose = () => {
    appStore.showSettingsModal = false
    fetchConfig() // Reload in case profiles changed
}

const toggleLanguage = () => {
    locale.value = locale.value === 'en' ? 'zh-CN' : 'en'
    localStorage.setItem('user-locale', locale.value)
}

const handleDeleteSkill = async (id: string) => {
    const skill = skillsStore.skills.find(s => s.id === id)
    if (!skill) return
    
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(t('builder.confirmDelete', { name: skill.displayName || skill.name }))) {
        return
    }

    try {
        const result = await window.electron.deleteSkill(id)
        if (!result.success) throw new Error(result.error)
        
        await skillsStore.fetchSkills()
    } catch (e: any) {
        console.error('Failed to delete skill:', e)
        // Ideally show a toast/notification here
        alert(`Failed to delete skill: ${e.message}`)
    }
}

const openCreateSkill = () => {
    editingSkillId.value = undefined
    showSkillModal.value = true
}

const openEditSkill = (id: string) => {
    editingSkillId.value = id
    showSkillModal.value = true
}

const getMenuTitle = () => {
  switch(appStore.activeMenu) {
    case 'skills': return t('sidebar.skills')
    case 'chat': return t('sidebar.chat')
    case 'models': return t('sidebar.models')
    case 'workflows': return t('sidebar.workflows') // Added workflows title
    case 'memory': return t('sidebar.memory')
    default: return ''
  }
}
</script>

<template>
  <div class="flex h-screen w-screen text-[var(--text-primary)] font-sans overflow-hidden" style="background-color: var(--bg-primary);">
    <!-- Sidebar -->
    <!-- Added pt-12 to push content down below Mac traffic lights -->
    <aside class="w-20 flex flex-col items-center pt-12 pb-6 space-y-4 z-20 draggable backdrop-blur-xl" style="background-color: var(--bg-secondary); border-right: 1px solid var(--border-color);">
      <!-- App Icon -->
      <!-- App Icon -->
      <div class="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex flex-col items-center justify-center text-white mb-2 non-draggable shadow-lg shadow-indigo-500/20 shrink-0 leading-none gap-0.5">
         <span class="font-black text-base tracking-tight">iML</span>
         <span class="font-bold text-[9px] opacity-90 uppercase tracking-wider">Agent</span>
      </div>

      <!-- Navigation -->
      <nav class="flex flex-col gap-3 w-full px-2 mt-4">
        <button 
          v-for="item in [
            { id: 'chat', icon: MessageSquare },
            { id: 'skills', icon: LayoutGrid },
            { id: 'models', icon: Cpu },
            { id: 'workflows', icon: Workflow },
            { id: 'memory', icon: Database },
          ]"
          :key="item.id"
          class="p-3 rounded-xl transition-all duration-200 non-draggable group relative flex justify-center"
          :class="appStore.activeMenu === item.id ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'"
          @click="appStore.activeMenu = item.id"
          :title="$t(`sidebar.${item.id}`)"
        >
          <component :is="item.icon" class="w-5 h-5" />
          <!-- Active Indicator -->
          <div v-if="appStore.activeMenu === item.id" class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full"></div>
        </button>
      </nav>

      <div class="flex-grow"></div>
      
      <!-- Settings Button -->
      <button 
          @click="appStore.openSettings()"
          class="p-3 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition-all duration-200 non-draggable mb-2"
          :title="$t('sidebar.settings')"
        >
          <Settings class="w-5 h-5" />
      </button>

      <!-- Language Switcher -->
      <button 
          @click="toggleLanguage"
          class="p-3 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all duration-200 non-draggable mb-2"
          :title="locale === 'en' ? 'Switch to Chinese' : '切换到英文'"
        >
          <Languages class="w-5 h-5" />
          <span class="sr-only">Switch Language</span>
      </button>

      <!-- About Button -->
      <button 
          @click="showAboutModal = true"
          class="p-3 rounded-xl text-gray-500 hover:text-indigo-400 hover:bg-white/5 transition-all duration-200 non-draggable mb-4"
          :title="$t('sidebar.about')"
        >
          <Info class="w-5 h-5" />
      </button>

    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col relative" style="background-color: var(--bg-primary);">
      <!-- Header -->
      <!-- Adjusted padding to align with look -->
      <header class="h-14 w-full draggable flex items-center px-6 z-10 shrink-0 justify-between backdrop-blur-sm" style="background-color: var(--bg-secondary); border-bottom: 1px solid var(--border-color);">
        <div class="flex items-center gap-4">
            <h1 class="text-sm font-medium" style="color: var(--text-secondary);">iML Agent Desktop <span class="mx-2" style="color: var(--text-muted);">/</span> {{ getMenuTitle() }}</h1>
        </div>
        

      </header>
      
      <div class="flex-1 overflow-hidden relative transition-all duration-300 ease-in-out">
        
        <!-- Skills Grid View -->
        <div v-if="appStore.activeMenu === 'skills'" class="h-full flex flex-col bg-gray-900 text-white">
            <!-- Header -->
            <div class="h-16 px-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-gray-900/50 backdrop-blur-xl">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-indigo-500/10 rounded-lg">
                        <LayoutGrid class="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h2 class="text-lg font-medium text-white">{{ $t('skillsLibrary.title') }}</h2>
                        <p class="text-xs text-gray-400">{{ $t('skillsLibrary.subtitle') }}</p>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <button 
                        @click="showImportModal = true"
                        class="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium rounded-lg transition-all"
                        :title="$t('skills.importSkill')"
                    >
                        <Download class="w-3.5 h-3.5" />
                        <span>{{ $t('skills.importSkill') }}</span>
                    </button>
                    <button 
                        @click="openCreateSkill"
                        class="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <Plus class="w-3.5 h-3.5" />
                        <span>{{ $t('skills.createSkill') }}</span>
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-4">
              
                  <div v-if="skillsStore.loading" class="flex items-center justify-center h-64">
                     <div class="text-gray-500 animate-pulse flex items-center gap-2">
                        <div class="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                        <div class="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                        <div class="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                     </div>
                  </div>

                  <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <SkillCard 
                      v-for="skill in skillsStore.skills" 
                      :key="skill.id" 
                      :skill="skill"
                      :executing="skillsStore.isExecuting(skill.id)"
                      @edit="openEditSkill"
                      @delete="handleDeleteSkill"
                    />
                  </div>

            </div>
        </div>

        <!-- Chat View -->
        <div v-if="appStore.activeMenu === 'chat'" class="h-full flex flex-col p-6">
            <div class="w-full max-w-7xl mx-auto h-full flex flex-col">
                 <ChatInterface />
            </div>
        </div>

        <!-- Models View -->
        <div v-if="appStore.activeMenu === 'models'" class="h-full w-full">
            <ModelsView />
        </div>

        <!-- Workflows View -->
        <div v-if="appStore.activeMenu === 'workflows'" class="h-full w-full">
            <WorkflowsView />
        </div>

        <!-- Memory View -->
        <div v-if="appStore.activeMenu === 'memory'" class="h-full w-full">
            <MemoryView />
        </div>

      </div>
      
      <!-- Modals -->
      <SkillModal 
        :is-open="showSkillModal" 
        :skill-id="editingSkillId"
        @close="showSkillModal = false"
      />
      <ImportSkillModal
        :is-open="showImportModal"
        @close="showImportModal = false"
        @success="skillsStore.fetchSkills()"
      />
      <AboutModal
        :is-open="showAboutModal"
        @close="showAboutModal = false"
      />
      <SettingsModal 
        v-if="appStore.showSettingsModal"
        @close="handleSettingsClose" 
      />
      <PermissionRequestModal />
    </main>
  </div>
</template>

<style>
.draggable {
  -webkit-app-region: drag;
}
.non-draggable {
  -webkit-app-region: no-drag;
}

/* Custom Scrollbar for Vibe look */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
