<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Plus, Play, Trash2, Save, FileText, Square, Workflow, Code, LayoutTemplate, Monitor, Globe, Sparkles, Zap, ChevronRight, Activity } from 'lucide-vue-next'
import { useWorkflowsStore } from '../stores/workflows'
import { useI18n } from 'vue-i18n'
// We reuse the codemirror editor from SkillModal if possible, or simple textarea for MVP
import { Codemirror } from 'vue-codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { json } from '@codemirror/lang-json'

const { t } = useI18n()
const store = useWorkflowsStore()
const selectedWorkflow = ref<any>(null)
const isEditing = ref(false)
const editorContent = ref('')
const viewMode = ref<'code' | 'visual'>('visual')

const getStepIcon = (step: any) => {
    if (step.skillId === 'browser-automation' || step.name?.toLowerCase().includes('browser')) return Globe
    if (step.skillId === 'desktop-automation' || step.name?.toLowerCase().includes('desktop')) return Monitor
    if (step.type === 'llm' || step.skillId?.includes('llm')) return Sparkles
    return Zap
}

const getParamsArray = (params: any) => {
    if (!params) return []
    return Object.entries(params).map(([key, value]) => ({ key, value }))
}

onMounted(() => {
    store.fetchWorkflows()
    if (store.draftWorkflow) {
        selectedWorkflow.value = store.draftWorkflow
        isEditing.value = true
        editorContent.value = JSON.stringify(store.draftWorkflow, null, 2)
        store.clearDraftWorkflow()
    }
})

const handleSelect = (workflow: any) => {
    selectedWorkflow.value = workflow
    isEditing.value = false
    editorContent.value = JSON.stringify(workflow, null, 2)
}

const handleCreate = () => {
    const newWorkflow = {
        id: 'workflow_' + Date.now(),
        name: t('workflows.newWorkflow'),
        description: t('workflows.descPlaceholder'),
        steps: []
    }
    selectedWorkflow.value = newWorkflow
    isEditing.value = true
    viewMode.value = 'visual'
    editorContent.value = JSON.stringify(newWorkflow, null, 2)
}

const handleSave = async () => {
    try {
        const workflow = JSON.parse(editorContent.value)
        await store.saveWorkflow(workflow)
        isEditing.value = false
        selectedWorkflow.value = workflow
    } catch (e: any) {
        alert('Invalid JSON: ' + e.message)
    }
}

const handleDelete = async (id: string) => {
    if (confirm(t('workflows.deleteConfirm'))) {
        await store.deleteWorkflow(id)
        if (selectedWorkflow.value?.id === id) {
            selectedWorkflow.value = null
            isEditing.value = false
        }
    }
}

const executionLogs = ref<{ type: 'info' | 'success' | 'error' | 'warning', message: string }[]>([])
const isRunning = ref(false)

const getLogClass = (log: any) => {
    switch(log.type) {
        case 'success': return 'text-emerald-400'
        case 'error': return 'text-red-400'
        case 'warning': return 'text-yellow-400'
        default: return 'text-gray-300'
    }
}

const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    executionLogs.value.push({
        type,
        message: `[${new Date().toLocaleTimeString()}] ${message}`
    })
}

const executeCurrentWorkflow = async () => {
    if (!selectedWorkflow.value) return
    
    // Check if modified or new (not on disk)
    // We assume if it's not in the store list, it's not saved to disk yet
    const exists = store.workflows.some((w: any) => w.id === selectedWorkflow.value.id)
    const isModified = JSON.stringify(selectedWorkflow.value, null, 2) !== editorContent.value
    
    if (!exists || isModified) {
        if (confirm(t('workflows.saveToRun') || 'Workflow must be saved before running. Save now?')) {
            await handleSave()
        } else {
            return
        }
    }
    
    await handleRun(selectedWorkflow.value.id)
}

const handleRun = async (id: string, initialContext = {}) => {
    if (isRunning.value) return
    
    isRunning.value = true
    executionLogs.value = [] // Clear previous logs
    addLog(`Starting workflow: ${id}`, 'info')

    // Subscribe to progress
    const unsubscribe = window.electron.onWorkflowProgress((data: any) => {
        const { stepId, status, output } = data
        if (status === 'running') {
            addLog(`Executing Step ${stepId}...`, 'info')
        } else if (status === 'completed') {
            addLog(`Step ${stepId} completed.`, 'success')
            if (output) {
                const outStr = typeof output === 'object' ? JSON.stringify(output) : String(output)
                addLog(`Output: ${outStr.substring(0, 200)}${outStr.length > 200 ? '...' : ''}`, 'info')
            }
        } else if (status === 'failed') {
            addLog(`Step ${stepId} failed: ${output}`, 'error')
        }
    })

    try {
        const result = await window.electron.executeWorkflow(id, initialContext)
        addLog('Workflow Execution Completed Successfully!', 'success')
        addLog('Final Result Context:\n' + JSON.stringify(result, null, 2), 'info')
    } catch (e: any) {
        addLog(`Workflow Execution Failed: ${e.message}`, 'error')
    } finally {
        isRunning.value = false
        if (unsubscribe) unsubscribe()
    }
}

