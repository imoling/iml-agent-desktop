<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { X, Save, Plus, Trash2, ChevronRight, ChevronDown, Rocket, Search, Globe, Layout, Code2, Play, Info, MoreVertical, FileCode, CheckCircle2, AlertCircle, Maximize2, Minimize2, File, Folder, RefreshCw, Sparkles, Loader2, FileText } from 'lucide-vue-next'
import { Codemirror } from 'vue-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { useSkillsStore } from '../stores/skills'
import { useI18n } from 'vue-i18n'
import FileTreeNode from './FileTreeNode.vue'

const { t } = useI18n()

const props = defineProps<{
    isOpen: boolean
    skillId?: string // If present, we are editing
}>()

const emit = defineEmits<{
    (e: 'close'): void
}>()

const skillsStore = useSkillsStore()
const activeTab = ref<'overview' | 'code'>('overview')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const localSkillId = ref<string | null>(null)
const isGenerating = ref(false)
const generatePrompt = ref('')

// Form State
const name = ref('')
const displayName = ref('')
const description = ref('')
const defaultInChat = ref(true) // Default to true for new skills
const isFullscreen = ref(false)
const inputs = ref<{name: string, type: string, description: string, required: boolean}[]>([])
const codeContent = ref('')
const allowedTools = ref('')
const userInvocable = ref(true)
const resources = ref<{ name: string; path: string; isDir: boolean; size: number; mtime: number }[]>([])
const loadingResources = ref(false)
const currentFilePath = ref<string>('scripts/index.js')
const isModified = ref(false)
const expandedFolders = ref<Set<string>>(new Set(['scripts', 'references', 'assets']))
const extensions = [javascript(), oneDark]

// Computed tree structure for resources
const treeResources = computed(() => {
    const tree: any[] = []
    const map: Record<string, any> = {}

    // Sort: directories first, then alphabetically
    const sortedResources = [...resources.value].sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
    })

    sortedResources.forEach(res => {
        const parts = res.path.split('/')
        let currentLevel = tree
        let currentPath = ''

        parts.forEach((part, index) => {
            currentPath = currentPath ? `${currentPath}/${part}` : part
            const isLast = index === parts.length - 1

            if (!map[currentPath]) {
                const node = {
                    name: part,
                    path: currentPath,
                    isDir: isLast ? res.isDir : true, // Intermediate parts are always dirs
                    children: [],
                    size: isLast ? res.size : 0,
                    mtime: isLast ? res.mtime : 0
                }
                map[currentPath] = node
                currentLevel.push(node)
            }
            currentLevel = map[currentPath].children
        })
    })

    return tree
})

const toggleFolder = (path: string) => {
    if (expandedFolders.value.has(path)) {
        expandedFolders.value.delete(path)
    } else {
        expandedFolders.value.add(path)
    }
}

const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value
}

// Watch for modal open and skillId to populate data
watch(() => props.isOpen, async (newVal) => {
    if (newVal) {
        resetForm()
        localSkillId.value = props.skillId || null
        if (localSkillId.value) {
            await loadSkillData(localSkillId.value)
        } else {
            // New Skill defaults
            codeContent.value = getDefaultCodeTemplate()
        }
    }
})

const resetForm = () => {
    name.value = ''
    displayName.value = ''
    description.value = ''
    defaultInChat.value = true
    inputs.value = [{ name: '', type: 'string', description: '', required: true }]
    codeContent.value = ''
    allowedTools.value = ''
    userInvocable.value = true
    resources.value = []
    currentFilePath.value = 'scripts/index.js'
    isModified.value = false
    expandedFolders.value = new Set(['scripts', 'references', 'assets'])
    errorMessage.value = ''
    successMessage.value = ''
    activeTab.value = 'overview'
    loading.value = false
    localSkillId.value = null
}

