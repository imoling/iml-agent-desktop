<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Trash2, Search, Plus, Database, X, FileText } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

console.log('[MemoryView] Setup started')

const { t } = useI18n()

interface MemoryItem {
    id: string;
    content: string;
    metadata: any;
}

const items = ref<MemoryItem[]>([])
const searchQuery = ref('')
const isLoading = ref(false)
const isAdding = ref(false)
const showAddDialog = ref(false)
const newItemContent = ref('')
const viewMode = ref<'all' | 'sources'>('all')

const uniqueSources = computed(() => {
    const sources = new Map<string, number>()
    // Use filtered items so search works on sources too
    filteredItems.value.forEach(item => {
        const sourceName = item.metadata?.source || 'Unknown'
        sources.set(sourceName, (sources.get(sourceName) || 0) + 1)
    })
    
    return Array.from(sources.entries()).map(([name, count]) => ({
        name,
        count
    })).sort((a, b) => b.count - a.count)
})

const deleteSource = async (source: string) => {
    if (confirm(`Are you sure you want to delete ALL ${source} memories? This cannot be undone.`)) {
        isLoading.value = true
        try {
            const count = await window.electron.memoryDeleteBySource(source)
            // await loadItems() // Refresh list
             // Optimistic update or refresh? Refresh is safer.
             await loadItems()
             alert(`Deleted ${count} items from ${source}`)
        } catch (e: any) {
            console.error('Failed to delete source:', e)
            alert('Failed to delete source: ' + e.message)
        } finally {
            isLoading.value = false
        }
    }
}

const filteredItems = computed(() => {
    if (!searchQuery.value) return items.value
    const q = searchQuery.value.toLowerCase()
    items.value.forEach(item => {
       if (!item.metadata) item.metadata = {}
    })
    return items.value.filter(item => 
        item.content.toLowerCase().includes(q) || 
        JSON.stringify(item.metadata).toLowerCase().includes(q)
    )
})

const loadItems = async () => {
    isLoading.value = true
    try {
        if (window.electron && window.electron.memoryList) {
             items.value = await window.electron.memoryList() || []
        }
    } catch (e) {
        console.error('Failed to list memory:', e)
    } finally {
        isLoading.value = false
    }
}

const deleteItem = async (id: string) => {
    if (confirm(t('memory.confirmDelete'))) {
        try {
            await window.electron.memoryDelete(id)
            await loadItems()
        } catch (e) {
            console.error('Failed to delete item:', e)
        }
    }
}

const addItem = async () => {
    if (!newItemContent.value.trim()) return
    
    isAdding.value = true
    try {
        await window.electron.memoryAdd(newItemContent.value, { source: 'manual', timestamp: Date.now() })
        newItemContent.value = ''
        showAddDialog.value = false
        await loadItems()
    } catch (e) {
        console.error('Failed to add item:', e)
        alert('Failed to add item: ' + e)
    } finally {
        isAdding.value = false
    }
}

onMounted(async () => {
    console.log('[MemoryView] Component mounted');
    // Short delay to ensure electron bridge is ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (typeof window.electron?.memoryList === 'function') {
        console.log('[MemoryView] Electron API found, loading items...');
        await loadItems();
    } else {
        console.error('[MemoryView] window.electron.memoryList is not available');
        // Retry once after 1s
        setTimeout(() => {
            if (typeof window.electron?.memoryList === 'function') loadItems();
        }, 1000);
    }
})
</script>

