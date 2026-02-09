# MemoryUsageIndicator 集成指南

本文档说明如何将 MemoryUsageIndicator 组件集成到 ChatInterface.vue 中，以显示 AI 使用的记忆。

## 1. 导入组件

在 `ChatInterface.vue` 的 script 部分添加导入：

```typescript
import MemoryUsageIndicator from './MemoryUsageIndicator.vue'
```

## 2. 添加状态管理

```typescript
// Memory Usage State
const messageMemoryUsage = ref<Record<string, any[]>>({})

// 获取消息的记忆使用情况
const fetchMemoryUsage = async (messageId: string, query: string) => {
    try {
        const result = await window.electron.memoryGetUsageForMessage(messageId, query)
        if (result.success && result.memoryUsage.length > 0) {
            messageMemoryUsage.value[messageId] = result.memoryUsage
        }
    } catch (error) {
        console.error('Failed to fetch memory usage:', error)
    }
}
```

## 3. 在消息发送时触发记忆检索

在发送用户消息后，自动检索相关记忆：

```typescript
const sendMessage = async () => {
    // ... 现有发送逻辑 ...
    
    // 发送消息后，检索相关记忆
    if (currentInput.value.trim()) {
        const userMessage = messages.value[messages.value.length - 1]
        if (userMessage) {
            // 异步获取记忆使用情况
            fetchMemoryUsage(userMessage.id, currentInput.value)
        }
    }
}
```

## 4. 在模板中显示记忆使用指示器

在 AI 消息内容下方添加 MemoryUsageIndicator：

```vue
<div v-for="(msg, index) in messages" :key="msg.id" class="message-item">
    <!-- 消息内容 -->
    <div class="message-content">
        <!-- ... 现有内容 ... -->
        
        <!-- 消息文本 -->
        <div v-if="msg.role === 'assistant'" class="markdown-content" v-html="renderMessage(msg.content)"></div>
        <div v-else class="whitespace-pre-wrap">{{ msg.content }}</div>
        
        <!-- 记忆使用指示器 (仅 AI 消息) -->
        <MemoryUsageIndicator
            v-if="msg.role === 'assistant' && messageMemoryUsage[msg.id]?.length > 0"
            :memory-usage="messageMemoryUsage[msg.id]"
        />
    </div>
</div>
```

## 5. 完整示例

```vue
<template>
    <div class="chat-interface">
        <!-- 消息列表 -->
        <div v-for="(msg, index) in messages" :key="msg.id" class="flex items-start gap-4">
            <!-- Avatar -->
            <div class="avatar">
                <Bot v-if="msg.role === 'assistant'" />
                <User v-else />
            </div>
            
            <!-- Content -->
            <div class="flex-1">
                <!-- Message Text -->
                <div v-if="msg.role === 'assistant'" v-html="renderMessage(msg.content)"></div>
                <div v-else>{{ msg.content }}</div>
                
                <!-- Memory Usage Indicator -->
                <MemoryUsageIndicator
                    v-if="msg.role === 'assistant' && messageMemoryUsage[msg.id]?.length > 0"
                    :memory-usage="messageMemoryUsage[msg.id]"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MemoryUsageIndicator from './MemoryUsageIndicator.vue'

const messages = ref([])
const messageMemoryUsage = ref<Record<string, any[]>>({})

const fetchMemoryUsage = async (messageId: string, query: string) => {
    try {
        const result = await window.electron.memoryGetUsageForMessage(messageId, query)
        if (result.success && result.memoryUsage.length > 0) {
            messageMemoryUsage.value[messageId] = result.memoryUsage
        }
    } catch (error) {
        console.error('Failed to fetch memory usage:', error)
    }
}

const sendMessage = async () => {
    // 发送消息逻辑
    // ...
    
    // 检索记忆
    const lastUserMessage = messages.value.findLast(m => m.role === 'user')
    if (lastUserMessage) {
        fetchMemoryUsage(lastUserMessage.id, lastUserMessage.content)
    }
}
</script>
```

## 6. 高级功能

### 6.1 实时记忆检索

在 AI 开始回复时就检索记忆：

