<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircle2, Circle, CircleDashed, Loader2 } from 'lucide-vue-next'
import { useMasking } from '../composables/useMasking'

const props = defineProps<{
  plan: Array<{ id: string; description: string; status: 'pending' | 'in-progress' | 'completed' }>
}>()

const { mask } = useMasking()

const completedCount = computed(() => props.plan.filter(s => s.status === 'completed').length)
const totalCount = computed(() => props.plan.length)
const progress = computed(() => totalCount.value === 0 ? 0 : (completedCount.value / totalCount.value) * 100)
</script>

<template>
  <div class="bg-[#16161a] border border-white/10 rounded-xl overflow-hidden my-4 shadow-lg">
    <!-- Header -->
    <div class="bg-white/5 px-4 py-3 flex items-center justify-between border-b border-white/5">
      <h3 class="text-sm font-semibold text-gray-200 flex items-center gap-2">
        <div class="flex items-center justify-center w-5 h-5 rounded bg-indigo-500/20 text-indigo-400">
             <span class="text-xs font-bold">{{ completedCount }}/{{ totalCount }}</span>
        </div>
        Execution Plan
      </h3>
      <div class="w-24 h-1.5 bg-black/40 rounded-full overflow-hidden">
        <div class="h-full bg-indigo-500 transition-all duration-500 ease-out" :style="{ width: `${progress}%` }"></div>
      </div>
    </div>

    <!-- Steps List -->
    <div class="p-2">
      <div 
        v-for="step in plan" 
        :key="step.id"
        class="flex items-start gap-3 p-2 rounded-lg transition-colors duration-200"
        :class="step.status === 'in-progress' ? 'bg-indigo-500/10 border border-indigo-500/20' : 'hover:bg-white/5'"
      >
        <!-- Icon -->
        <div class="mt-0.5 shrink-0">
            <CheckCircle2 v-if="step.status === 'completed'" class="w-5 h-5 text-emerald-400" />
            <div v-else-if="step.status === 'in-progress'" class="w-5 h-5 text-indigo-400 animate-spin">
                <Loader2 class="w-5 h-5" />
            </div>
            <Circle v-else class="w-5 h-5 text-gray-600" />
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
            <p 
                class="text-sm leading-relaxed"
                :class="{
                    'text-gray-500 line-through': step.status === 'completed',
                    'text-indigo-200 font-medium': step.status === 'in-progress',
                    'text-gray-300': step.status === 'pending'
                }"
            >
                {{ mask(step.description) }}
            </p>
        </div>
      </div>
    </div>
  </div>
</template>
