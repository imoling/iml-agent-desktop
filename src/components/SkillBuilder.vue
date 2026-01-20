<script setup lang="ts">
import { ref } from 'vue'
import { Hammer, Save, Plus, Trash2, FileCode } from 'lucide-vue-next'
import { useSkillsStore } from '../stores/skills'

const skillsStore = useSkillsStore()

const name = ref('')
const description = ref('')
const inputs = ref<{name: string, type: string, description: string}[]>([
    { name: '', type: 'string', description: '' }
])
const loading = ref(false)
const errorMessage = ref('')
const createdSkill = ref<{
    name: string,
    description: string,
    inputs: any[],
    path: string
} | null>(null)

const addInput = () => {
    inputs.value.push({ name: '', type: 'string', description: '' })
}

const removeInput = (index: number) => {
    inputs.value.splice(index, 1)
}

const resetForm = () => {
    createdSkill.value = null
    name.value = ''
    description.value = ''
    inputs.value = [{ name: '', type: 'string', description: '' }]
    errorMessage.value = ''
}

const createSkill = async () => {
    if (!name.value || !description.value) {
        errorMessage.value = "Name and Description are required."
        return
    }

    loading.value = true
    errorMessage.value = ''

    try {
        if (window.electron && window.electron.createSkill) {
            const skillData = {
                name: name.value,
                description: description.value,
                inputs: JSON.parse(JSON.stringify(inputs.value.filter(i => i.name))) // Deep clone to remove Vue Proxies
            }
            
            const result = await window.electron.createSkill(skillData)
            
            if (result.success) {
                // Refresh the skills list in the background
                await skillsStore.fetchSkills()

                // Show success view
                createdSkill.value = {
                    ...skillData,
                    path: result.path || 'Unknown location'
                }
            } else {
                errorMessage.value = result.error || 'Failed to create skill'
            }
        }
    } catch (err: any) {
        errorMessage.value = err.message
    } finally {
        loading.value = false
    }
}
</script>

<template>
  <div class="h-full overflow-y-auto px-6 py-4">
    <div class="max-w-3xl mx-auto space-y-8">
      
      <!-- Header -->
      <div>
        <h2 class="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Hammer class="w-8 h-8 text-indigo-400" />
            {{ $t('builder.title') }}
        </h2>
        <p class="text-gray-400">{{ $t('builder.subtitle') }}</p>
      </div>

      <!-- Success View -->
      <div v-if="createdSkill" class="bg-[#16161a] border border-green-500/30 rounded-2xl p-8 space-y-6 shadow-xl relative overflow-hidden animate-fade-in">
          <div class="flex items-center gap-4 mb-6">
              <div class="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                  <FileCode class="w-6 h-6" />
              </div>
              <div>
                  <h3 class="text-xl font-bold text-white">{{ $t('builder.successTitle') }}</h3>
                  <p class="text-green-400 text-sm">{{ $t('builder.successSubtitle') }}</p>
              </div>
          </div>

          <div class="space-y-4">
              <div class="bg-black/30 rounded-xl p-4 space-y-2 border border-white/5">
                  <p class="text-sm text-gray-400">{{ $t('builder.location') }}</p>
                  <code class="text-xs text-indigo-300 font-mono block break-all">{{ createdSkill.path }}</code>
              </div>

               <div class="bg-black/30 rounded-xl p-4 space-y-3 border border-white/5">
                  <h4 class="text-sm font-medium text-white border-b border-white/5 pb-2">{{ $t('builder.configSummary') }}</h4>
                  <div class="grid grid-cols-[100px_1fr] gap-2 text-sm">
                      <span class="text-gray-500">{{ $t('builder.name') }}</span>
                      <span class="text-gray-200 font-mono">{{ createdSkill.name }}</span>
                      
                      <span class="text-gray-500">{{ $t('builder.description') }}</span>
                      <span class="text-gray-200">{{ createdSkill.description }}</span>
                      
                      <span class="text-gray-500">{{ $t('builder.inputs') }}</span>
                      <div class="text-gray-200">
                          <ul class="list-disc list-inside text-xs space-y-1">
                              <li v-for="input in createdSkill.inputs" :key="input.name">
                                  <span class="font-mono text-indigo-300">{{ input.name }}</span> 
                                  <span class="text-gray-500">({{ input.type }})</span>: {{ input.description }}
                              </li>
                          </ul>
                          <span v-if="createdSkill.inputs.length === 0" class="text-gray-500 italic">{{ $t('builder.none') }}</span>
                      </div>
                  </div>
              </div>
          </div>

          <div class="flex gap-4 pt-4">
              <button 
                  @click="resetForm"
                  class="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all border border-white/10"
              >
                  {{ $t('builder.createAnother') }}
              </button>
              <!-- We can't easily nav to skills library without parent event, so we just inform user -->
             <div class="flex-1 px-4 py-3 bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 rounded-xl flex items-center justify-center text-sm">
                 {{ $t('builder.goToSkills') }}
             </div>
          </div>
      </div>

      <!-- Form -->
      <div v-else class="bg-[#16161a] border border-white/10 rounded-2xl p-8 space-y-6 shadow-xl relative overflow-hidden">
        <div v-if="errorMessage" class="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-red-400"></div>
            {{ errorMessage }}
        </div>

        <!-- Basic Info -->
        <div class="space-y-4">
            <div class="space-y-2">
                <label class="text-sm font-medium text-gray-300">{{ $t('builder.skillName') }}</label>
                <input 
                    v-model="name"
                    type="text" 
                    placeholder="e.g. weather-check" 
                    class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-all font-mono text-sm"
                />
                <p class="text-xs text-gray-500">{{ $t('builder.skillNameDesc') }}</p>
            </div>

            <div class="space-y-2">
                <label class="text-sm font-medium text-gray-300">{{ $t('builder.skillDesc') }}</label>
                <textarea 
                    v-model="description"
                    rows="2"
                    :placeholder="$t('builder.skillDescPlaceholder')"
                    class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-all resize-none"
                ></textarea>
            </div>
        </div>

        <div class="h-px bg-white/5 my-6"></div>

        <!-- Input Parameters -->
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <label class="text-sm font-medium text-gray-300">{{ $t('builder.inputParams') }}</label>
                <button @click="addInput" class="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors">
                    <Plus class="w-3 h-3" /> {{ $t('builder.addParam') }}
                </button>
            </div>

            <div v-if="inputs.length === 0" class="text-sm text-gray-500 italic text-center py-4 bg-black/10 rounded-xl">
                {{ $t('builder.noInputs') }}
            </div>

            <div v-for="(input, idx) in inputs" :key="idx" class="flex gap-3 items-start p-3 bg-black/20 rounded-xl border border-white/5">
                <div class="flex-1 space-y-2">
                    <input 
                        v-model="input.name"
                        type="text" 
                        :placeholder="$t('builder.paramName')"
                        class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 font-mono"
                    />
                     <input 
                        v-model="input.description"
                        type="text" 
                        :placeholder="$t('builder.paramDesc')"
                        class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                    />
                </div>
                <div class="w-32">
                     <select v-model="input.type" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 appearance-none">
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                     </select>
                </div>
                <button @click="removeInput(idx)" class="p-2 text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 class="w-4 h-4" />
                </button>
            </div>
        </div>

        <!-- Submit -->
        <div class="pt-6 flex justify-end">
             <button 
              @click="createSkill"
              :disabled="loading"
              class="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-wait"
            >
              <FileCode class="w-5 h-5" />
              {{ loading ? $t('builder.generating') : $t('builder.generate') }}
            </button>
        </div>

      </div>
    </div>
  </div>
</template>
