<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
    currentTokens: number
    maxTokens: number
    safeLimit: number
    compressed?: boolean
    savedTokens?: number
}>()

const percentage = computed(() => {
    return Math.min((props.currentTokens / props.safeLimit) * 100, 100)
})

const status = computed(() => {
    if (props.currentTokens > props.safeLimit) return 'danger'
    if (props.currentTokens > props.safeLimit * 0.8) return 'warning'
    return 'safe'
})

const statusColor = computed(() => {
    switch (status.value) {
        case 'danger': return 'bg-red-500'
        case 'warning': return 'bg-yellow-500'
        default: return 'bg-emerald-500'
    }
})
</script>

<template>
    <!-- Compact Progress Bar Only -->
    <div class="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div 
            :class="['h-full transition-all duration-300', statusColor]"
            :style="{ width: `${percentage}%` }"
        />
    </div>
</template>
