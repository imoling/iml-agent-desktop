<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Languages, Mic, Play, Download, FolderOpen, Loader2, CheckCircle, Info } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const modelStatus = ref({
    id: 'ggml-tiny.bin',
    downloaded: false,
    downloading: false,
    path: null as string | null
})
const downloadProgress = ref(0)
const downloadFile = ref('')
const isRecording = ref(false)
const transcription = ref('')
const selectedMic = ref('')
const microphones = ref<{ label: string; deviceId: string }[]>([])
const selectedModel = ref('ggml-tiny.bin')

const models = [
    { id: 'ggml-tiny.bin', label: 'Whisper Tiny (Native)', size: '~75MB' },
    { id: 'ggml-base.bin', label: 'Whisper Base (Native)', size: '~142MB' },
    { id: 'ggml-small.bin', label: 'Whisper Small (Native)', size: '~466MB' },
]

// Load status
const loadStatus = async () => {
    modelStatus.value = await window.electron.voiceGetConfig()
    selectedModel.value = modelStatus.value.id
}

const switchModel = async () => {
    // Set the new model in backend
    await window.electron.voiceSetModel(selectedModel.value)
    // Reload status to get updated model info
    modelStatus.value = await window.electron.voiceGetConfig()
}

// Remove watch
// watch(selectedModel, async (newId) => {
//     if (newId !== modelStatus.value.id) {
//         await switchModel()
//     }
// })

const save = async () => {
    console.log('VoiceSettings: Saving...')
    if (selectedModel.value !== modelStatus.value.id) {
        await switchModel()
    }
    // Future: Save selectedMic if backend supports it
}

defineExpose({ save })


// Download Model
const handleDownload = async () => {
    modelStatus.value.downloading = true
    downloadProgress.value = 0
    
    // Listen for progress
    const cleanup = window.electron.onVoiceDownloadProgress((data: any) => {
        if (data.status === 'progress') {
            downloadProgress.value = Math.round(data.progress || 0)
            downloadFile.value = data.file
        } else if (data.status === 'done') {
            downloadProgress.value = 100
        }
    })

    try {
        await window.electron.voiceDownloadModel()
        await loadStatus() // Refresh
    } catch (e) {
        console.error('Download failed', e)
    } finally {
        cleanup()
        modelStatus.value.downloading = false
    }
}

// Voice Recognition Test (Real Recording and Transcribe)
const handleTest = async () => {
    if (isRecording.value) return
    isRecording.value = true
    transcription.value = ''
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mediaRecorder = new MediaRecorder(stream)
        const audioChunks: Blob[] = []

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data)
        }

        mediaRecorder.onstop = async () => {
            try {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
                
                // Convert to AudioBuffer and Resample to 16kHz
                const arrayBuffer = await audioBlob.arrayBuffer()
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
                const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
                
                // Get PCM data from channel 0
                const pcmData = audioBuffer.getChannelData(0)
                
                // Send to backend
                const result = await window.electron.voiceTranscribe(pcmData)
                transcription.value = result.text || t('settings.voice.noSpeech')
                
            } catch (err) {
                console.error('Transcription failed:', err)
                transcription.value = t('settings.voice.failed')
            } finally {
                isRecording.value = false
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop())
            }
        }

        mediaRecorder.start()
        
        // Record for 3 seconds
        setTimeout(() => {
            if (mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop()
            }
        }, 3000)
        
    } catch (err) {
        console.error('Mic error:', err)
        isRecording.value = false
        alert('无法访问麦克风 (Cannot access microphone)')
    }
}

onMounted(async () => {
    loadStatus()
    try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        microphones.value = devices.filter(d => d.kind === 'audioinput')
    } catch (e) {
        console.error('Failed to enumerate devices', e)
    }
})
</script>

