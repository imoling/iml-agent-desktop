<template>
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div class="bg-[#1a1a1f] rounded-2xl shadow-2xl w-full max-w-md p-8 border border-white/10">
            <!-- Header -->
            <div class="text-center mb-8">
                <div class="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Lock class="w-8 h-8 text-white" />
                </div>
                <h2 class="text-2xl font-bold text-white mb-2">解锁加密记忆</h2>
                <p class="text-gray-400 text-sm">
                    请输入主密码以访问加密的记忆
                </p>
            </div>

            <!-- Form -->
            <form @submit.prevent="handleUnlock" class="space-y-6">
                <!-- Password Input -->
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">
                        主密码
                    </label>
                    <div class="relative">
                        <input
                            ref="passwordInput"
                            v-model="password"
                            :type="showPassword ? 'text' : 'password'"
                            class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:bg-black/40 transition-all"
                            placeholder="输入主密码"
                            required
                            @input="error = ''"
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
                </div>

                <!-- Error Message -->
                <div v-if="error" class="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle class="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <p class="text-sm text-red-400">{{ error }}</p>
                </div>

                <!-- Actions -->
                <div class="flex gap-3">
                    <button
                        v-if="canSkip"
                        type="button"
                        @click="handleSkip"
                        class="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium transition-colors"
                    >
                        稍后解锁
                    </button>
                    <button
                        type="submit"
                        :disabled="!password || isLoading"
                        class="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
                        <span>{{ isLoading ? '验证中...' : '解锁' }}</span>
                    </button>
                </div>

                <!-- Forgot Password -->
                <div class="text-center">
                    <button
                        type="button"
                        @click="handleForgotPassword"
                        class="text-sm text-gray-400 hover:text-indigo-400 transition-colors"
                    >
                        忘记密码？
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-vue-next'

interface Props {
    canSkip?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    canSkip: true
})

const emit = defineEmits<{
    (e: 'unlocked'): void
    (e: 'skip'): void
    (e: 'reset'): void
}>()

const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const error = ref('')
const passwordInput = ref<HTMLInputElement>()

onMounted(() => {
    // 自动聚焦密码输入框
    passwordInput.value?.focus()
    
    // 尝试自动解锁（使用 Keychain 中的密码）
    tryAutoUnlock()
})

const tryAutoUnlock = async () => {
    try {
        const result = await window.electron.encryptionUnlock()
        if (result.success) {
            emit('unlocked')
        }
    } catch (err) {
        // 自动解锁失败，需要用户手动输入
        console.log('Auto unlock failed, manual input required')
    }
}

const handleUnlock = async () => {
    if (!password.value) return
    
    isLoading.value = true
    error.value = ''
    
    try {
        // 验证密码 (With timeout to prevent hanging)
        const verifyPromise = window.electron.encryptionVerifyPassword(password.value)
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时')), 5000))
        
        const isValid = await Promise.race([verifyPromise, timeoutPromise])
        
        if (isValid) {
            // 密码正确，设置加密密钥
            const result = await window.electron.encryptionUnlock()
            if (result.success) {
                emit('unlocked')
            } else {
                error.value = '解锁失败，请重试'
            }
        } else {
            error.value = '密码错误，请重试'
            password.value = ''
            passwordInput.value?.focus()
        }
    } catch (err: any) {
        error.value = err.message || '解锁失败，请重试'
    } finally {
        isLoading.value = false
    }
}

const handleSkip = () => {
    emit('skip')
}

const handleForgotPassword = () => {
    const confirmed = confirm(
        '忘记密码将无法恢复加密的记忆。\n\n' +
        '您可以选择：\n' +
        '1. 清除所有加密数据并重新设置密码\n' +
        '2. 继续尝试输入密码\n\n' +
        '是否清除所有加密数据？'
    )
    
    if (confirmed) {
        handleClearEncryption()
    }
}

const handleClearEncryption = async () => {
    try {
        const result = await window.electron.encryptionClearAll()
        if (result.success) {
            alert('加密数据已清除。您可以重新设置主密码。')
            emit('reset')
        } else {
            error.value = '清除失败：' + result.error
        }
    } catch (err: any) {
        error.value = '清除失败：' + err.message
    }
}
</script>
