# ChatInterface 集成指南

本文档说明如何将 MemoryButton 和 MemoryDialog 组件集成到 ChatInterface.vue 中。

## 1. 导入组件

在 `ChatInterface.vue` 的 script 部分添加导入：

```typescript
import MemoryButton from './MemoryButton.vue'
import MemoryDialog from './MemoryDialog.vue'
```

## 2. 添加状态管理

```typescript
// Memory Dialog State
const showMemoryDialog = ref(false)
const memoryDialogContent = ref('')
const currentMemoryMessageId = ref<string | null>(null)

// 打开记忆对话框
const openMemoryDialog = (content: string, messageId: string) => {
    memoryDialogContent.value = content
    currentMemoryMessageId.value = messageId
    showMemoryDialog.value = true
}

// 保存记忆
const handleSaveMemory = async (memoryData: any) => {
    try {
        const result = await window.electron.memoryAddManual({
            ...memoryData,
            metadata: {
                conversationId: chatStore.currentSessionId,
                messageId: currentMemoryMessageId.value
            }
        })
        
        if (result.success) {
            console.log('Memory saved successfully:', result.memory)
            showMemoryDialog.value = false
            
            // 可选：显示成功提示
            // showNotification('记忆已保存')
        } else {
            console.error('Failed to save memory:', result.error)
            // 可选：显示错误提示
        }
    } catch (error) {
        console.error('Error saving memory:', error)
    }
}
```

## 3. 在模板中集成

### 3.1 在消息操作工具栏中添加 MemoryButton

找到消息的操作工具栏部分（约 1569 行），在复制和编辑按钮旁边添加：

```vue
<!-- Action Toolbar (Visible on Hover) -->
<div class="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-gray-900/90 backdrop-blur border border-white/10 rounded-md px-1 py-0.5 z-10 shadow-lg">
    <!-- 复制按钮 -->
    <button 
        @click="copyToClipboard(msg.content, msg.id)" 
        class="p-1.5 hover:bg-white/20 rounded transition-colors"
        :class="copiedId === msg.id ? 'text-emerald-400' : 'text-gray-300 hover:text-white'"
        :title="copiedId === msg.id ? '已复制' : '复制内容'"
    >
        <Check v-if="copiedId === msg.id" class="w-3.5 h-3.5" />
        <Copy v-else class="w-3.5 h-3.5" />
    </button>
    
    <!-- 编辑按钮 -->
    <button 
        @click="startEditing(msg)" 
        class="p-1.5 hover:bg-white/20 rounded text-gray-300 hover:text-white transition-colors"
        title="编辑消息"
    >
        <Edit2 class="w-3.5 h-3.5" />
    </button>
    
    <!-- 记忆按钮 (新增) -->
    <div class="border-l border-white/10 ml-1 pl-1">
        <MemoryButton 
            :message-id="msg.id"
            @click="openMemoryDialog(msg.content, msg.id)"
        />
    </div>
</div>
```

### 3.2 在根元素中添加 MemoryDialog

在 ChatInterface 的根 div 末尾（模板最后），添加对话框：

```vue
<!-- Memory Dialog -->
<MemoryDialog
    v-if="showMemoryDialog"
    :initial-content="memoryDialogContent"
    @save="handleSaveMemory"
    @close="showMemoryDialog = false"
/>
```

## 4. 完整示例

```vue
<template>
    <div class="chat-interface">
        <!-- 现有的聊天界面内容 -->
        
        <!-- 消息列表 -->
        <div v-for="(msg, index) in messages" :key="msg.id" class="message-item group">
            <!-- 消息内容 -->
            <div class="message-content">
                <!-- ... 现有内容 ... -->
                
                <!-- 操作工具栏 -->
                <div class="action-toolbar">
                    <button @click="copyToClipboard(msg.content, msg.id)">
                        <Copy class="w-3.5 h-3.5" />
                    </button>
                    <button @click="startEditing(msg)">
                        <Edit2 class="w-3.5 h-3.5" />
                    </button>
                    
                    <!-- 记忆按钮 -->
                    <MemoryButton 
                        :message-id="msg.id"
                        @click="openMemoryDialog(msg.content, msg.id)"
                    />
                </div>
            </div>
        </div>
        
        <!-- 记忆对话框 -->
        <MemoryDialog
            v-if="showMemoryDialog"
            :initial-content="memoryDialogContent"
            @save="handleSaveMemory"
            @close="showMemoryDialog = false"
        />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MemoryButton from './MemoryButton.vue'
import MemoryDialog from './MemoryDialog.vue'

// ... 现有代码 ...

// Memory Dialog State
const showMemoryDialog = ref(false)
const memoryDialogContent = ref('')
const currentMemoryMessageId = ref<string | null>(null)

const openMemoryDialog = (content: string, messageId: string) => {
    memoryDialogContent.value = content
    currentMemoryMessageId.value = messageId
    showMemoryDialog.value = true
}

const handleSaveMemory = async (memoryData: any) => {
    try {
        const result = await window.electron.memoryAddManual({
            ...memoryData,
            metadata: {
                conversationId: chatStore.currentSessionId,
                messageId: currentMemoryMessageId.value
            }
        })
        
        if (result.success) {
            console.log('Memory saved successfully:', result.memory)
            showMemoryDialog.value = false
        } else {
            console.error('Failed to save memory:', result.error)
        }
    } catch (error) {
        console.error('Error saving memory:', error)
    }
}
</script>
```

## 5. 可选功能

### 5.1 显示已记忆状态

如果需要显示消息是否已被记忆，可以：

1. 在消息对象中添加 `isMemorized` 字段
2. 传递给 MemoryButton：

```vue
<MemoryButton 
    :message-id="msg.id"
    :is-memorized="msg.isMemorized"
    @click="openMemoryDialog(msg.content, msg.id)"
/>
```

### 5.2 编辑已有记忆

如果消息已经被记忆，可以传递现有记忆数据进行编辑：

```vue
<MemoryDialog
    v-if="showMemoryDialog"
    :initial-memory="currentMemory"
    :is-edit="!!currentMemory"
    @save="handleSaveMemory"
    @close="showMemoryDialog = false"
/>
```

## 6. 注意事项

1. **加密状态**：如果加密服务未解锁，保存加密记忆会失败
2. **错误处理**：建议添加用户友好的错误提示
3. **成功反馈**：保存成功后可以显示 toast 通知
4. **性能**：大量消息时，考虑虚拟滚动优化

## 7. 类型定义

如果使用 TypeScript，建议在 `window.d.ts` 中添加类型定义：

```typescript
interface Window {
    electron: {
        // ... 现有方法 ...
        memoryAddManual: (options: {
            content: string
            category?: 'personal' | 'project' | 'preference' | 'credential' | 'temporary'
            priority?: 'high' | 'medium' | 'low'
            tags?: string[]
            expiresAt?: number
            encrypted?: boolean
            metadata?: Record<string, any>
        }) => Promise<{ success: boolean; memory?: any; error?: string }>
        
        memorySuggestCategory: (content: string) => Promise<{ success: boolean; category?: string }>
        // ... 其他记忆相关方法 ...
    }
}
```
