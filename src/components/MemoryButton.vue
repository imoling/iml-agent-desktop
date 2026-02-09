<template>
    <button
        @click="handleClick"
        :title="title"
        class="memory-button group relative inline-flex items-center justify-center p-1.5 rounded transition-all duration-200"
        :class="[
            isMemorized 
                ? 'text-indigo-400 hover:bg-white/20' 
                : 'text-gray-300 hover:text-white hover:bg-white/20'
        ]"
    >
        <Pin :class="['w-3.5 h-3.5 transition-transform', isMemorized && 'rotate-45']" />
        
        <!-- Tooltip -->

    </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Pin } from 'lucide-vue-next'

interface Props {
    messageId?: string
    isMemorized?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    isMemorized: false
})

const emit = defineEmits<{
    (e: 'click'): void
}>()

const title = computed(() => 
    props.isMemorized ? '查看或编辑记忆' : '将此消息保存为记忆'
)



const handleClick = () => {
    emit('click')
}
</script>

<style scoped>
.memory-button {
    backdrop-filter: blur(8px);
}
</style>
