<template>
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div class="bg-[#1a1a1f] rounded-2xl shadow-2xl w-full max-w-md p-8 border border-white/10">
            <!-- Header -->
            <div class="text-center mb-8">
                <div class="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Lock class="w-8 h-8 text-white" />
                </div>
                <h2 class="text-2xl font-bold text-white mb-2">设置主密码</h2>
                <p class="text-gray-400 text-sm">
                    主密码用于加密敏感记忆，请妥善保管
                </p>
            </div>

            <!-- Form -->
            <form @submit.prevent="handleSubmit" class="space-y-6">
                <!-- Password Input -->
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">
                        主密码
                    </label>
                    <div class="relative">
                        <input
                            v-model="password"
                            :type="showPassword ? 'text' : 'password'"
                            class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:bg-black/40 transition-all"
                            placeholder="输入主密码"
                            required
                            @input="validatePassword"
                        />
                        <button
                            type="button"
                            @click="showPassword = !showPassword"
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                        >
                            <Eye v-if="!showPassword" class="w-5 h-5" />
                            <EyeOff v-else class="w-5 h-5" />
                        </button>
                    </div>
                    
                    <!-- Password Strength Indicator -->
                    <div v-if="password" class="mt-2">
                        <div class="flex items-center gap-2 mb-1">
                            <div class="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                    :class="[
                                        'h-full transition-all duration-300',
                                        passwordStrength === 'weak' ? 'bg-red-500 w-1/3' :
                                        passwordStrength === 'medium' ? 'bg-yellow-500 w-2/3' :
                                        'bg-emerald-500 w-full'
                                    ]"
                                />
                            </div>
                            <span 
                                :class="[
                                    'text-xs font-medium',
                                    passwordStrength === 'weak' ? 'text-red-400' :
                                    passwordStrength === 'medium' ? 'text-yellow-400' :
                                    'text-emerald-400'
                                ]"
                            >
                                {{ passwordStrengthText }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Confirm Password Input -->
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">
                        确认密码
                    </label>
                    <input
                        v-model="confirmPassword"
                        :type="showPassword ? 'text' : 'password'"
                        class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:bg-black/40 transition-all"
                        placeholder="再次输入主密码"
                        required
                    />
                    <p v-if="confirmPassword && password !== confirmPassword" class="mt-2 text-xs text-red-400">
                        密码不匹配
                    </p>
                </div>

                <!-- Warning -->
                <div class="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                    <div class="flex gap-3">
                        <AlertCircle class="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                        <div class="text-sm text-yellow-200">
                            <p class="font-medium mb-1">重要提示</p>
                            <p class="text-yellow-300/80">
                                忘记主密码将无法恢复加密的记忆。请务必记住您的密码。
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Error Message -->
                <div v-if="error" class="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <p class="text-sm text-red-400">{{ error }}</p>
                </div>

                <!-- Actions -->
                <div class="flex gap-3">
                    <button
                        type="button"
                        @click="handleSkip"
                        class="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium transition-colors"
                    >
                        跳过
                    </button>
                    <button
                        type="submit"
                        :disabled="!isValid || isLoading"
                        class="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
                        <span>{{ isLoading ? '设置中...' : '设置密码' }}</span>
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-vue-next'

const emit = defineEmits<{
    (e: 'setup-complete'): void
    (e: 'skip'): void
}>()

const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const error = ref('')

// 密码强度计算
const passwordStrength = computed(() => {
    const pwd = password.value
    if (pwd.length < 8) return 'weak'
    
    let strength = 0
    if (pwd.length >= 12) strength++
    if (/[a-z]/.test(pwd)) strength++
    if (/[A-Z]/.test(pwd)) strength++
    if (/[0-9]/.test(pwd)) strength++
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++
    
    if (strength >= 4) return 'strong'
    if (strength >= 2) return 'medium'
    return 'weak'
})

const passwordStrengthText = computed(() => {
    switch (passwordStrength.value) {
        case 'weak': return '弱'
        case 'medium': return '中等'
        case 'strong': return '强'
        default: return ''
    }
})

// 表单验证
const isValid = computed(() => {
    return password.value.length >= 8 &&
           password.value === confirmPassword.value &&
           passwordStrength.value !== 'weak'
})

const validatePassword = () => {
    error.value = ''
}

const handleSubmit = async () => {
    if (!isValid.value) return
    
    isLoading.value = true
    error.value = ''
    
    try {
        const result = await window.electron.encryptionSetMasterPassword(password.value)
        
        if (result.success) {
            emit('setup-complete')
        } else {
            error.value = result.error || '设置失败，请重试'
        }
    } catch (err: any) {
        error.value = err.message || '设置失败，请重试'
    } finally {
        isLoading.value = false
    }
}

const handleSkip = () => {
    emit('skip')
}
</script>