const loadSkillData = async (id: string) => {
    loading.value = true
    try {
        const skill = skillsStore.skills.find(s => s.id === id)
        if (skill) {
            name.value = skill.name
            displayName.value = skill.displayName || skill.name
            description.value = skill.description
            defaultInChat.value = skill.defaultInChat ?? true
            
            // Transform parameters object back to array
            inputs.value = []
            
            // Populate metadata
            if (skill.metadata) {
                allowedTools.value = Array.isArray(skill.metadata['allowed-tools']) 
                    ? skill.metadata['allowed-tools'].join(', ') 
                    : (skill.metadata['allowed-tools'] || '')
                userInvocable.value = skill.metadata['user-invocable'] !== false
            }

            if (skill.parameters) {
                let paramsObj = skill.parameters.properties || skill.parameters;
                const requiredList = skill.parameters.required || [];
                
                if (paramsObj && typeof paramsObj === 'object') {
                    for (const key in paramsObj) {
                        const prop = paramsObj[key];
                        if (!skill.parameters.properties && ['type', 'required', 'properties'].includes(key)) continue;
                        
                        inputs.value.push({
                            name: key,
                            type: typeof prop === 'string' ? 'string' : (prop.type || 'string'),
                            description: typeof prop === 'string' ? '' : (prop.description || ''),
                            required: requiredList.includes(key)
                        })
                    }
                }
            }
            
            if (inputs.value.length === 0) {
                 inputs.value.push({ name: '', type: 'string', description: '', required: true })
            }

            // Load Resources
            loadResources()

            // Load Script Content
            const result = await window.electron.readSkillScript(id)
            if (result.success && result.content) {
                codeContent.value = result.content
            } else {
                codeContent.value = '// Failed to load script content'
            }
        }
    } catch (e: any) {
        errorMessage.value = e.message
    } finally {
        loading.value = false
    }
}

const getDefaultCodeTemplate = () => {
    return `const fs = require('fs');

// Read input from arguments
const args = JSON.parse(process.argv[2] || '{}');

try {
    // TODO: Implement your logic here
    console.log('Executing skill...');
    
    process.stdout.write(JSON.stringify({ 
        output: "Successfully executed" 
    }));
} catch (error) {
    console.error(error);
    process.exit(1);
}`;
}

const addInput = () => {
    inputs.value.push({ name: '', type: 'string', description: '', required: true })
}

const removeInput = (index: number) => {
    inputs.value.splice(index, 1)
}

const loadResources = async (retries = 2) => {
    if (!localSkillId.value) return
    loadingResources.value = true
    try {
        const result = await window.electron.listSkillFiles(localSkillId.value)
        resources.value = result
        // If it's empty but we expect files (e.g. for a skill), retry once
        if (result.length === 0 && retries > 0) {
            setTimeout(() => loadResources(retries - 1), 500)
        }
    } catch (e) {
        console.error('Failed to load resources:', e)
    } finally {
        loadingResources.value = false
    }
}

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (ms: number) => {
    return new Date(ms).toLocaleString()
}

const openFile = async (path: string) => {
    if (isModified.value) {
        if (!confirm(t('builder.unsavedChanges'))) {
            return
        }
    }
    
    loading.value = true
    try {
        const content = await window.electron.readSkillFile(localSkillId.value!, path)
        codeContent.value = content
        currentFilePath.value = path
        activeTab.value = 'code'
        isModified.value = false
    } catch (e: any) {
        errorMessage.value = `Failed to open file: ${e.message}`
    } finally {
        loading.value = false
    }
}

const saveCurrentFile = async () => {
    if (!localSkillId.value) return
    loading.value = true
    try {
        const result = await window.electron.writeSkillFile(localSkillId.value, currentFilePath.value, codeContent.value)
        if (result.success) {
            isModified.value = false
            successMessage.value = `Saved ${currentFilePath.value}`
            setTimeout(() => { successMessage.value = '' }, 2000)
            await loadResources()
        } else {
            errorMessage.value = result.error || 'Failed to save file'
        }
    } catch (e: any) {
        errorMessage.value = e.message
    } finally {
        loading.value = false
    }
}