<template>
    <div class="p-8 space-y-8 animate-fade-in text-gray-200">
        <!-- Header -->
        <div class="space-y-1">
            <h2 class="text-xl font-bold flex items-center gap-2">
                <Mic class="w-5 h-5 text-indigo-400" />
                {{ $t('settings.voice.title') }}
            </h2>
            <p class="text-sm text-gray-400 flex items-center gap-2">
                {{ $t('settings.voice.subtitle') }}
                <span v-if="modelStatus.downloaded" class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle class="w-3 h-3" /> {{ $t('models.active') }}
                </span>
            </p>
        </div>

        <!-- Mic Selection -->
        <div class="space-y-3">
            <label class="text-sm font-medium text-gray-300">{{ $t('settings.voice.mic') }}</label>
            <div class="relative">
                <select v-model="selectedMic" class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 appearance-none text-sm focus:border-indigo-500/50 outline-none transition-colors">
                    <option value="">{{ $t('settings.voice.micAuto') }}</option>
                    <option v-for="m in microphones" :key="m.deviceId" :value="m.deviceId">
                        {{ m.label || 'Unknown Device' }}
                    </option>
                </select>
                <div class="absolute right-4 top-3.5 pointer-events-none text-gray-500">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
            </div>
            <p class="text-xs text-gray-500">{{ $t('settings.voice.micDesc') }}</p>
        </div>

        <!-- Transcribe Settings -->
        <div class="space-y-6 pt-6 border-t border-white/5">
            <div class="space-y-1">
                 <h3 class="text-lg font-medium">{{ $t('settings.voice.transcription') }}</h3>
                 <p class="text-sm text-gray-400">{{ $t('settings.voice.transcriptionDesc') }}</p>
            </div>

            <!-- Model Selection -->
            <div class="space-y-3">
                <label class="text-sm font-medium text-gray-300">{{ $t('settings.voice.model') }}</label>
                 <div class="relative">
                    <select v-model="selectedModel" class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 appearance-none text-sm outline-none focus:border-indigo-500/50">
                        <option v-for="m in models" :key="m.id" :value="m.id">
                            {{ m.label }} ({{ m.size }})
                        </option>
                    </select>
                     <div class="absolute right-4 top-3.5 pointer-events-none text-gray-500">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>
            </div>

            <!-- Model Status Card (Refined Style) -->
            <div class="bg-black/20 p-5 rounded-xl border border-white/5 space-y-3">
                <!-- Header -->
                <div class="flex items-center gap-2 mb-1">
                    <CheckCircle v-if="modelStatus.downloaded" class="w-4 h-4 text-emerald-400" />
                    <Loader2 v-else-if="modelStatus.downloading" class="w-4 h-4 text-indigo-400 animate-spin" />
                    <Download v-else class="w-4 h-4 text-indigo-400" />
                    
                    <h3 class="font-bold text-white text-sm">
                        <span v-if="modelStatus.downloaded">{{ $t('settings.voice.modelReady') }}</span>
                        <span v-else-if="modelStatus.downloading">{{ $t('settings.voice.downloading') }}</span>
                        <span v-else>{{ $t('settings.voice.notFound') }}</span>
                    </h3>
                </div>

                <!-- State: Downloaded -->
                <div v-if="modelStatus.downloaded" class="space-y-2">
                     <div class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-gray-400 break-all flex justify-between items-center group">
                        <span>{{ modelStatus.path || modelStatus.id }}</span>
                        <CheckCircle class="w-3 h-3 text-emerald-500/50" />
                     </div>
                     <p class="text-xs text-gray-500">{{ $t('settings.voice.readyDesc') }}</p>
                </div>

                <!-- State: Downloading -->
                <div v-else-if="modelStatus.downloading" class="space-y-3">
                    <div class="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                         <div class="h-full bg-indigo-500 transition-all duration-300" :style="{ width: downloadProgress + '%' }"></div>
                    </div>
                    <div class="flex justify-between text-xs text-gray-500">
                         <span>{{ downloadFile || 'Preparing...' }}</span>
                         <span>{{ downloadProgress }}%</span>
                    </div>
                </div>

                <!-- State: Not Downloaded -->
                <div v-else class="space-y-3">
                     <p class="text-xs text-gray-500">
                        {{ $t('settings.voice.notDownloadedDesc') }}
                     </p>
                     <button 
                        @click="handleDownload" 
                        class="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2"
                     >
                        <Download class="w-3 h-3" />
                        {{ $t('settings.voice.download') }} ({{ models.find(m => m.id === selectedModel)?.size || 'Unknown Size' }})
                     </button>
                </div>
            </div>
        </div>

        <!-- Recognition Test -->
        <div class="space-y-4 pt-6 border-t border-white/5">
            <h3 class="text-base font-medium">{{ $t('settings.voice.test') }}</h3>
            
            <div class="flex items-center gap-4">
                <button 
                  @click="handleTest"
                  :disabled="!modelStatus.downloaded || isRecording"
                  class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-2"
                >
                   <div v-if="isRecording" class="flex items-center gap-2">
                       <span class="animate-pulse w-2 h-2 bg-red-400 rounded-full"></span>
                       <span>{{ $t('settings.voice.recording') }}</span>
                   </div>
                   <div v-else class="flex items-center gap-2">
                       <Mic class="w-4 h-4 fill-current" />
                       <span>{{ $t('settings.voice.startTest') }}</span>
                   </div>
                </button>
            </div>

            <!-- Result Card -->
            <div v-if="transcription" class="bg-black/20 border border-white/5 rounded-xl p-4 animate-fade-in-up">
                <div class="text-xs text-gray-500 mb-2 uppercase tracking-wider font-bold">{{ $t('settings.voice.result') }}</div>
                <div class="text-lg text-white leading-relaxed font-medium">
                    "{{ transcription }}"
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}
.animate-fade-in-up {
  animation: fadeInUp 0.4s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
