<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { X, FileText, Box, Clock, FileJson, FileCode, FileImage, FolderOpen, Folder, File, BrainCircuit, Loader2, Bot, Zap, Presentation, FileVideo, FileAudio, FileSpreadsheet } from 'lucide-vue-next'
import { useChatStore } from '../stores/chat'
import { useSkillsStore } from '../stores/skills'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const chatStore = useChatStore()
const skillsStore = useSkillsStore()
const { artifacts, workingDirectory } = storeToRefs(chatStore)

const activeSkillsObjects = computed(() => {
    // chatStore.activeSkills is an array of strings (names)
    // skillsStore.skills is an array of Skill objects
    const activeNames = new Set(chatStore.activeSkills)
    return skillsStore.skills.filter((s: any) => activeNames.has(s.name))
})

const activeTab = ref<'artifacts' | 'context' | 'files'>('artifacts')
// ... (rest of logic)
const files = ref<Array<{ name: string; isDirectory: boolean; path: string }>>([])
const isLoadingFiles = ref(false)
const processingFiles = ref<Set<string>>(new Set()) // Track files being added to memory

// Context Menu State
const contextMenu = ref<{ x: number; y: number; file: any } | null>(null)

const getFileIcon = (name: string, type: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    
    // Check extension first for precision
    if (ext === 'pdf') return FileText
    if (['md', 'txt', 'doc', 'docx'].includes(ext)) return FileText
    if (['html', 'css', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'go', 'vue'].includes(ext)) return FileCode
    if (['json'].includes(ext)) return FileJson
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return FileImage
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return FileVideo
    if (['mp3', 'wav', 'ogg'].includes(ext)) return FileAudio
    if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet
    if (['ppt', 'pptx'].includes(ext)) return Presentation

    // Fallback to type
    switch (type) {
        case 'image': return FileImage;
        case 'code': return FileCode;
        case 'json': return FileJson;
        default: return File;
    }
}

const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const openFile = async (path: string) => {
    try {
        await window.electron.openFile(path)
    } catch (e) {
        console.error('Failed to open file:', e)
    }
}

const loadFiles = async () => {
    if (!workingDirectory.value) {
        files.value = []
        return
    }
    
    isLoadingFiles.value = true
    try {
        files.value = await window.electron.fsListDir(workingDirectory.value)
    } catch (e) {
        console.error('Failed to list files:', e)
    } finally {
        isLoadingFiles.value = false
    }
}

watch([activeTab, workingDirectory], ([tab, dir]) => {
    if (tab === 'files' && dir) {
        loadFiles()
    }
})

// Context Menu Handlers
const handleContextMenu = (e: MouseEvent, file: any) => {
    e.preventDefault()
    contextMenu.value = {
        x: e.clientX,
        y: e.clientY,
        file
    }
}

const closeContextMenu = () => {
    contextMenu.value = null
}

const addToKnowledge = async () => {
    if (!contextMenu.value) return
    const { file } = contextMenu.value
    closeContextMenu()
    
    if (file.isDirectory) return 

    processingFiles.value.add(file.path)
    try {
        const result = await window.electron.memoryAddFile(file.path)
        if (!result.success) {
            alert(`Failed to add to knowledge: ${result.error}`)
        }
    } catch (e: any) {
        console.error('[RightDrawer] Error adding file:', e)
        alert(`Error adding file: ${e.message}`)
    } finally {
        processingFiles.value.delete(file.path)
    }
}

const selectWorkingDirectory = async () => {
    const dir = await window.electron.selectDirectory()
    if (dir) {
        workingDirectory.value = dir
    }
}

const navigateToDir = (path: string) => {
    workingDirectory.value = path
}

// Close context menu on click outside
window.addEventListener('click', closeContextMenu)
</script>