const deleteFile = async (path: string) => {
    if (!confirm(t('builder.confirmDeleteFile', { path }))) return
    loading.value = true
    try {
        const result = await window.electron.deleteSkillFile(localSkillId.value!, path)
        if (result.success) {
            await loadResources()
            if (currentFilePath.value === path) {
                currentFilePath.value = 'scripts/index.js'
                const content = await window.electron.readSkillFile(localSkillId.value!, 'scripts/index.js')
                codeContent.value = content
            }
        } else {
            errorMessage.value = result.error || 'Failed to delete file'
        }
    } catch (e: any) {
        errorMessage.value = e.message
    } finally {
        loading.value = false
    }
}

const addNewFile = async () => {
    if (!localSkillId.value) {
        errorMessage.value = t('builder.saveFirst')
        return
    }
    const fileName = prompt(t('builder.enterFilePath'))
    if (!fileName) return
    
    loading.value = true
    try {
        const result = await window.electron.createSkillFile(localSkillId.value!, fileName, false)
        if (result.success) {
            await loadResources()
            await openFile(fileName)
        } else {
            errorMessage.value = result.error || 'Failed to create file'
        }
    } catch (e: any) {
        errorMessage.value = e.message
    } finally {
        loading.value = false
    }
}

const addNewDir = async () => {
    if (!localSkillId.value) {
        errorMessage.value = t('builder.saveFirst')
        return
    }
    const dirName = prompt(t('builder.enterDirPath'))
    if (!dirName) return
    
    loading.value = true
    try {
        const result = await window.electron.createSkillFile(localSkillId.value!, dirName, true)
        if (result.success) {
            await loadResources()
        } else {
            errorMessage.value = result.error || 'Failed to create directory'
        }
    } catch (e: any) {
        errorMessage.value = e.message
    } finally {
        loading.value = false
    }
}

const handleGenerate = async () => {
    if (!generatePrompt.value) return
    
    isGenerating.value = true
    errorMessage.value = ''
    successMessage.value = ''

    try {
        const result = await window.electron.generateSkill(generatePrompt.value)
        if (result.success && result.data) {
            const data = result.data
            name.value = data.name
            displayName.value = data.displayName
            description.value = data.description
            inputs.value = data.inputs || []
            codeContent.value = data.code || ''
            successMessage.value = t('builder.saveSuccess') // Reusing success message or generic
            activeTab.value = 'code' // Switch to code to show result
        } else {
            errorMessage.value = result.error || 'Generation failed'
        }
    } catch (e: any) {
        errorMessage.value = e.message
    } finally {
        isGenerating.value = false
    }
}

const handleSave = async () => {
    if (!name.value || !description.value) {
        errorMessage.value = t('builder.saveRequired')
        return
    }

    loading.value = true
    errorMessage.value = ''
    successMessage.value = ''

    try {
        const metadata: any = {
            'user-invocable': userInvocable.value
        }
        if (allowedTools.value.trim()) {
            metadata['allowed-tools'] = allowedTools.value.split(',').map(s => s.trim()).filter(Boolean)
        }

        const skillData = {
            name: name.value,
            displayName: displayName.value || name.value,
            description: description.value,
            defaultInChat: defaultInChat.value,
            parameters: {
                type: 'object',
                properties: inputs.value.reduce((acc: any, input) => {
                    if (input.name) {
                        acc[input.name] = {
                            type: input.type,
                            description: input.description
                        }
                    }
                    return acc
                }, {}),
                required: inputs.value.filter(i => i.required && i.name).map(i => i.name)
            },
            inputs: inputs.value,
            metadata
        }

        const payload = JSON.parse(JSON.stringify(skillData))

        let result: any
        if (localSkillId.value) {
            result = await window.electron.updateSkill(localSkillId.value, payload)
            if (result.success) {
                // If the current file is the main script, update it (backwards compatibility or just convention)
                if (currentFilePath.value === 'scripts/index.js') {
                    await window.electron.updateSkillScript(localSkillId.value, codeContent.value)
                } else {
                    await window.electron.writeSkillFile(localSkillId.value, currentFilePath.value, codeContent.value)
                }
            }
        } else {
            result = await window.electron.createSkill(payload as any)
            if (result.success && result.skillId) {
                await window.electron.updateSkillScript(result.skillId, codeContent.value)
            }
        }

        if (result.success) {
            successMessage.value = t('builder.saveSuccess')
            await skillsStore.fetchSkills()
            if (!localSkillId.value && result.skillId) {
                localSkillId.value = result.skillId
                // Give a small delay to ensure backend state is synchronized
                setTimeout(async () => {
                    await loadResources()
                }, 500)
            } else {
                // Close only if it was already an edit
                setTimeout(() => emit('close'), 1500)
            }
        } else {
            errorMessage.value = result.error || t('common.saveFailed')
        }
    } catch (e: any) {
        errorMessage.value = e.message
    } finally {
        loading.value = false
    }
}