<template>
    <div class="h-full flex flex-col bg-gray-900 text-white">
        <!-- Header -->
        <div class="h-16 px-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-gray-900/50 backdrop-blur-xl">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-indigo-500/10 rounded-lg">
                    <Database class="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                    <h2 class="text-lg font-medium text-white">{{ t('memory.title') }}</h2>
                    <p class="text-xs text-gray-400">{{ t('memory.subtitle') }}</p>
                </div>
            </div>
            <button 
                @click="showAddDialog = true"
                class="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
                <Plus class="w-4 h-4" />
                {{ t('memory.add') }}
            </button>
        </div>

        <!-- View Toggle & Search Bar -->
        <div class="p-4 border-b border-white/5 space-y-3">
             <div class="flex items-center gap-2 p-1 bg-black/20 rounded-lg w-fit border border-white/5">
                <button 
                    @click="viewMode = 'all'"
                    class="px-3 py-1 text-xs font-medium rounded-md transition-all"
                    :class="viewMode === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'"
                >
                    All Items
                </button>
                <button 
                    @click="viewMode = 'sources'"
                    class="px-3 py-1 text-xs font-medium rounded-md transition-all"
                    :class="viewMode === 'sources' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'"
                >
                    Sources (Files)
                </button>
            </div>

            <div class="relative group">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                    v-model="searchQuery"
                    type="text" 
                    :placeholder="t('memory.searchPlaceholder')" 
                    class="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-gray-200 focus:outline-none focus:border-indigo-500/50 focus:bg-black/40 transition-all placeholder:text-gray-600"
                />
            </div>
        </div>

        <!-- Content List -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            <div v-if="isLoading" class="flex justify-center py-8">
                <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>

            <div v-else-if="(viewMode === 'all' && filteredItems.length === 0) || (viewMode === 'sources' && uniqueSources.length === 0)" class="flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
                <Database class="w-12 h-12 opacity-20" />
                <p v-if="searchQuery">{{ t('memory.noResults') }}</p>
                <p v-else>{{ t('memory.empty') }}</p>
            </div>

            <!-- All Items View -->
            <template v-if="viewMode === 'all'">
                <div 
                    v-for="item in filteredItems" 
                    :key="item.id"
                    class="group relative bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all duration-200"
                >
                    <div class="flex items-start justify-between gap-4">
                        <div class="flex-1 space-y-2">
                            <p class="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-mono">{{ item.content }}</p>
                            
                            <div class="flex items-center gap-3 pt-2">
                                <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-black/5 text-gray-500">
                                    ID: {{ item.id.substring(0, 8) }}
                                </span>
                                <span v-if="item.metadata.timestamp" class="text-[10px] text-gray-500">
                                    {{ new Date(item.metadata.timestamp).toLocaleString() }}
                                </span>
                                 <span v-if="item.metadata.source" class="text-[10px] text-gray-500">
                                    Source: {{ item.metadata.source }}
                                </span>
                            </div>
                        </div>
                        
                        <button 
                            @click="deleteItem(item.id)"
                            class="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete"
                        >
                            <Trash2 class="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </template>

            <!-- Sources View -->
            <template v-else>
                 <div 
                    v-for="source in uniqueSources" 
                    :key="source.name"
                    class="group relative bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all duration-200"
                >
                    <div class="flex items-center justify-between gap-4">
                        <div class="flex items-center gap-4">
                            <div class="p-3 bg-indigo-500/10 rounded-lg text-indigo-400">
                                <FileText class="w-5 h-5" />
                            </div>
                            <div>
                                <h4 class="text-sm font-medium text-white">{{ source.name }}</h4>
                                <p class="text-xs text-gray-500 mt-1">{{ source.count }} chunks stored</p>
                            </div>
                        </div>

                        <button 
                            @click="deleteSource(source.name)"
                            class="px-3 py-1.5 bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-gray-400 text-xs font-medium rounded-lg transition-colors flex items-center gap-2"
                        >
                             <Trash2 class="w-3.5 h-3.5" />
                             Delete All
                        </button>
                    </div>
                </div>
            </template>
        </div>

        <!-- Add Dialog -->
        <div v-if="showAddDialog" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div class="w-full max-w-lg bg-[#1a1b1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div class="h-14 px-5 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <h3 class="text-sm font-medium text-white">{{ t('memory.addDialogTitle') }}</h3>
                    <button @click="showAddDialog = false" class="text-gray-400 hover:text-white transition-colors">
                        <X class="w-4 h-4" />
                    </button>
                </div>
                
                <div class="p-5 overflow-y-auto">
                    <textarea 
                        v-model="newItemContent"
                        class="w-full h-48 bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-gray-200 focus:outline-none focus:border-indigo-500/50 focus:bg-black/30 transition-all resize-none placeholder:text-gray-600 font-mono"
                        :placeholder="t('memory.addPlaceholder')"
                        autofocus
                    ></textarea>
                     <p class="mt-2 text-xs text-gray-500">
                        This content will be embedded and stored in the vector database for long-term retrieval.
                    </p>
                </div>

                <div class="h-16 px-5 border-t border-white/5 flex items-center justify-end gap-3 bg-white/5">
                    <button 
                        @click="showAddDialog = false"
                        class="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
                    >
                        {{ t('common.cancel') }}
                    </button>
                    <button 
                        @click="addItem"
                        :disabled="!newItemContent.trim() || isAdding"
                        class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                        <div v-if="isAdding" class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <Plus v-else class="w-3.5 h-3.5" />
                        {{ isAdding ? 'Initializing AI...' : t('common.add') }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
}
</style>