<template>
  <div class="h-full flex flex-col bg-transparent">
    <!-- Embedded Mode Content -->
    <div class="flex items-center px-2 h-[44px] shrink-0" style="border-bottom: 1px solid var(--border-color);">
        <button 
            @click="activeTab = 'artifacts'"
            class="flex-1 h-full text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-2"
            :class="activeTab === 'artifacts' ? 'border-indigo-500 text-indigo-500' : 'border-transparent'"
            :style="{ color: activeTab === 'artifacts' ? '' : 'var(--text-secondary)' }"
        >
            <Box class="w-3.5 h-3.5" /> {{ t('rightDrawer.artifacts') }}
        </button>
        <button 
            @click="activeTab = 'files'"
            class="flex-1 h-full text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-2"
            :class="activeTab === 'files' ? 'border-indigo-500 text-indigo-500' : 'border-transparent'"
            :style="{ color: activeTab === 'files' ? '' : 'var(--text-secondary)' }"
        >
             <FolderOpen class="w-3.5 h-3.5" /> {{ t('rightDrawer.files') }}
        </button>
        <button 
            @click="activeTab = 'context'"
            class="flex-1 h-full text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-2"
            :class="activeTab === 'context' ? 'border-indigo-500 text-indigo-500' : 'border-transparent'"
            :style="{ color: activeTab === 'context' ? '' : 'var(--text-secondary)' }"
        >
            <BrainCircuit class="w-3.5 h-3.5" /> {{ t('rightDrawer.context') }}
        </button>
    </div>
    
    <!-- Artifacts Tab -->
    <div v-if="activeTab === 'artifacts'" class="flex-1 p-3 overflow-auto">
        <div v-if="artifacts.length === 0" class="flex flex-col items-center justify-center h-full text-gray-500">
            <Box class="w-10 h-10 opacity-30 mb-2" />
            <p class="text-xs">{{ t('rightDrawer.noArtifacts') }}</p>
        </div>
        <div v-else class="space-y-2">
            <div 
                v-for="artifact in artifacts" 
                :key="artifact.id"
                @click="openFile(artifact.path)"
                class="rounded-lg p-3 cursor-pointer group transition-all hover:bg-[var(--bg-hover)]"
                style="background-color: var(--bg-surface)"
            >
                <div class="flex items-start gap-3">
                    <component :is="getFileIcon(artifact.name, artifact.type)" class="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-medium truncate" style="color: var(--text-primary)">{{ artifact.name }}</p>
                        <p class="text-[10px] truncate mt-0.5" style="color: var(--text-muted)">{{ artifact.path }}</p>
                        <div class="flex items-center gap-1 mt-1 text-[10px]" style="color: var(--text-secondary)">
                            <Clock class="w-3 h-3" />
                            {{ formatTime(artifact.createdAt) }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Files Tab -->
    <div v-if="activeTab === 'files'" class="flex-1 p-3 overflow-auto">
        <div v-if="!workingDirectory" class="flex flex-col items-center justify-center h-full" style="color: var(--text-muted)">
            <FolderOpen class="w-10 h-10 opacity-30 mb-2" />
            <p class="text-xs text-center">{{ t('rightDrawer.noWorkingDir') }}</p>
            <button @click="selectWorkingDirectory" class="mt-2 text-xs text-indigo-500 hover:underline">{{ t('rightDrawer.selectDir') }}</button>
        </div>
        <div v-else class="space-y-1">
            <div class="text-[10px] mb-2 truncate flex items-center gap-1" style="color: var(--text-muted)">
                <FolderOpen class="w-3 h-3" />
                {{ workingDirectory }}
            </div>
            <div v-if="isLoadingFiles" class="flex justify-center py-4">
                <Loader2 class="w-5 h-5 text-indigo-500 animate-spin" />
            </div>
            <div v-else-if="files.length === 0" class="text-xs text-center py-4" style="color: var(--text-muted)">{{ t('rightDrawer.emptyDir') }}</div>
            <div v-else v-for="file in files" :key="file.path" @click="file.isDirectory ? navigateToDir(file.path) : openFile(file.path)" @contextmenu.prevent="handleContextMenu($event, file)" class="flex items-center gap-2 p-2 rounded cursor-pointer group hover:bg-[var(--bg-hover)]">
                <component :is="file.isDirectory ? Folder : File" class="w-4 h-4" style="color: var(--text-secondary)" />
                <span class="text-xs truncate flex-1" style="color: var(--text-primary)">{{ file.name }}</span>
            </div>
        </div>
    </div>
    
    <!-- Context Tab -->
    <div v-if="activeTab === 'context'" class="flex-1 p-3 overflow-auto">
            <!-- Header / Summary -->
            <div class="rounded-lg p-3 flex flex-col items-center justify-center text-center" style="background-color: var(--bg-surface)">
                <div class="w-10 h-10 rounded-full mb-2 flex items-center justify-center" style="background-color: var(--bg-hover)">
                    <Bot class="w-5 h-5 text-indigo-500" />
                </div>
                <p class="text-sm font-medium mb-1" style="color: var(--text-primary)">
                     {{ t('rightDrawer.sessionOverview') }}
                </p>
                <div class="flex gap-3 mt-1">
                    <p class="text-xs" style="color: var(--text-secondary)">
                        {{ t('rightDrawer.activeSkills') }}: {{ activeSkillsObjects.length }}
                    </p>
                    <p class="text-xs" style="color: var(--text-secondary)">
                        {{ t('rightDrawer.tokens') }}: {{ (chatStore.sessionDetails.total / 1000).toFixed(1) }}k
                    </p>
                </div>
            </div>

            <!-- Session Stats Card -->
            <div>
                 <h3 class="text-xs font-medium uppercase tracking-wider mb-2 px-1" style="color: var(--text-muted)">
                    {{ t('rightDrawer.sessionStats') }}
                </h3>
                <div class="rounded-lg p-3 flex flex-col gap-2" style="background-color: var(--bg-surface)">
                    <div class="flex justify-between items-center text-xs">
                        <span style="color: var(--text-secondary)">{{ t('rightDrawer.promptTokens') }}</span>
                        <span class="font-mono" style="color: var(--text-primary)">{{ chatStore.sessionDetails.totalPrompt }}</span>
                    </div>
                    <div class="flex justify-between items-center text-xs">
                        <span style="color: var(--text-secondary)">{{ t('rightDrawer.completionTokens') }}</span>
                        <span class="font-mono" style="color: var(--text-primary)">{{ chatStore.sessionDetails.totalCompletion }}</span>
                    </div>
                     <div class="w-full h-[1px] bg-white/5 my-1"></div>
                    <div class="flex justify-between items-center text-xs font-medium">
                        <span style="color: var(--text-secondary)">{{ t('rightDrawer.totalUsage') }}</span>
                        <span class="font-mono text-indigo-400">{{ chatStore.sessionDetails.total }}</span>
                    </div>
                </div>
            </div>

            <!-- Skills List -->
            <div>
                <h3 class="text-xs font-medium uppercase tracking-wider mb-2 px-1" style="color: var(--text-muted)">
                    {{ t('rightDrawer.skills') }} ({{ activeSkillsObjects.length }})
                </h3>
                
                <div v-if="activeSkillsObjects.length === 0" class="flex flex-col items-center justify-center py-4" style="color: var(--text-muted)">
                    <Zap class="w-10 h-10 opacity-30 mb-2" />
                    <p class="text-xs">{{ t('rightDrawer.noSkillsUsed') }}</p>
                </div>

                <div class="space-y-2">
                    <div 
                        v-for="skill in activeSkillsObjects" 
                        :key="skill.id"
                        class="rounded-lg p-3 border border-transparent hover:border-indigo-500/20 transition-all"
                        style="background-color: var(--bg-surface)"
                    >
                        <div class="flex items-start gap-3">
                            <div class="p-1.5 rounded-md shrink-0" style="background-color: var(--bg-primary)">
                                <Zap class="w-3.5 h-3.5 text-amber-500" />
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between mb-0.5">
                                    <p class="text-xs font-medium truncate" style="color: var(--text-primary)">
                                        {{ skill.displayName || skill.name }}
                                    </p>
                                    <span class="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 font-mono">
                                        {{ skill.id }}
                                    </span>
                                </div>
                                <p class="text-[10px] line-clamp-2 leading-relaxed" style="color: var(--text-secondary)">
                                    {{ skill.description }}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
    <div 
        v-if="contextMenu"
        class="fixed z-[9999] rounded-lg shadow-xl py-1 w-40 animate-in fade-in zoom-in-95 duration-100 border"
        :style="{ 
            left: contextMenu.x + 'px', 
            top: contextMenu.y + 'px',
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)'
        }"
    >
        <button 
            @click.stop="addToKnowledge"
            class="w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 hover:bg-indigo-500 hover:text-white"
            :disabled="contextMenu.file.isDirectory"
        >
            <BrainCircuit class="w-3.5 h-3.5" :style="{ color: 'var(--text-primary)' }" />
            <span :style="{ color: 'var(--text-primary)' }">{{ t('rightDrawer.addToKnowledge') }}</span>
        </button>
         <button 
            v-if="!contextMenu.file.isDirectory"
            @click.stop="openFile(contextMenu.file.path); closeContextMenu()"
            class="w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 hover:bg-indigo-500 hover:text-white"
        >
            <FileText class="w-3.5 h-3.5" :style="{ color: 'var(--text-primary)' }" />
            <span :style="{ color: 'var(--text-primary)' }">{{ t('rightDrawer.openFile') }}</span>
        </button>
    </div>
    </Teleport>

  </div>
</template>