const handleStop = async () => {
    if (!selectedWorkflow.value) return
    try {
        await window.electron.stopWorkflow(selectedWorkflow.value.id)
        addLog('Stopping workflow...', 'warning')
    } catch (e: any) {
        console.error(e)
    }
}
</script>

<template>
    <div class="h-full flex flex-col bg-gray-900 text-white">
        <!-- New Header -->
        <div class="h-16 px-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-gray-900/50 backdrop-blur-xl">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-indigo-500/10 rounded-lg">
                    <Workflow class="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                    <h2 class="text-lg font-medium text-white">{{ t('workflows.title') }}</h2>
                    <p class="text-xs text-gray-400">{{ t('workflows.subtitle') || 'Automate your tasks' }}</p>
                </div>
            </div>
            
             <button 
                @click="handleCreate" 
                class="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
             >
                 <Plus class="w-4 h-4" />
                 <span>{{ t('workflows.newWorkflow') }}</span>
             </button>
        </div>

        <!-- Content Area -->
        <div class="flex-1 flex gap-4 p-4 overflow-hidden">
            <!-- List (Sidebar) -->
            <div class="w-72 shrink-0 flex flex-col bg-[#1c1c21]/80 border border-white/5 rounded-2xl overflow-hidden">
                 <div class="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                     <div 
                        v-for="wf in store.workflows" 
                        :key="wf.id"
                        @click="handleSelect(wf)"
                        class="p-4 rounded-xl border transition-all cursor-pointer group"
                        :class="selectedWorkflow?.id === wf.id ? 'bg-white/10 border-indigo-500/50' : 'bg-transparent border-white/5 hover:bg-white/5'"
                     >
                        <div class="flex items-start justify-between mb-2">
                            <div class="flex items-center gap-2">
                                <FileText class="w-4 h-4 text-indigo-400" />
                                <h3 class="font-medium text-white truncate text-sm">{{ wf.name }}</h3>
                            </div>
                            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button @click.stop="handleRun(wf.id)" class="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors" :title="t('workflows.run')">
                                     <Play class="w-3.5 h-3.5" />
                                 </button>
                                 <button @click.stop="handleDelete(wf.id)" class="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" title="Delete">
                                     <Trash2 class="w-3.5 h-3.5" />
                                 </button>
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 line-clamp-2">{{ wf.description }}</p>
                        <div class="mt-2 text-[10px] text-gray-600 font-mono">{{ wf.steps?.length || 0 }} {{ t('workflows.steps') }}</div>
                     </div>
                 </div>
            </div>

            <!-- Editor & Execution -->
            <div class="flex-1 min-w-0 flex flex-col gap-4 overflow-hidden">
                <!-- Editor -->
                <div class="flex-1 min-w-0 bg-[#1c1c21]/80 border border-white/5 rounded-2xl overflow-hidden flex flex-col">
                    <div v-if="selectedWorkflow" class="h-full flex flex-col">
                        <div class="h-10 border-b border-white/5 flex items-center justify-between px-4 bg-black/20 shrink-0">
                            <span class="text-xs font-mono text-gray-400 flex items-center gap-2">
                                <FileText class="w-3 h-3" />
                                {{ selectedWorkflow.id }}.json
                            </span>
                            
                            <!-- View Toggle -->
                            <div class="flex items-center bg-black/40 rounded-lg p-0.5 mx-4 border border-white/5">
                                <button 
                                    @click="viewMode = 'visual'"
                                    class="px-2 py-1 rounded-md text-[10px] font-medium flex items-center gap-1.5 transition-all"
                                    :class="viewMode === 'visual' ? 'bg-indigo-500/20 text-indigo-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'"
                                >
                                    <LayoutTemplate class="w-3 h-3" />
                                    Visual
                                </button>
                                <button 
                                    @click="viewMode = 'code'"
                                    class="px-2 py-1 rounded-md text-[10px] font-medium flex items-center gap-1.5 transition-all"
                                    :class="viewMode === 'code' ? 'bg-indigo-500/20 text-indigo-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'"
                                >
                                    <Code class="w-3 h-3" />
                                    Code
                                </button>
                            </div>

                            <div class="flex items-center gap-2">
                                <button 
                                    v-if="isEditing || JSON.stringify(selectedWorkflow, null, 2) !== editorContent" 
                                    @click="handleSave" 
                                    class="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-medium rounded-lg transition-colors"
                                >
                                    <Save class="w-3 h-3" />
                                    {{ t('workflows.save') }}
                                </button>
                                <button 
                                    v-if="isRunning"
                                    @click="handleStop" 
                                    class="flex items-center gap-1.5 px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-[10px] font-medium rounded-lg transition-colors animate-pulse"
                                >
                                    <Square class="w-3 h-3 fill-current" />
                                    {{ t('workflows.stop') }}
                                </button>
                                <button 
                                    v-else
                                    @click="executeCurrentWorkflow" 
                                    class="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-medium rounded-lg transition-colors"
                                >
                                    <Play class="w-3 h-3" />
                                    {{ t('workflows.run') }}
                                </button>
                            </div>
                        </div>
                        <div class="flex-1 min-w-0 overflow-hidden relative" v-if="viewMode === 'code'">
                            <Codemirror
                                v-model="editorContent"
                                placeholder="Wrapper for your workflow JSON..."
                                :style="{ height: '100%' }"
                                :autofocus="true"
                                :indent-with-tab="true"
                                :tab-size="2"
                                :extensions="[json(), oneDark]"
                            />
                        </div>
                        
                        <!-- Visual View -->
                        <div class="flex-1 min-w-0 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#18181b]" v-else>
                            <div v-if="!selectedWorkflow.steps || selectedWorkflow.steps.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-500">
                                <Square class="w-12 h-12 mb-3 opacity-20 dashed" />
                                <p class="text-sm">No steps defined yet.</p>
                                <p class="text-xs opacity-60 mt-1">Switch to Code view to add steps.</p>
                            </div>

                            <div 
                                v-for="(step, index) in selectedWorkflow.steps" 
                                :key="index"
                                class="relative pl-6 group"
                            >
                                <!-- Timeline Line -->
                                <div class="absolute left-[11px] top-8 bottom-[-16px] w-[2px] bg-white/5 group-last:hidden"></div>
                                
                                <div class="bg-white/5 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors relative">
                                    <div class="flex items-start gap-4">
                                        <!-- Step Icon -->
                                        <div class="p-2.5 rounded-lg bg-black/30 border border-white/5 shrink-0 relative">
                                             <!-- Running Indicator -->
                                            <span v-if="isRunning && executionLogs.some(l => l.message.includes(`Step ${step.id} completed`))" class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#18181b]"></span>
                                            <span v-else-if="isRunning && executionLogs[executionLogs.length-1]?.message?.includes(`Executing Step ${step.id}`)" class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-500 rounded-full ring-2 ring-[#18181b] animate-pulse"></span>
                                            
                                            <component :is="getStepIcon(step)" class="w-5 h-5 text-indigo-400" />
                                        </div>

                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center justify-between mb-2">
                                                <div>
                                                    <h4 class="text-sm font-medium text-white flex items-center gap-2">
                                                        {{ step.name || step.id || `Step ${Number(index) + 1}` }}
                                                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400 font-mono">{{ step.skillId || step.type }}</span>
                                                    </h4>
                                                    <p v-if="step.description" class="text-xs text-gray-500 mt-0.5">{{ step.description }}</p>
                                                </div>
                                                <div class="text-[10px] font-mono text-gray-600">ID: {{ step.id }}</div>
                                            </div>

                                            <!-- Params Preview -->
                                            <div v-if="step.params" class="bg-black/20 rounded-lg border border-white/5 p-2 mt-3 block">
                                                <div class="grid grid-cols-1 gap-1">
                                                    <div v-for="(value, key) in step.params" :key="key" class="flex items-start text-xs font-mono">
                                                        <span class="text-gray-500 w-24 shrink-0 truncate">{{ key }}:</span>
                                                        <span class="text-indigo-300 break-all">{{ typeof value === 'object' ? JSON.stringify(value) : value }}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div v-else class="text-xs text-gray-600 italic mt-2">No parameters</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-else class="h-full flex items-center justify-center text-gray-600 flex-col gap-3">
                        <Workflow class="w-10 h-10 opacity-20" />
                        <p class="text-sm">{{ t('workflows.selectPrompt') }}</p>
                    </div>
                </div>

                <!-- Execution Logs -->
                <div class="h-1/3 min-w-0 bg-[#0a0a0c] border border-white/10 rounded-xl overflow-hidden flex flex-col">
                    <div class="h-8 border-b border-white/5 flex items-center px-4 bg-white/5 shrink-0 justify-between">
                        <span class="text-xs font-medium text-gray-400">{{ t('workflows.executionOutput') }}</span>
                        <div v-if="isRunning" class="flex items-center gap-2">
                             <span class="text-[10px] text-emerald-400">Running...</span>
                             <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        </div>
                    </div>
                    <div class="flex-1 p-3 overflow-auto font-mono text-[11px] space-y-1 custom-scrollbar">
                        <div v-if="executionLogs.length === 0" class="text-gray-600 italic">{{ t('workflows.noLogs') }}</div>
                        <div v-for="(log, i) in executionLogs" :key="i" class="whitespace-pre-wrap break-all" :class="getLogClass(log)">
                            {{ log.message }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