const handleDelete = async () => {
    if (!localSkillId.value) return
    if (!confirm('Are you sure you want to delete this skill?')) return

    loading.value = true
    try {
        const result = await window.electron.deleteSkill(localSkillId.value)
        if (result.success) {
            await skillsStore.fetchSkills()
            emit('close')
        } else {
            errorMessage.value = result.error || "Failed to delete skill"
        }
    } catch (e: any) {
        errorMessage.value = e.message
    } finally {
        loading.value = false
    }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
    <div 
        class="bg-[#121214] border border-white/10 w-full max-w-5xl h-full max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-scale-up"
        :class="{ 'fixed inset-0 max-w-none max-h-none rounded-none': isFullscreen }"
    >
        <!-- Header -->
        <div class="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <FileCode class="w-6 h-6" />
                </div>
                <div>
                    <h2 class="text-lg font-bold text-white tracking-tight">{{ localSkillId ? $t('builder.editSkill') : $t('builder.createNewSkill') }}</h2>
                    <p class="text-xs text-gray-500 font-medium">{{ localSkillId ? name : $t('builder.defineBehavior') }}</p>
                </div>
            </div>
            
            <div class="flex items-center gap-2">
                <button 
                    @click="toggleFullscreen" 
                    class="text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                    :title="isFullscreen ? $t('builder.exitFullscreen') : $t('builder.fullscreen')"
                >
                    <Minimize2 v-if="isFullscreen" class="w-5 h-5" />
                    <Maximize2 v-else class="w-5 h-5" />
                </button>
                <button @click="$emit('close')" class="text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg">
                    <X class="w-5 h-5" />
                </button>
            </div>
        </div>

        <!-- content -->
        <div class="flex-1 overflow-hidden flex flex-col">
            <!-- Tabs -->
            <div class="flex items-center px-6 border-b border-white/5 bg-white/5">
                <button 
                  @click="activeTab = 'overview'"
                  class="px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2"
                  :class="activeTab === 'overview' ? 'border-indigo-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'"
                >
                   <Info class="w-4 h-4" /> {{ $t('builder.overview') }}
                </button>
                <button 
                  @click="activeTab = 'code'"
                  class="px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2"
                  :class="activeTab === 'code' ? 'border-indigo-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'"
                >
                   <Code2 class="w-4 h-4" /> {{ $t('builder.implementation') }} <span v-if="currentFilePath !== 'scripts/index.js'" class="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded ml-1">{{ currentFilePath.split('/').pop() }}</span>
                </button>
            </div>

            <div class="flex-1 overflow-y-auto p-6">
                 
                 <!-- Error / Success -->
                 <div v-if="errorMessage" class="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                    <div class="w-1.5 h-1.5 rounded-full bg-red-400"></div> {{ errorMessage }}
                 </div>
                 <div v-if="successMessage" class="mb-6 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                    <div class="w-1.5 h-1.5 rounded-full bg-green-400"></div> {{ successMessage }}
                 </div>

                 <!-- OVERVIEW TAB -->
                 <div v-show="activeTab === 'overview'" class="space-y-6 max-w-2xl mx-auto">
                    
                    <!-- AI Generator (only for new skills) -->
                    <div v-if="!localSkillId" class="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-4 mb-6">
                        <div class="flex items-start gap-3">
                            <div class="p-2 bg-indigo-500/20 rounded-lg shrink-0">
                                <Sparkles class="w-5 h-5 text-indigo-400" />
                            </div>
                            <div class="flex-1 space-y-2">
                                <h3 class="text-sm font-medium text-white">{{ $t('builder.aiGenerate') }}</h3>
                                <p class="text-xs text-gray-400">{{ $t('builder.aiGenerateDesc') }}</p>
                                <div class="flex gap-2 mt-2">
                                    <input 
                                        v-model="generatePrompt" 
                                        :placeholder="$t('builder.aiGeneratePlaceholder')" 
                                        class="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                        @keyup.enter="handleGenerate"
                                        :disabled="isGenerating"
                                    />
                                    <button 
                                        @click="handleGenerate" 
                                        :disabled="!generatePrompt || isGenerating"
                                        class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white flex items-center gap-2 transition-colors min-w-[100px] justify-center"
                                    >
                                        <Loader2 v-if="isGenerating" class="w-4 h-4 animate-spin" />
                                        <span v-else>{{ $t('builder.generate') }}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Basic Info -->
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">{{ $t('builder.skillName') }}</label>
                            <input 
                                v-model="name"
                                type="text" 
                                :disabled="!!localSkillId"
                                :placeholder="$t('builder.skillNamePlaceholder')" 
                                class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-all font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <p v-if="localSkillId" class="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <Info class="w-3 h-3" /> {{ $t('builder.idCannotBeChanged') }}
                            </p>
                        </div>

                         <div class="space-y-2">
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">{{ $t('builder.displayName') }}</label>
                            <input 
                                v-model="displayName"
                                type="text" 
                                :placeholder="$t('builder.displayNamePlaceholder')" 
                                class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-all text-sm"
                            />
                        </div>

                        <!-- Default In Chat Toggle -->
                        <div class="space-y-2">
                             <div class="flex items-center justify-between bg-black/20 border border-white/10 rounded-xl px-4 py-3">
                                 <div>
                                     <h3 class="text-sm font-medium text-white">{{ $t('builder.showInChat') }}</h3>
                                     <p class="text-xs text-gray-500 max-w-[300px]">{{ $t('builder.showInChatDesc') }}</p>
                                 </div>
                                 
                                <button 
                                    @click="defaultInChat = !defaultInChat"
                                    class="w-11 h-6 bg-gray-700 rounded-full relative transition-colors duration-200 focus:outline-none shrink-0"
                                    :class="defaultInChat ? 'bg-indigo-600' : 'bg-gray-700'"
                                >
                                    <div 
                                        class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm"
                                        :class="defaultInChat ? 'translate-x-5' : 'translate-x-0'"
                                    ></div>
                                </button>
                             </div>
                        </div>

                        <div class="space-y-2">
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">{{ $t('builder.skillDesc') }}</label>
                            <textarea 
                                v-model="description"
                                rows="2"
                                :placeholder="$t('builder.skillDescPlaceholder')"
                                class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-all resize-none text-sm"
                            ></textarea>
                        </div>

                        <!-- Claude Metadata -->
                        <div class="pt-4 space-y-4 border-t border-white/5">
                            <div class="space-y-2">
                                <div class="flex items-center justify-between">
                                    <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">{{ $t('builder.allowedTools') }}</label>
                                </div>
                                <input 
                                    v-model="allowedTools"
                                    type="text"
                                    placeholder="write-file, shell-executor:*, ..."
                                    class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-all font-mono text-xs"
                                />
                                <p class="text-[10px] text-gray-500 mt-1">{{ $t('builder.allowedToolsDesc') }}</p>
                            </div>

                            <div class="flex items-center justify-between bg-black/20 border border-white/10 rounded-xl px-4 py-3 mt-4">
                                <div>
                                    <h3 class="text-sm font-medium text-white">{{ $t('builder.userInvocable') }}</h3>
                                    <p class="text-xs text-gray-500">{{ $t('builder.userInvocableDesc') }}</p>
                                </div>
                                <button 
                                    @click="userInvocable = !userInvocable"
                                    class="w-11 h-6 rounded-full relative transition-colors duration-200 focus:outline-none shrink-0"
                                    :class="userInvocable ? 'bg-indigo-600' : 'bg-gray-700'"
                                >
                                    <div 
                                        class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm"
                                        :class="userInvocable ? 'translate-x-5' : 'translate-x-0'"
                                    ></div>
                                </button>
                            </div>
                        </div>

                        <!-- Inputs -->
                        <div class="space-y-4 pt-4 border-t border-white/5">
                            <div class="flex items-center justify-between">
                                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">{{ $t('builder.inputs') }}</label>
                                <button @click="addInput" class="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                                    <Plus class="w-3 h-3" /> {{ $t('builder.addInput') }}
                                </button>
                            </div>
                            
                            <div v-for="(input, index) in inputs" :key="index" class="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3 group/input relative transition-all hover:bg-white/[0.04]">
                                <button 
                                    @click="removeInput(index)" 
                                    v-if="inputs.length > 1"
                                    class="absolute top-4 right-4 text-gray-600 hover:text-red-400 opacity-0 group-hover/input:opacity-100 transition-all p-1"
                                >
                                    <Trash2 class="w-4 h-4" />
                                </button>

                                <div class="grid grid-cols-2 gap-4">
                                    <div class="space-y-1.5">
                                        <label class="text-[10px] font-bold text-gray-500 uppercase px-1">{{ $t('builder.parameterName') }}</label>
                                        <input v-model="input.name" type="text" :placeholder="$t('builder.parameterNamePlaceholder')" class="w-full bg-black/20 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all font-mono" />
                                    </div>
                                    <div class="space-y-1.5">
                                        <label class="text-[10px] font-bold text-gray-500 uppercase px-1">{{ $t('builder.type') }}</label>
                                        <select v-model="input.type" class="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all custom-select">
                                            <option value="string">{{ $t('builder.typeString') }}</option>
                                            <option value="number">{{ $t('builder.typeNumber') }}</option>
                                            <option value="boolean">{{ $t('builder.typeBoolean') }}</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-[10px] font-bold text-gray-500 uppercase px-1">{{ $t('builder.description') }}</label>
                                    <input v-model="input.description" type="text" placeholder="Explain what this parameter does..." class="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all" />
                                </div>
                                <div class="flex items-center gap-2 px-1">
                                    <input type="checkbox" v-model="input.required" :id="'req-' + index" class="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-indigo-500/20" />
                                    <label :for="'req-' + index" class="text-xs text-gray-400">{{ $t('builder.required') }}</label>
                                </div>
                            </div>
                        </div>
                    </div>
                 </div>

                 <!-- UNIFIED IMPLEMENTATION TAB (Tree + Editor) -->
                 <div v-show="activeTab === 'code'" class="h-full flex gap-0 -m-6 overflow-hidden">
                     <!-- SIDEBAR: Tree Explorer -->
                     <div class="w-64 border-r border-white/5 bg-black/10 flex flex-col pt-4">
                        <div class="px-4 mb-4 flex items-center justify-between">
                            <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{{ $t('builder.resources') }}</h3>
                             <div class="flex items-center gap-1">
                                <button @click="loadResources()" class="p-1 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors" :class="{ 'animate-spin': loadingResources, 'opacity-50 cursor-not-allowed': !localSkillId }" :title="$t('builder.refresh')">
                                    <RefreshCw class="w-3.5 h-3.5" />
                                </button>
                                <button @click="addNewDir" class="p-1 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors" :class="{ 'opacity-50 cursor-not-allowed': !localSkillId }" title="New Folder">
                                    <Folder class="w-3.5 h-3.5" />
                                </button>
                                <button @click="addNewFile" class="p-1 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors" :class="{ 'opacity-50 cursor-not-allowed': !localSkillId }" title="New File">
                                    <File class="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        <div class="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-0.5 pb-4">
                            <div v-if="!localSkillId" class="px-4 py-8 text-center">
                                <p class="text-[10px] text-gray-600 italic">{{ $t('builder.saveFirst') }}</p>
                            </div>
                            <div v-else-if="loadingResources && resources.length === 0" class="px-4 py-8 text-center">
                                <div class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full mx-auto mb-2"></div>
                            </div>
                            <div v-else-if="resources.length === 0" class="px-4 py-8 text-center">
                                <p class="text-[10px] text-gray-600 italic">{{ $t('builder.noFiles') }}</p>
                            </div>
                            <!-- Recursive Tree Component (simplified using a local script-based recursion) -->
                            <template v-else v-for="node in treeResources" :key="node.path">
                                <FileTreeNode 
                                    :node="node" 
                                    :current-path="currentFilePath" 
                                    :expanded-folders="expandedFolders"
                                    @open="openFile"
                                    @toggle="toggleFolder"
                                    @delete="deleteFile"
                                />
                            </template>
                        </div>
                     </div>

                     <!-- MAIN CONTENT: Editor -->
                     <div class="flex-1 flex flex-col p-6 min-w-0">
                         <div class="flex items-center justify-between mb-3 bg-white/5 p-3 rounded-xl border border-white/10 shadow-sm">
                            <div class="flex items-center gap-3 overflow-hidden">
                                <FileText class="w-4 h-4 text-indigo-400 shrink-0" />
                                <div class="flex items-center gap-1.5 truncate">
                                    <p class="text-xs text-gray-200 font-mono truncate tracking-tight">{{ currentFilePath }}</p>
                                    <span v-if="isModified" class="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <button 
                                    v-if="isModified" 
                                    @click="saveCurrentFile"
                                    class="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 rounded-lg text-[11px] font-bold transition-all border border-indigo-500/30"
                                >
                                    <Save class="w-3.5 h-3.5" /> {{ $t('common.save') }}
                                </button>
                            </div>
                         </div>
                         
                         <div class="flex-1 overflow-hidden relative border border-white/10 rounded-2xl bg-[#0a0a0c] shadow-inner">
                            <codemirror
                                v-model="codeContent"
                                @change="isModified = true"
                                placeholder="Write your skill execution code here..."
                                :style="{ height: '100%', width: '100%' }"
                                :autofocus="true"
                                :indent-with-tab="true"
                                :tab-size="2"
                                :extensions="extensions"
                            />
                         </div>
                     </div>
                 </div>



             </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-white/10 bg-black/20 flex justify-between gap-3">
             <button 
                v-if="localSkillId"
                @click="handleDelete"
                class="px-5 py-2 text-sm font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all flex items-center gap-2"
             >
                <Trash2 class="w-4 h-4" />
                {{ $t('builder.deleteSkill') }}
             </button>
             <div v-else></div> <!-- Spacer -->

             <div class="flex gap-3">
                 <button 
                    @click="$emit('close')"
                    class="px-5 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                 >
                    {{ $t('builder.cancel') }}
                </button>
                 <button 
                    @click="handleSave"
                :disabled="loading"
                class="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
             >
                <div v-if="loading" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></div>
                <Save v-else class="w-4 h-4" />
                {{ localSkillId ? $t('builder.saveChanges') : $t('builder.createSkill') }}
            </button>
         </div>
       </div>

    </div>
  </div>
</template>

<style scoped>
.animate-scale-up {
    animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes scaleUp {
    from {
        opacity: 0;
        transform: scale(0.95) translateY(10px);
    }
    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
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
