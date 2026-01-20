<script setup lang="ts">
import { ChevronRight, ChevronDown, Folder, File, Trash2, Edit3 } from 'lucide-vue-next'

const props = defineProps<{
    node: any
    currentPath: string
    expandedFolders: Set<string>
}>()

const emit = defineEmits<{
    (e: 'open', path: string): void
    (e: 'toggle', path: string): void
    (e: 'delete', path: string): void
}>()

const isExpanded = (path: string) => props.expandedFolders.has(path)
</script>

<template>
    <div class="space-y-0.5">
        <div 
            class="group flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-all border border-transparent"
            :class="[
                node.path === currentPath ? 'bg-indigo-500/10 border-indigo-500/20' : 'hover:bg-white/5',
                node.isDir ? 'text-gray-300' : (node.path === currentPath ? 'text-indigo-400 font-medium' : 'text-gray-400')
            ]"
            @click="node.isDir ? $emit('toggle', node.path) : $emit('open', node.path)"
        >
            <div class="flex items-center gap-2 min-w-0">
                <!-- Icon -->
                <div class="flex items-center shrink-0">
                    <template v-if="node.isDir">
                        <ChevronDown v-if="isExpanded(node.path)" class="w-3.5 h-3.5 text-gray-500 mr-0.5" />
                        <ChevronRight v-else class="w-3.5 h-3.5 text-gray-500 mr-0.5" />
                        <Folder class="w-4 h-4" :class="isExpanded(node.path) ? 'text-indigo-400' : 'text-indigo-400/60'" />
                    </template>
                    <File v-else class="w-4 h-4" :class="node.path === currentPath ? 'text-indigo-400' : 'text-gray-500'" />
                </div>
                
                <span class="text-xs truncate tracking-tight">{{ node.name }}</span>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    @click.stop="$emit('delete', node.path)"
                    class="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                >
                    <Trash2 class="w-3 h-3" />
                </button>
            </div>
        </div>

        <!-- Children -->
        <div v-if="node.isDir && isExpanded(node.path)" class="pl-4 border-l border-white/5 ml-3.5 mt-0.5">
            <FileTreeNode 
                v-for="child in node.children" 
                :key="child.path" 
                :node="child" 
                :current-path="currentPath" 
                :expanded-folders="expandedFolders"
                @open="$emit('open', $event)"
                @toggle="$emit('toggle', $event)"
                @delete="$emit('delete', $event)"
            />
        </div>
    </div>
</template>

<style scoped>
/* Any specific styles for the tree node */
</style>