```typescript
const handleAIResponse = async (userQuery: string) => {
    // 立即检索记忆
    const result = await window.electron.memoryGetUsageForMessage('temp-id', userQuery)
    
    // 开始 AI 回复
    // ...
}
```

### 6.2 缓存记忆使用

避免重复检索相同消息的记忆：

```typescript
const fetchMemoryUsage = async (messageId: string, query: string) => {
    // 检查缓存
    if (messageMemoryUsage.value[messageId]) {
        return
    }
    
    // 检索并缓存
    const result = await window.electron.memoryGetUsageForMessage(messageId, query)
    if (result.success && result.memoryUsage.length > 0) {
        messageMemoryUsage.value[messageId] = result.memoryUsage
    }
}
```

### 6.3 过滤低相关性记忆

只显示相关性高于阈值的记忆：

```typescript
const fetchMemoryUsage = async (messageId: string, query: string) => {
    const result = await window.electron.memoryGetUsageForMessage(messageId, query)
    if (result.success) {
        // 过滤相关性 < 0.5 的记忆
        const relevantMemories = result.memoryUsage.filter(
            (usage: any) => usage.relevanceScore >= 0.5
        )
        
        if (relevantMemories.length > 0) {
            messageMemoryUsage.value[messageId] = relevantMemories
        }
    }
}
```

## 7. 样式定制

### 7.1 调整位置

```vue
<!-- 在消息上方显示 -->
<MemoryUsageIndicator
    v-if="msg.role === 'assistant' && messageMemoryUsage[msg.id]?.length > 0"
    :memory-usage="messageMemoryUsage[msg.id]"
    class="mb-3"  <!-- 添加底部间距 -->
/>
<div v-html="renderMessage(msg.content)"></div>
```

### 7.2 自定义样式

```vue
<MemoryUsageIndicator
    v-if="msg.role === 'assistant' && messageMemoryUsage[msg.id]?.length > 0"
    :memory-usage="messageMemoryUsage[msg.id]"
    class="custom-memory-indicator"
/>

<style scoped>
.custom-memory-indicator {
    margin: 1rem 0;
    opacity: 0.9;
}
</style>
```

## 8. 性能优化

### 8.1 懒加载

只在用户展开时才加载记忆：

```typescript
const loadMemoryOnExpand = async (messageId: string, query: string) => {
    if (!messageMemoryUsage.value[messageId]) {
        await fetchMemoryUsage(messageId, query)
    }
}
```

### 8.2 限制检索数量

```typescript
// 在 IPC handler 中已经限制为 5 条
// 如果需要更多或更少，可以调整 limit 参数
const result = await window.electron.memoryGetUsageForMessage(messageId, query, { limit: 3 })
```

## 9. 用户体验建议

1. **默认折叠**：记忆指示器默认折叠，不干扰阅读
2. **视觉提示**：使用图标和颜色区分不同分类的记忆
3. **相关性排序**：最相关的记忆排在最前面
4. **加密提示**：清晰标识加密记忆，需要解锁才能查看
5. **性能优先**：异步加载，不阻塞消息显示

## 10. 故障排除

### 问题：记忆不显示

**解决方案**：
1. 检查是否有相关记忆存在
2. 确认相关性评分是否过低
3. 查看控制台错误日志

### 问题：加密记忆无法解密

**解决方案**：
1. 确认加密服务已解锁
2. 检查主密码是否正确
3. 查看 `window.electron.memoryDecrypt` 是否可用

### 问题：性能问题

**解决方案**：
1. 减少检索的记忆数量
2. 添加缓存机制
3. 使用虚拟滚动（大量消息时）

## 11. 类型定义

```typescript
interface MemoryUsage {
    memory: EnhancedMemory
    relevanceScore: number  // 0-1
    usedAt: number
}

interface EnhancedMemory {
    id: string
    content: string
    encrypted: boolean
    category: 'personal' | 'project' | 'preference' | 'credential' | 'temporary'
    priority: 'high' | 'medium' | 'low'
    tags: string[]
    expiresAt?: number
    createdAt: number
    updatedAt: number
    source: string
    metadata: Record<string, any>
}
```
