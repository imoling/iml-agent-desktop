<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { 
    Send, Bot, User, BrainCircuit, CheckCircle2, CircleDashed, FolderOpen, X, Trash2, 
    Square, Loader2, Cpu, FilePlus, Mic, Paperclip, History, PanelLeftOpen, PanelLeftClose,
    PanelRightOpen, PanelRightClose,
    Plane, Presentation, BarChart3, TreeDeciduous, FileText, Zap, Copy, Edit2, Check,
    ChevronDown
} from 'lucide-vue-next'
import { v4 as uuidv4 } from 'uuid'
import { useI18n } from 'vue-i18n'
import MarkdownIt from 'markdown-it'
import { useChatStore } from '../stores/chat'
import { useAppStore } from '../stores/app'
import { useWorkflowsStore } from '../stores/workflows'
import { storeToRefs } from 'pinia'
import TaskProgress from './TaskProgress.vue'
import ChatHistory from './ChatHistory.vue'
import InteractiveQuestion from './InteractiveQuestion.vue'
import ConfirmationCard from './ConfirmationCard.vue'
import MessageEditor from './MessageEditor.vue'
import RightDrawer from './RightDrawer.vue'
import { useMasking } from '../composables/useMasking'

const { mask } = useMasking()

// Icon Map for Skills
const iconMap: Record<string, any> = {
    'Plane': Plane,
    'Presentation': Presentation,
    'BarChart': BarChart3,
    'TreeDeciduous': TreeDeciduous,
    'FileText': FileText,
    'Brain': BrainCircuit,
    'Zap': Zap
}

const handleInsertFile = async () => {
    const file = await window.electron.selectFile();
    if (file) {
        currentInput.value = currentInput.value ? `${currentInput.value} "${file}"` : `"${file}"`;
    }
}

const handleInsertDirectory = async () => {
    const dir = await window.electron.selectDirectory();
    if (dir) {
        currentInput.value = currentInput.value ? `${currentInput.value} "${dir}"` : `"${dir}"`;
    }
}

// Copy & Edit Functionality
const copiedId = ref<string | null>(null)

const copyToClipboard = async (text: string, id: string) => {
    try {
        let success = false
        if (window.electron && (window.electron as any).copyToClipboard) {
             try {
                success = await (window.electron as any).copyToClipboard(text)
             } catch (ipcErr) {
                console.warn('IPC Copy failed, falling back to navigator', ipcErr)
             }
        }
        
        if (!success) {
             await navigator.clipboard.writeText(text)
        }
        
        copiedId.value = id
        setTimeout(() => {
            if (copiedId.value === id) copiedId.value = null
        }, 2000)
    } catch (err) {
        console.error('Failed to copy: ', err)
    }
}

const startEditing = (msg: any) => {
    msg.isEditing = true
    msg.editContent = msg.content // Use a temp property or v-model to content directly if careful?
    // Better to use a temp property to allow cancel. 
    // But since I can't easily extend the object type in the template v-model without type errors unless I cast, 
    // I'll assume msg has editContent added at runtime.
    msg._editContent = msg.content 
}

const saveEdit = (msg: any) => {
    if (msg._editContent !== undefined) {
        msg.content = msg._editContent
    }
    msg.isEditing = false
    chatStore.saveCurrentSession()
}

const cancelEdit = (msg: any) => {
    msg.isEditing = false
    delete msg._editContent
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

const { t } = useI18n()
const chatStore = useChatStore()
const { messages, currentInput, workingDirectory } = storeToRefs(chatStore)
const pendingConfirmation = ref<{ toolName: string; args: any } | null>(null)

const handleConfirmation = async (allowed: boolean) => {
    pendingConfirmation.value = null // Clear UI
    await window.electron.confirmToolExecution(allowed)
    
    // Add system message to log the decision
    if (!allowed) {
        chatStore.addMessage({
            role: 'assistant',
            content: '*[User denied the sensitive operation]*'
        })
    }
}

const loadInitialSkills = async () => {
    // If we only have the greeting message, populate it with skills
    if (messages.value.length === 1 && messages.value[0].role === 'assistant') {
        try {
            const skills = await window.electron.getSkills()
            if (skills && skills.length > 0) {
                 console.log('[ChatInterface] All Skills:', skills.map((s:any) => `${s.name} (defaultInChat: ${s.defaultInChat})`))
                 
                 // Filter by defaultInChat (undefined implies true)
                 const visibleSkills = skills.filter((s:any) => s.defaultInChat !== false)
                 
                 console.log('[ChatInterface] Visible Skills:', visibleSkills.map((s:any) => s.name))

                 const skillOptions = visibleSkills.map((s: any) => ({
                     value: `skill:${s.name}`,
                     label: s.displayName || s.name, // Use display name if available
                     description: s.description,
                     icon: s.icon && iconMap[s.icon] ? iconMap[s.icon] : Zap // Fallback to Zap (Lightning)
                 }))
                 
                 // Update the first message
                 messages.value[0].question = {
                     text: t('chat.whatToDo'), 
                     options: skillOptions
                 }
            }
        } catch (e) {
            console.error('Failed to load skills for greeting', e)
        }
    }
}

// Model Profile State
const profiles = ref<any[]>([])
const activeProfileId = ref('')

const fetchConfig = async () => {
    if (window.electron && window.electron.getConfig) {
        const config = await window.electron.getConfig()
        if (config) {
             if (config.profiles) {
                 profiles.value = config.profiles
             }
             if (config.activeProfileId) {
                 activeProfileId.value = config.activeProfileId
             } else if (profiles.value.length > 0) {
                 activeProfileId.value = profiles.value[0].id
             }
        }
    }
}

const setActiveProfile = async (id: string) => {
    activeProfileId.value = id
    if (window.electron && window.electron.setConfig) {
        await window.electron.setConfig('activeProfileId', id)
    }
}

const messagesContainer = ref<HTMLElement | null>(null)
const autoScrollEnabled = ref(true)

const handleScroll = (e: Event) => {
    const el = e.target as HTMLElement
    if (!el) return
    
    // If user is near bottom, enable auto-scroll. 
    // Otherwise, they've manually scrolled up, so disable it.
    const isAtBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 100
    autoScrollEnabled.value = isAtBottom
}

const scrollToBottom = (force = false) => {
    if (!messagesContainer.value) return
    
    // Only scroll if autoScroll is enabled OR it's a forced scroll (e.g. user sent a message)
    if (!autoScrollEnabled.value && !force) return
    
    // Use nextTick to ensure DOM has updated
    setTimeout(() => {
        if (messagesContainer.value) {
            messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
    }, 10)
}

// Watch for chat clear or new messages
watch(() => messages.value.length, (newLen, oldLen) => {
    // If a new message is added, we always want to scroll down and re-enable auto-scroll
    autoScrollEnabled.value = true
    scrollToBottom(true)
    
    // Check for reset (length became 1 and it's assistant)
    if (messages.value.length === 1 && messages.value[0].role === 'assistant') {
        loadInitialSkills()
    }
})

// Deep watch for content changes (streaming)
watch(() => messages.value, () => {
     // Optional: Check if we are already near bottom to avoid annoying jumps if user scrolled up
     // For now, adhere to user request: "always scroll down" implies auto-follow.
     scrollToBottom()
}, { deep: true })

// Also trigger on mount

// --- Workflow Autocomplete Logic ---
const workflowsStore = useWorkflowsStore()
const showWorkflowList = ref(false)
const workflowQuery = ref('')

onMounted(async () => {
    // Initialize chat store (load history or create new session)
    await chatStore.initialize()
    await workflowsStore.fetchWorkflows()
    
    loadInitialSkills()
    fetchConfig()
    scrollToBottom()
})

watch(currentInput, (newVal) => {
    const lastAtPos = newVal.lastIndexOf('@')
    if (lastAtPos !== -1) {
        // Check if there are spaces after the last @ (which usually means we moved on, matches "@query")
        const query = newVal.substring(lastAtPos + 1)
        // Ensure no newlines or other characters that invalidate a mention (simple constraint)
        if (!query.includes(' ') && !query.includes('\n')) {
            workflowQuery.value = query
            showWorkflowList.value = true
        } else {
            showWorkflowList.value = false
        }
    } else {
        showWorkflowList.value = false
    }
})

const filteredWorkflows = computed(() => {
    if (!workflowQuery.value) return workflowsStore.workflows
    const q = workflowQuery.value.toLowerCase()
    return workflowsStore.workflows.filter((w: any) => w.name.toLowerCase().includes(q))
})

const selectWorkflow = (workflow: any) => {
    const lastAtPos = currentInput.value.lastIndexOf('@')
    if (lastAtPos !== -1) {
        const prefix = currentInput.value.substring(0, lastAtPos)
        // const suffix = currentInput.value.substring(lastAtPos + 1 + workflowQuery.value.length) // might be tricky if user continued typing partial params
        // Simplified: Replace from @ to end (assuming cursor is there or we just replace the query part)
        // But safer: Replace the query part only
        const textBeforeAt = currentInput.value.substring(0, lastAtPos)
        // Construct new input: "Run workflow: Name "
        // If the user already typed "Run @...", it becomes "Run Run workflow: Name".
        // Heuristic: If textBeforeAt ends with "Run ", just append the name.
        
        // Actually, LLM understands "Run workflow [Name]" or even just "[Name]" if context is clear.
        // User asked for "Using @ to wake it up and run".
        // Let's replace "@..." with "Run workflow: [Name] " for clarity.
        
        currentInput.value = textBeforeAt + `Run workflow: "${workflow.name}" `
        showWorkflowList.value = false
        
        // Focus input (should already be focused)
    }
}



const extractQuestion = (content: string) => {
    // Regex matches <question ...> ... </question> OR just <question ...> ... if it's the end of message
    // Handles optional multiple attribute
    const match = content.match(/<question\s+options="([^"]+)"(?:\s+multiple="([^"]+)")?>([\s\S]*?)(?:<\/question>|$)/)
    if (match) {
        return {
            options: match[1].split(',').map(o => {
                const s = o.trim()
                return { value: s, label: s }
            }),
            question: match[3].trim(),
            multiple: match[2] === 'true'
        }
    }
    return null
}

const renderMessage = (content: string) => {
    if (!content) return ''
    // Remove <question> tag for Markdown rendering (be permissive with closing tag)
    const cleanContent = content.replace(/<question[\s\S]*?(?:<\/question>|$)/, '')
    // Remove <plan> tag
    const noPlan = cleanContent.replace(/<plan[\s\S]*?(?:<\/plan>|$)/, '')
    // Remove <thinking> tag
    const noThinking = noPlan.replace(/<think[\s\S]*?(?:<\/think>|$)/g, '')
    
    return md.render(noThinking)
}

const handleQuestionSelect = async (option: string) => {
    currentInput.value = option
    await sendMessage()
}

async function pickDirectory() {
    const dir = await window.electron.selectDirectory()
    if (dir) {
        workingDirectory.value = dir
    }
}

async function stopGeneration() {
    await window.electron.stopGeneration()
    chatStore.isStreaming = false
    // Optionally add a system message saying "Stopped"
    chatStore.addMessage({
        role: 'assistant',
        content: '_[Generation stopped by user]_'
    })
}

// Voice Input
const isRecording = ref(false)
const mediaRecorderRef = ref<MediaRecorder | null>(null)

const handleVoiceInput = async () => {
    if (isRecording.value) return // Prevent double click
    
    // Check if model is ready
    try {
        const config = await window.electron.voiceGetConfig()
        if (!config.downloaded) {
             if (confirm(t('voice.modelNotReady') || 'Voice model not ready. Open Settings to download?')) {
                 appStore.openSettings('voice')
             }
             return
        }
    } catch (e) {
        console.error('Failed to check voice config', e)
        return
    }

    isRecording.value = true
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mediaRecorder = new MediaRecorder(stream)
        const audioChunks: Blob[] = []
        
        mediaRecorderRef.value = mediaRecorder

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data)
        }

        mediaRecorder.onstop = async () => {
            try {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
                const arrayBuffer = await audioBlob.arrayBuffer()
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
                const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
                const pcmData = audioBuffer.getChannelData(0)
                
                const result = await window.electron.voiceTranscribe(pcmData)
                if (result.text) {
                    currentInput.value = (currentInput.value + ' ' + result.text).trim()
                }
            } catch (err) {
                console.error('Transcription failed:', err)
                alert('Transcription failed')
            } finally {
                isRecording.value = false
                mediaRecorderRef.value = null
                stream.getTracks().forEach(track => track.stop())
            }
        }

        mediaRecorder.start()
        
    } catch (err: any) {
        console.error('Mic error:', err)
        isRecording.value = false
        mediaRecorderRef.value = null
        alert(`Cannot access microphone: ${err.name} - ${err.message}`)
    }
}

const toggleRecording = () => {
    if (isRecording.value) {
        // Stop
        const recorder = mediaRecorderRef.value
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop()
        }
    } else {
        handleVoiceInput()
    }
}

// Imports removed

// ... (existing imports)

const appStore = useAppStore()

// ... (existing logic)

// Workflow Save Modal State
const showWorkflowModal = ref(false)
const workflowName = ref('New Chat Workflow')
const pendingWorkflowSteps = ref<any[]>([])

const handleSaveAsWorkflow = () => {
    try {
        // Extract steps from messages
        const steps: any[] = []
        let stepCount = 1
        const outputVars: string[] = []
        
        // Find last user prompt to capture the intent
        const lastUserMsg = [...messages.value].reverse().find(m => m.role === 'user')
        const userPrompt = lastUserMsg ? lastUserMsg.content : 'Summarize the findings.'

        for (const msg of messages.value) {
            if (msg.role === 'assistant' && msg.steps && msg.steps.length > 0) {
                for (const step of msg.steps) {
                    if (step.status === 'done') { // Only completed steps
                        const currentId = `step${stepCount++}`
                        const outputVar = `output_${currentId}`
                        
                        steps.push({
                            id: currentId,
                            type: 'skill',
                            skillId: step.name,
                            name: `Run ${step.name}`,
                            params: step.args || {},
                            outputVar: outputVar,
                            continueOnError: true // Ensure workflow continues even if non-critical steps fail
                        })
                        outputVars.push(outputVar)
                    }
                }
            }
        }

        if (steps.length === 0) {
            alert(t('workflows.noStepsFound') || 'No executable steps found in chat history.')
            return
        }
        
        // Add Final LLM Synthesis Step
        // This ensures the workflow answers the original question using the gathered data
        const promptLines = [
            '### Role & Objective',
            'You are an intelligent data synthesis engine. Your goal is to answer the [User Request] using ONLY the data provided in [Execution Results].',
            '',
            '### Strict Instructions',
            '1. **Filter Noise**: Ignore navigation menus, headers, footers, ads, and unrelated content.',
            '2. **Relevance**: Extract ONLY the information directly relevant to the user\'s specific question.',
            '3. **Accuracy**: If the exact answer is not found in the results, state "Information not found in the captured data" instead of hallucinating or using external knowledge.',
            '4. **Format**: Present the answer clearly and concisely.',
            '',
            '[Execution Results]'
        ]
        
        outputVars.forEach(v => {
            promptLines.push(`Result from step ${v.replace('output_step', '')}: {{${v}}}`)
        })
        
        promptLines.push('')
        promptLines.push('[User Request]')
        promptLines.push(userPrompt)
        
        steps.push({
            id: 'final_summary',
            type: 'llm',
            name: 'Generate Summary',
            prompt: promptLines
        })

        // Store steps and open modal
        pendingWorkflowSteps.value = steps
        workflowName.value = 'New Chat Workflow'
        showWorkflowModal.value = true

    } catch (e: any) {
        console.error('Error preparing workflow:', e)
        alert('Error: ' + e.message)
    }
}

const confirmSaveWorkflow = () => {
    if (!workflowName.value) return

    try {
        const draft = {
            id: uuidv4(),
            name: workflowName.value,
            description: 'Generated from chat session.',
            steps: pendingWorkflowSteps.value,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }

        workflowsStore.setDraftWorkflow(draft)
        appStore.setActiveMenu('workflows')
        
        // Close modal
        showWorkflowModal.value = false
        pendingWorkflowSteps.value = []
    } catch (e: any) {
        alert('Error saving workflow: ' + e.message)
    }
}

const handleClearChat = async () => {
    chatStore.clearMessages()
    // Force reload skills because the watcher might not fire if length didn't change (e.g. 1 -> 1)
    // and the new message object needs the question/options attached.
    await loadInitialSkills()
}

async function handleOptionSelect(value: string, label: string) {
    // Handle File Picking (strict or fuzzy match)
    const isFilePickAction = 
        value === 'action:pick_file' || 
        value === 'action:select_file' ||
        value === 'pick_file' ||
        // If LLM hallucinates a Chinese value but label implies file picking
        (label.includes('文件') && (label.includes('选择') || label.includes('路径') || label.includes('上传')))

    if (isFilePickAction) {
        const file = await window.electron.selectFile()
        if (file) {
            currentInput.value = file
            sendMessage()
        }
        return
    }

    if (value.startsWith('skill:')) {
        const skillName = value.replace('skill:', '')
        // Construct a better prompt
        currentInput.value = `Run the ${skillName} skill`
        sendMessage()
        return
    }

    currentInput.value = label
    
    // Heuristic: If the label implies a search or need for supplemental info, 
    // don't send immediately. Let user complete the input.
    const lowerLabel = label.toLowerCase()
    const needsInput = 
        lowerLabel.includes('search') || 
        lowerLabel.includes('filter') || 
        lowerLabel.includes('find') || 
        lowerLabel.includes('query') || 
        lowerLabel.includes('lookup') ||
        lowerLabel.includes('input') ||
        label.includes('搜索') || 
        label.includes('筛选') || 
        label.includes('查找') || 
        label.includes('查询') ||
        label.includes('输入')

    if (needsInput) {
        // Just populate and focus (auto-focus happens via binding usually, or we can force it if needed)
        // Add a space or colon to help user
        if (!currentInput.value.endsWith(' ')) {
            currentInput.value += ' '
        }
        return
    }

    sendMessage()
}

function renderMarkdown(content: string) {
    return md.render(content || '')
}

// Extract image paths from message content
function extractImagePaths(content: string): string[] {
    const patterns = [
        // Standard paths mentioned after keywords
        /(?:saved|created|generated|wrote).*?[:\s]+(\/[^\s'"<>]+\.(?:png|jpg|jpeg|webp|gif))/gi,
        /(?:file|image|screenshot|poster)[:\s]+(\/[^\s'"<>]+\.(?:png|jpg|jpeg|webp|gif))/gi,
        // Paths in backticks
        /`([\/~][^\s`]+\.(?:png|jpg|jpeg|webp|gif))`/gi,
        // Markdown image syntax ![alt](path)
        /!\[.*?\]\((?:file:\/\/)?(\/[^)]+\.(?:png|jpg|jpeg|webp|gif))\)/gi,
        // Markdown link syntax [text](path) - for images (handles // prefix)
        /\[.*?\]\((?:file:\/\/)?(\/?\/[^)\s]+\.(?:png|jpg|jpeg|webp|gif))\)/gi,
        // Generic standalone paths
        /(\/[^\s'"<>]+\.(?:png|jpg|jpeg|webp|gif))/gi,
        // Tilde paths
        /(~\/[^\s'"<>]+\.(?:png|jpg|jpeg|webp|gif))/gi
    ]
    
    const paths = new Set<string>()
    for (const pattern of patterns) {
        let match
        // Reset lastIndex for each pattern
        pattern.lastIndex = 0
        while ((match = pattern.exec(content)) !== null) {
            let path = match[1] || match[0]
            path = path.replace(/^['"`]|['"`]$/g, '').trim()
            
            // Normalize paths starting with // to /
            if (path.startsWith('//')) {
                path = path.slice(1)
            }
            
            // Only add valid absolute paths
            if (path.startsWith('/') || path.startsWith('~')) {
                // Skip if it looks like a URL scheme (http://, https://)
                if (!path.includes('://')) {
                    paths.add(path)
                }
            }
        }
    }
    return Array.from(paths)
}


// Open image in system viewer
async function openImage(path: string) {
    try {
        await window.electron.shellOpenPath(path)
    } catch (e) {
        console.error('Failed to open image:', e)
    }
}

async function sendMessage() {
    if (!currentInput.value.trim()) return

    const userContent = currentInput.value
    currentInput.value = '' // Clear input immediately
    chatStore.isStreaming = true // Set streaming flag 
    
    chatStore.addMessage({
      role: 'user',
      content: userContent
    })
  
  // Connect to Agent Logic
  try {
    chatStore.addMessage({
      role: 'assistant',
      content: '', 
      reasoning: '', // Initialize reasoning
      steps: []      // Initialize steps
    })
    
    // Prepare messages for IPC (remove Vue proxies)
    const plainMessages = messages.value
      .filter(m => m.content) // Only send messages with content to LLM (skip empty ones if any)
      .map(m => ({
        role: m.role,
        content: m.content
      }))

    // Inject System Time Context
    plainMessages.unshift({
        role: 'system' as any,
        content: `Current System Time: ${new Date().toLocaleString('zh-CN', { dateStyle: 'full', timeStyle: 'medium', hour12: false })}`
    })

    // Setup streaming listener
    let buffer = '' // Main buffer for incoming text to handle split tags
    let isParsingPlan = false
    let planBuffer = ''
    let isParsingQuestion = false
    let questionBuffer = ''
    let hasToolActivity = false // Track if any tool has been called in this response
    let preToolContent = '' // Hold content that appears before any tool call
    let postToolBuffer = '' // Hold content after tool-end; moves to reasoning on next tool-start, or to content at stream end
    
    // Helper to process buffer
    const processBuffer = (flush = false) => {
        const lastMsg = messages.value[messages.value.length - 1]
        if (!lastMsg) return

        if (isParsingPlan) {
            planBuffer += buffer
            buffer = ''
            
            if (planBuffer.includes('</plan>')) {
                isParsingPlan = false
                
                // Extract and parse
                const planContentMatch = planBuffer.match(/<plan>([\s\S]*?)<\/plan>/)
                if (planContentMatch && planContentMatch[1]) {
                        // Use regex to find steps: <step id="1">Text</step>
                        // Updated Regex to be non-greedy but handle newlines
                        const stepRegex = /<step id="([^"]+)">([\s\S]*?)<\/step>/g
                        let match
                        const newPlan = []
                        while ((match = stepRegex.exec(planContentMatch[1])) !== null) {
                            newPlan.push({
                                id: match[1],
                                description: match[2].trim(),
                                status: 'pending' as 'pending' | 'in-progress' | 'completed'
                            })
                        }
                        lastMsg.plan = newPlan
                        
                        // Sync with existing steps if any occurred while buffering the plan
                        if (lastMsg.steps && lastMsg.steps.length > 0) {
                            lastMsg.steps.forEach(step => {
                                if (step.status === 'done') {
                                    const p = lastMsg.plan?.find(x => x.status === 'pending')
                                    if (p) p.status = 'completed'
                                } else if (step.status === 'pending') {
                                     const p = lastMsg.plan?.find(x => x.status === 'pending')
                                     if (p) p.status = 'in-progress'
                                }
                            })
                        }
                }
                
                // Any remaining text after </plan>
                const parts = planBuffer.split('</plan>')
                if (parts[1]) {
                    // Feed back into buffer for potential other tags processing
                    buffer = parts[1]
                    processBuffer(flush) // recurse
                }
                
                planBuffer = ''
            }
        } else if (isParsingQuestion) {
            questionBuffer += buffer
            buffer = ''
            
            if (questionBuffer.includes('</question>')) {
                 isParsingQuestion = false
                 
                 // Support both format: Attribute style (preferred) and Nested style (legacy fallback)
                 const qAttrMatch = questionBuffer.match(/<question\s+options="([^"]+)"(?:\s+multiple="([^"]+)")?>([\s\S]*?)<\/question>/)
                 
                 if (qAttrMatch) {
                    const optionsArr = qAttrMatch[1].split(',').map(o => {
                        const s = o.trim()
                        return { value: s, label: s }
                    })
                    lastMsg.question = { 
                        text: qAttrMatch[3].trim(), 
                        options: optionsArr,
                        multiple: qAttrMatch[2] === 'true'
                    }
                 } else {
                    // Legacy Nested XML style
                    const qMatch = questionBuffer.match(/<question>([\s\S]*?)<\/question>/)
                    if (qMatch) {
                        const xml = qMatch[1]
                        const textMatch = xml.match(/<text>([\s\S]*?)<\/text>/)
                        const text = textMatch ? textMatch[1].trim() : ''
                        
                        const options = []
                        const optionRegex = /<option value="([^"]+)">([\s\S]*?)<\/option>/g
                        let optMatch
                        while ((optMatch = optionRegex.exec(xml)) !== null) {
                            const val = optMatch[1]
                            const inner = optMatch[2]
                            const labelMatch = inner.match(/<label>([\s\S]*?)<\/label>/)
                            const descMatch = inner.match(/<description>([\s\S]*?)<\/description>/)
                            
                            options.push({
                                value: val,
                                label: labelMatch ? labelMatch[1].trim() : val,
                                description: descMatch ? descMatch[1].trim() : undefined
                            })
                        }
                        
                        if (text && options.length > 0) {
                            lastMsg.question = { text, options }
                        }
                    }
                 }
                 
                 // Handle remainder
                 const parts = questionBuffer.split('</question>')
                 if (parts[1]) {
                     buffer = parts[1]
                     processBuffer(flush)
                 }
                 questionBuffer = ''
            } else if (flush) {
                 // Stream ended but no closing tag. Try to parse anyway using permissive regex.
                 isParsingQuestion = false
                 const qAttrMatch = questionBuffer.match(/<question\s+options="([^"]+)"(?:\s+multiple="([^"]+)")?>([\s\S]*?)$/)
                 if (qAttrMatch) {
                    const optionsArr = qAttrMatch[1].split(',').map(o => {
                        const s = o.trim()
                        return { value: s, label: s }
                    })
                    lastMsg.question = { 
                        text: qAttrMatch[3].trim(), 
                        options: optionsArr,
                        multiple: qAttrMatch[2] === 'true'
                    }
                 }
                 questionBuffer = ''
            }
        } else {
            // Check for < | end_of_thinking | > garbage and remove it
            // Regex handles variations: spaces, single/double underscores
            // Regex handles variations: spaces, single/double underscores, optional 'of'
            // Aggressively strip thinking tags
            // 1. Remove standard and HTML encoded versions
            buffer = buffer.replace(/(?:<|&lt;)\s*\|\s*(?:end[_\s]*(?:of[_\s]*)?)?thinking\s*\|\s*(?:>|&gt;)/gi, '')
            
            // 2. Remove fragments if they are split (e.g. < | end... then ...thinking | >)
            // This is harder to do perfectly without buffering too much, but let's handle the specific leaking case
            // The leak seen is < | end__of__thinking | >
            // If the buffer HAS the full tag, the above regex works.
            // If it leaked, it means it bypassed the backend filter (split chunks) AND the frontend buffer wasn't matching.
            // Let's broaden the regex to be extremely permissive of spaces/underscores/dashes
            // AND handle potential "broken" start/end
            
            buffer = buffer.replace(/(?:<|&lt;)\s*\|\s*end[\s_]*of[\s_]*thinking\s*\|\s*(?:>|&gt;)/gi, '')
            
            // Also clean up any lingering "start thinking" tag if it appears
            buffer = buffer.replace(/(?:<|&lt;)\s*\|\s*thinking\s*\|\s*(?:>|&gt;)/gi, '')

            // Look for <plan>
            const planIdx = buffer.indexOf('<plan>')
            if (planIdx !== -1) {
                // Found plan start
                const textBefore = buffer.substring(0, planIdx)
                lastMsg.content += textBefore
                
                isParsingPlan = true
                planBuffer = buffer.substring(planIdx) // detected tag goes into planBuffer
                buffer = ''
                
                // Recurse to see if we already have the full plan in planBuffer
                processBuffer(flush)
                return
            }

            // Look for <question
            const qIdx = buffer.indexOf('<question')
            if (qIdx !== -1) {
                const textBefore = buffer.substring(0, qIdx)
                lastMsg.content += textBefore
                
                isParsingQuestion = true
                questionBuffer = buffer.substring(qIdx)
                buffer = ''
                
                processBuffer(flush)
                return
            }

            // Normal Text Flushing
            if (flush) {
                // At flush time, decide where the text goes based on tool activity
                if (hasToolActivity) {
                    // Tools were called - accumulate in postToolBuffer (will become content only if it's the FINAL text)
                    postToolBuffer += buffer
                } else {
                    // No tools yet, accumulate in preToolContent (will go to reasoning if tools start, or content if no tools)
                    preToolContent += buffer
                }
                buffer = ''
            } else {
                // Heuristic: Don't flush if ending with partial tag
                const lastLt = buffer.lastIndexOf('<')
                // Increased safety window to 50 chars to catch long garbage tags like < | end_of_thinking | >
                if (lastLt !== -1 && buffer.length - lastLt < 50) {
                     // Flush detectable safe part
                     if (hasToolActivity) {
                         postToolBuffer += buffer.substring(0, lastLt)
                     } else {
                         preToolContent += buffer.substring(0, lastLt)
                     }
                     buffer = buffer.substring(lastLt)
                } else {
                     if (hasToolActivity) {
                         postToolBuffer += buffer
                     } else {
                         preToolContent += buffer
                     }
                     buffer = ''
                }
            }
        }
    }
    
    const cleanup = window.electron.onStreamUpdate((event) => {
        // If we stopped streaming (user clicked stop), ignore incoming chunks
        if (!chatStore.isStreaming) return

        const lastMsg = messages.value[messages.value.length - 1]
        
        if (lastMsg && lastMsg.role === 'assistant') {
            if (event.type === 'text') {
                buffer += event.content
                processBuffer(false)
            } else if (event.type === 'reasoning') {
                if (!lastMsg.reasoning) lastMsg.reasoning = ''
                lastMsg.reasoning += event.content
            } else if (event.type === 'tool-start') {
                // Mark that we have tool activity in this response
                hasToolActivity = true
                
                // Move any preToolContent to reasoning (it should appear in Thinking Process)
                if (preToolContent) {
                    lastMsg.reasoning = (lastMsg.reasoning || '') + preToolContent
                    preToolContent = ''
                }
                
                // Move any postToolBuffer to reasoning (it was intermediate text between tools)
                if (postToolBuffer) {
                    lastMsg.reasoning = (lastMsg.reasoning || '') + '\n' + postToolBuffer
                    postToolBuffer = ''
                }
                
                // Also move any buffer content to reasoning
                if (buffer) {
                    lastMsg.reasoning = (lastMsg.reasoning || '') + buffer
                    buffer = ''
                }
                
                // Move any already-displayed content to reasoning (backup)
                if (lastMsg.content) {
                    lastMsg.reasoning = (lastMsg.reasoning || '') + '\n' + lastMsg.content
                    lastMsg.content = ''
                }

                if (!lastMsg.steps) lastMsg.steps = []
                lastMsg.steps.push({
                    name: event.content, // Tool name
                    status: 'pending',
                    args: event.data // Capture tool arguments
                })

                 // Auto-generate Plan if missing (for ad-hoc tool use)
                 if (!lastMsg.plan || lastMsg.plan.length === 0) {
                     lastMsg.plan = lastMsg.plan || []
                     
                     let desc = `Execute ${event.content}`
                     const args = event.data || {}
                     
                     if (event.content === 'desktop-automation') {
                         if (args.action === 'add_calendar_event') desc = `添加日程: ${args.title || '无标题'}`
                         else if (args.action === 'list_calendar_events') desc = `查询日历`
                         else if (args.action === 'send_message') desc = `发送消息给 ${args.contact_name || '联系人'}`
                         else if (args.action === 'read_recent_messages') desc = `读取消息: ${args.contact_name || 'WeChat'}`
                         else if (args.action === 'send_email') desc = `发送邮件给 ${args.to_email || '收件人'}`
                         else if (args.action === 'read_emails') desc = `检查收件箱`
                         else desc = `桌面自动化: ${args.action}`
                     } else if (event.content === 'time-manager') {
                         if (args.action === 'resolve_date') desc = `计算日期: ${args.expression || ''}`
                         else desc = `获取当前时间`
                     } else if (event.content === 'write-file' || event.content === 'write_file') {
                         const p = args.path || args.file_path || ''
                         const name = p.split(/[/\\]/).pop()
                         desc = `将内容写入文件"${name || 'unknown'}"以保存结果`
                     } else if (event.content === 'read-file' || event.content === 'read_file' || event.content === 'read_file_content') {
                         const p = args.path || args.file_path || ''
                         const name = p.split(/[/\\]/).pop()
                         desc = `读取文件"${name || 'unknown'}"的内容`
                     } else if (event.content === 'shell-executor' || event.content === 'run_command') {
                         const cmd = args.script || args.command || ''
                         desc = `执行系统命令: ${cmd.slice(0, 40)}${cmd.length > 40 ? '...' : ''}`
                     } else if (event.content === 'browser-automation') {
                         // Richer browser-automation descriptions based on action
                         const action = args.action || ''
                         if (action === 'navigate') {
                             desc = `在浏览器中打开网页: ${args.url || '网址'}`
                         } else if (action === 'screenshot') {
                             desc = `对当前页面进行截图，以便后续分析`
                         } else if (action === 'analyze_screenshot') {
                             desc = `使用视觉模型分析截图内容`
                         } else if (action === 'click') {
                             desc = `点击页面元素: ${args.selector || 'target'}`
                         } else if (action === 'type') {
                             desc = `在输入框中输入文本`
                         } else if (action === 'extract') {
                             desc = `从页面中提取文本内容`
                         } else if (action === 'scroll') {
                             desc = `滚动页面以查看更多内容`
                         } else {
                             desc = `执行浏览器操作: ${action}`
                         }
                     } else if (event.content === 'web-search' || event.content === 'bing-web-search' || event.content === 'tavily-search') {
                         desc = `在网络上搜索"${args.query || ''}"以获取相关信息`
                     } else if (event.content === 'bing-image-search') {
                         desc = `搜索图片"${args.query || ''}"用于内容配图`
                     } else if (event.content === 'travel-planner') {
                         desc = `使用 travel-planner 技能规划${args.destination || '旅行'}行程`
                     } else if (event.content === 'pptx' || event.content === 'ppt-generator') {
                         desc = args.action === 'create' ? `生成演示文稿 (PPT)` : `处理演示文稿`
                     } else if (event.content === 'repl' || event.content === 'python') {
                         desc = `执行代码进行分析与计算`
                     } else if (event.content === 'data-analyst') {
                         desc = `对数据进行分析并生成可视化图表`
                     } else if (event.content === 'knowledge-base') {
                         desc = `在知识库中搜索"${args.query || ''}"以获取记忆`
                     } else if (event.content === 'desktop-automation') {
                         // Enrich desktop-automation (already handled above, but adding fallback)
                         const action = args.action || ''
                         if (!desc || desc.startsWith('Execute')) {
                             desc = `执行桌面自动化操作: ${action}`
                         }
                     } else {
                         // Fallback for unknown tools: Humanize the kebab-case name
                         const humanName = event.content.split(/[-_]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                         desc = `执行技能: ${humanName}`
                     }

                     lastMsg.plan.push({
                         id: event.content, // Unique ID
                         description: desc,
                         status: 'in-progress'
                     })
                 }
                
                // Find active plan (look backwards from end)
                // A plan is active if it has items that are 'pending' or 'in-progress'
                let activePlan = null
                for (let i = messages.value.length - 1; i >= 0; i--) {
                   const msg = messages.value[i]
                   if (msg.plan && msg.plan.length > 0) {
                       // Found a plan, check if it's not fully done
                       if (msg.plan.some(p => p.status !== 'completed')) {
                           activePlan = msg.plan
                           break
                       }
                   }
                   // Optimization: Don't search too far back? 
                   // For now, search all history as plans are usually near the end.
                }

                if (activePlan) {
                    const nextStep = activePlan.find(p => p.status === 'pending')
                    if (nextStep) nextStep.status = 'in-progress'
                }
                
            } else if (event.type === 'tool-end') {
                if (lastMsg.steps) {
                    const step = lastMsg.steps.find(s => s.name === event.content && s.status === 'pending')
                    if (step) {
                        step.status = 'done'
                        step.result = typeof event.data === 'string' ? event.data : JSON.stringify(event.data)

                        // Universal Artifact Detection
                        // 1. Direct Tool Argument Detection (More Robust)
                        const toolName = step.name
                        const args = step.args || {}
                        
                        if (toolName === 'write-file' || toolName === 'write_file') {
                            const p = args.path || args.file_path
                            if (p) {
                                const name = p.split(/[/\\]/).pop()
                                const type = name.match(/\.(png|jpg|jpeg|webp|gif)$/) ? 'image' : 
                                            name.match(/\.(json)$/) ? 'json' :
                                            'file' // default
                                            
                                chatStore.addArtifact({
                                    name: name,
                                    path: p,
                                    type: type
                                })
                            }
                        } else if (toolName === 'generate-pdf' || toolName === 'ppt-generator') {
                            // Support for PDF and PPT generators
                            let p = args.output_path || args.path || args.file_path || args.filename
                            
                            if (p) {
                                // Resolve relative paths against working directory
                                if (!p.startsWith('/') && !p.match(/^[a-zA-Z]:/) && workingDirectory.value) {
                                    if (window.electron.pathResolve) {
                                        p = window.electron.pathResolve(workingDirectory.value, p)
                                    } else {
                                        // Fallback for safety
                                        p = (workingDirectory.value.endsWith('/') || workingDirectory.value.endsWith('\\') ? workingDirectory.value : workingDirectory.value + '/') + p
                                    }
                                }

                                const name = p.split(/[/\\]/).pop()
                                let type: any = 'file'
                                if (name.endsWith('.pdf')) type = 'file'
                                else if (name.endsWith('.pptx')) type = 'file'
                                
                                chatStore.addArtifact({
                                    name: name,
                                    path: p,
                                    type: type
                                })
                            }
                        } else if (toolName === 'html-to-image') {
                            // Support for html-to-image skill
                            const outputPath = args.outputPath || args.output_path || args.path
                            if (outputPath) {
                                const name = outputPath.split(/[/\\]/).pop()
                                chatStore.addArtifact({
                                    name: name,
                                    path: outputPath,
                                    type: 'image'
                                })
                            }
                            // Also add HTML if provided
                            const htmlPath = args.htmlPath || args.html_path
                            if (htmlPath) {
                                const htmlName = htmlPath.split(/[/\\]/).pop()
                                const alreadyAdded = chatStore.artifacts.some(a => a.path === htmlPath)
                                if (!alreadyAdded) {
                                    chatStore.addArtifact({
                                        name: htmlName,
                                        path: htmlPath,
                                        type: 'code'
                                    })
                                }
                            }
                        }

                        // 2. Regex Scanning of Output (Fallback & for implicit creations)
                        // Logic: Scan for standard success messages in tool output
                        let messageOrOutput = typeof event.data === 'string' ? event.data : ''
                        
                        // If data is JSON object or JSON string, try to extract 'output'
                        if (!messageOrOutput && typeof event.data === 'object') {
                             if (event.data.output) messageOrOutput = event.data.output
                             else messageOrOutput = JSON.stringify(event.data)
                        } else if (messageOrOutput.trim().startsWith('{')) {
                             try {
                                 const parsed = JSON.parse(messageOrOutput)
                                 if (parsed.output) messageOrOutput = parsed.output
                             } catch (e) {}
                        }

                        if (messageOrOutput) {
                            const patterns = [
                                /Successfully (?:wrote to|created|generated).*?[:\s]+(.*?)(?:$|['"\n])/i,
                                /Screenshot saved to[:\s]+(.*?)(?:$|['"\n])/i,
                                /(?:Image|File) saved to[:\s]+(.*?)(?:$|['"\n])/i
                            ]
                            
                            let foundPath: string | null = null
                            for (const p of patterns) {
                                const m = messageOrOutput.match(p)
                                if (m && m[1]) {
                                    foundPath = m[1].trim()
                                    break
                                }
                            }
                            
                            if (foundPath) {
                                // Clean up path (remove trailing quotes, dots if sentence end, etc)
                                foundPath = foundPath.replace(/['"]+$/, '').replace(/\.$/, '')
                                
                                const name = foundPath.split(/[/\\]/).pop() || 'file'
                                let type: any = 'file'
                                if (name.endsWith('.json')) type = 'json'
                                else if (name.match(/\.(js|ts|py|html|css|md)$/)) type = 'code'
                                else if (name.match(/\.(png|jpg|jpeg|webp|gif)$/)) type = 'image'
                                
                                // Avoid duplicate adding if handled by tool check above
                                const alreadyAdded = chatStore.artifacts.some(a => a.path === foundPath)
                                if (!alreadyAdded) {
                                    chatStore.addArtifact({
                                        name: name,
                                        path: foundPath,
                                        type: type
                                    })
                                }
                            }
                        }
                    }
                }
                
                // Find active plan to update status
                let activePlan = null
                for (let i = messages.value.length - 1; i >= 0; i--) {
                   const msg = messages.value[i]
                   if (msg.plan && msg.plan.length > 0) {
                       if (msg.plan.some(p => p.status !== 'completed')) {
                           activePlan = msg.plan
                           break
                       }
                   }
                }

                if (activePlan) {
                    const currentStep = activePlan.find(p => p.status === 'in-progress')
                    if (currentStep) currentStep.status = 'completed'
                }
            } else if (event.type === 'tool-update') {
               // ... (keep existing tool-update logic)
                if (lastMsg.steps) {
                    const step = lastMsg.steps.find(s => s.name === event.content && s.status === 'pending')
                    if (step) {
                        step.progress = typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
                        
                        // Sync Plan Status
                        if ((event as any).status === 'done' || event.data === 'completed') {
                            // Find corresponding plan item
                            // Pattern 1: Match by ID (if strictly mapped)
                            let planItem = lastMsg.plan?.find(p => p.id === step.name)
                            // Pattern 2: Match by first pending (fallback)
                            if (!planItem) {
                                planItem = lastMsg.plan?.find(p => p.status === 'pending')
                            }
                            
                            if (planItem) {
                                planItem.status = 'completed'
                            }
                        } else if ((event as any).status === 'failed') {
                             // Mark as failed? Or just leave pending.
                             // Plan item usually doesn't have 'failed' status in this UI, maybe 'pending' or 'in-progress'
                        } else if ((event as any).status === 'running') {
                             let planItem = lastMsg.plan?.find(p => p.id === step.name)
                             if (!planItem) planItem = lastMsg.plan?.find(p => p.status === 'pending')
                             if (planItem) planItem.status = 'in-progress'
                        }
                    }
                }
            } else if (event.type === 'confirmation-request') {
                pendingConfirmation.value = {
                    toolName: event.content,
                    args: event.data
                }
            } else if (event.type === 'usage') {
                console.log('[ChatInterface] Usage Update:', event.data)
                chatStore.updateUsage(event.data)
            } else if (event.type === 'artifact') {
                // Handle Artifact Generated by Skill
                console.log('[ChatInterface] Artifact Received:', event.data)
                chatStore.addArtifact({
                    name: event.data.name,
                    path: event.data.path,
                    type: event.data.type || 'file'
                })
            }
        }
    })

    const response = await window.electron.chat(plainMessages, {
        cwd: workingDirectory.value
    })
    
    // Cleanup listener
    cleanup()
    
    // Final flush
    processBuffer(true)
    
    // Finalize preToolContent: if no tools were called, it should be the main content
    // If tools were called, preToolContent was already moved to reasoning
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg && preToolContent) {
        if (hasToolActivity) {
            // Tools were called, so remaining preToolContent goes to reasoning
            lastMsg.reasoning = (lastMsg.reasoning || '') + preToolContent
        } else {
            // No tools called, this is normal chat content
            lastMsg.content = (lastMsg.content || '') + preToolContent
        }
        preToolContent = ''
    }
    
    // Finalize postToolBuffer: this is the FINAL response after all tools completed
    if (lastMsg && postToolBuffer && hasToolActivity) {
        lastMsg.content = (lastMsg.content || '') + postToolBuffer
        postToolBuffer = ''
    }
    
    // Final update safety & Cleanup
    const hasRichContent = !!(lastMsg.plan?.length || lastMsg.question)
    
    if (lastMsg && lastMsg.content) {
         // Final cleanup of any leaked tags in the content
         // Robust regex: Matches < ... end_of_thinking ... > with any separators
         lastMsg.content = lastMsg.content
            .replace(/(?:<|&lt;)[^>]*end[_\s]+of[_\s]+thinking[^>]*(?:>|&gt;)/gi, '')
            .trim()
    }
    
    if (!chatStore.isStreaming) {
         // Parse final response if it's JSON (might contain usage)
         let finalContentStr = response
         try {
             if (typeof response === 'string' && response.trim().startsWith('{')) {
                 const parsed = JSON.parse(response)
                 if (parsed.content !== undefined) {
                     finalContentStr = parsed.content
                 }
                 if (parsed.usage) {
                     chatStore.updateUsage(parsed.usage)
                 }
             }
         } catch (e) {
             // Not JSON, assume plain text
         }

         // Only overwrite if completely empty and we have a final response
         if (!lastMsg.content && !hasRichContent && finalContentStr) {
             lastMsg.content = finalContentStr
         } else if (typeof response === 'string' && !response.trim().startsWith('{') && !hasRichContent && !lastMsg.content) {
              // Fallback for simple string response
             lastMsg.content = response
         }
    }
    
  } catch (err: any) {
    console.error(err)
    chatStore.addMessage({
      role: 'assistant',
      content: `Error: ${err.message || 'Failed to communicate with AI Provider'}`
    })
  } finally {
      chatStore.isStreaming = false
      // Auto-save session after each response
      await chatStore.saveCurrentSession()
  }
}
</script>

<template>
  <div id="chat-interface" class="h-full bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md overflow-hidden">
    <div class="flex h-full relative">
      <!-- History Sidebar -->
      <Transition name="slide">
          <div v-if="chatStore.isHistoryOpen" class="w-72 shrink-0 h-full bg-transparent" style="border-right: 1px solid var(--border-color);">
              <ChatHistory />
          </div>
      </Transition>
      
      <!-- Main Chat Area -->
      <div class="flex-1 flex flex-col h-full overflow-hidden min-w-0">
      <!-- Header with History Toggle -->
      <div class="flex items-center gap-2 px-4 h-11 border-b border-white/5">
          <button 
              @click="chatStore.toggleHistory"
              class="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              :title="chatStore.isHistoryOpen ? '关闭历史' : '历史记录'"
          >
              <PanelLeftOpen v-if="!chatStore.isHistoryOpen" class="w-5 h-5" />
              <PanelLeftClose v-else class="w-5 h-5" />
          </button>
          <div class="text-sm text-gray-500 flex-1">
              {{ chatStore.currentSessionId ? '' : '新对话' }}
          </div>
          <button 
              @click="chatStore.toggleRightDrawer"
              class="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              :title="chatStore.isRightDrawerOpen ? '关闭面板' : '产物/文件'"
          >
              <PanelRightOpen v-if="!chatStore.isRightDrawerOpen" class="w-5 h-5" />
              <PanelRightClose v-else class="w-5 h-5" />
          </button>

      </div>
      
      <div 
        ref="messagesContainer" 
        class="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
        @scroll="handleScroll"
      >
      <!-- Floating Scroll to Bottom Button -->
      <Transition name="fade">
          <button 
              v-if="!autoScrollEnabled"
              @click="scrollToBottom(true)"
              class="absolute bottom-28 right-8 z-10 p-2.5 bg-indigo-600/90 backdrop-blur-md text-white rounded-full shadow-lg hover:bg-indigo-500 transition-all flex items-center justify-center border border-white/20 hover:scale-110 active:scale-95 group"
              :title="$t('chat.scrollToBottom') || '回到底部'"
          >
              <ChevronDown class="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
          </button>
      </Transition>

      <div v-for="(msg, index) in messages" :key="msg.id" class="flex items-start gap-4" :class="msg.role === 'user' ? 'flex-row-reverse' : ''">
        
        <!-- Avatar -->
        <div 
          class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1"
          :class="msg.role === 'assistant' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'"
        >
          <Bot v-if="msg.role === 'assistant'" class="w-5 h-5" />
          <User v-else class="w-5 h-5" />
        </div>
        
        <!-- Content Body -->
        <div class="flex flex-col gap-2 max-w-[85%] transition-all duration-300" :class="{ 'w-full': msg.isEditing }">
            
            <!-- Reasoning Block (DeepSeek R1 style) -->
            <div 
                v-if="msg.reasoning || (chatStore.isStreaming && msg.role === 'assistant' && index === messages.length - 1)" 
                class="text-xs text-gray-400 bg-black/20 rounded-lg border border-white/5 overflow-hidden"
            >
                <details class="group">
                    <summary class="px-3 py-2 cursor-pointer hover:bg-white/5 flex items-center gap-2 select-none">
                        <BrainCircuit v-if="!chatStore.isStreaming || messages.indexOf(msg) !== messages.length - 1" class="w-3.5 h-3.5" />
                        <Loader2 v-else class="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        <span>Thinking Process</span>
                    </summary>
                    <div class="px-3 py-2 border-t border-white/5 whitespace-pre-wrap font-mono leading-relaxed bg-black/10">
                        {{ mask(msg.reasoning) }}
                    </div>
                </details>
            </div>

            <!-- Plan/Checklist -->
            <TaskProgress v-if="msg.plan && msg.plan.length > 0" :plan="msg.plan" />
            
            <!-- Steps / Tool Calls (Collapsible if > 3) -->
            <div v-if="msg.steps && msg.steps.length > 0" class="my-1">
                <details v-if="msg.steps.length > 3" class="group bg-black/10 rounded-lg border border-white/5 overflow-hidden">
                    <summary class="px-3 py-2 cursor-pointer hover:bg-white/5 flex items-center justify-between select-none text-xs text-indigo-300">
                        <div class="flex items-center gap-2">
                             <div v-if="msg.steps.some(s => s.status === 'pending')" class="animate-spin text-indigo-400">
                                <Loader2 class="w-3.5 h-3.5" />
                            </div>
                            <div v-else class="text-emerald-400">
                                <CheckCircle2 class="w-3.5 h-3.5" />
                            </div>
                            <span>{{ msg.steps.filter(s => s.status === 'done').length }}/{{ msg.steps.length }} Steps Completed</span>
                        </div>
                        <span class="group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div class="px-2 pb-2 flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar border-t border-white/5 pt-2">
                        <div v-for="(step, idx) in msg.steps" :key="idx" 
                             class="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 shrink-0"
                        >
                            <div v-if="step.status === 'pending'" class="animate-spin text-indigo-400">
                                <Loader2 class="w-3.5 h-3.5" />
                            </div>
                            <div v-else class="text-emerald-400">
                                <CheckCircle2 class="w-3.5 h-3.5" />
                            </div>
                            
                            <span class="font-medium text-indigo-200 text-xs truncat flex-1">Action: {{ step.name }}</span>
                            
                            <span v-if="step.status === 'done'" class="text-[10px] text-gray-400 bg-black/20 px-1.5 py-0.5 rounded">Done</span>
                            <span v-else class="text-[10px] text-indigo-300/60 animate-pulse">{{ step.progress || 'Running' }}</span>
                        </div>
                    </div>
                </details>

                <!-- Less than 3 steps: Show normally -->
                <div v-else class="flex flex-col gap-2">
                     <div v-for="(step, idx) in msg.steps" :key="idx" 
                         class="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20"
                    >
                        <div v-if="step.status === 'pending'" class="animate-spin text-indigo-400">
                            <Loader2 class="w-3.5 h-3.5" />
                        </div>
                        <div v-else class="text-emerald-400">
                             <CheckCircle2 class="w-4 h-4" />
                        </div>
                        
                        <span class="font-medium text-indigo-200">Action: {{ step.name }}</span>
                        
                        <span v-if="step.status === 'done'" class="text-xs text-gray-400 ml-auto bg-black/20 px-2 py-0.5 rounded">
                            Done
                        </span>
                        <span v-else class="text-xs text-indigo-300/60 ml-auto animate-pulse">
                            {{ step.progress || 'Running...' }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Main Message Bubble -->
            <div 
              v-if="msg.content || msg.isEditing"
              class="px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm group relative"
              :class="[
                  msg.role === 'assistant' ? 'bg-white/5 text-gray-200 rounded-tl-sm' : 'bg-indigo-600 text-white rounded-tr-sm',
                  msg.isEditing ? 'w-full' : ''
              ]"
            >
              <!-- Editing Mode -->
              <div v-if="msg.isEditing" class="w-full mb-2">
                  <MessageEditor 
                      v-model="msg._editContent"
                      @save="saveEdit(msg)"
                      @cancel="cancelEdit(msg)"
                  />
              </div>

              <!-- Viewing Mode -->
              <div v-else>
                  <div v-if="msg.role === 'assistant'" class="markdown-content" v-html="renderMessage(mask(msg.content))"></div>
                  <div v-else class="whitespace-pre-wrap">{{ mask(msg.content) }}</div>

                  <!-- Inline Images -->
                  <div v-if="msg.role === 'assistant' && extractImagePaths(msg.content).length > 0" class="mt-3 space-y-2">
                      <div 
                          v-for="(imgPath, idx) in extractImagePaths(msg.content)" 
                          :key="idx"
                          class="inline-image-container cursor-pointer hover:opacity-90 transition-opacity"
                          @click="openImage(imgPath)"
                      >
                          <img 
                              :src="'file://' + imgPath" 
                              :alt="imgPath.split('/').pop()" 
                              class="max-w-full max-h-80 rounded-lg shadow-md border border-black/10"
                              @error="($event.target as HTMLImageElement).style.display = 'none'"
                          />
                          <p class="text-xs text-gray-500 mt-1 truncate">{{ imgPath.split('/').pop() }}</p>
                      </div>
                  </div>

                  <!-- Action Toolbar (Visible on Hover) -->
                  <div class="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-gray-900/90 backdrop-blur border border-white/10 rounded-md px-1 py-0.5 z-10 shadow-lg">
                      <button 
                          @click="copyToClipboard(msg.content, msg.id)" 
                          class="p-1.5 hover:bg-white/20 rounded transition-colors"
                          :class="copiedId === msg.id ? 'text-emerald-400' : 'text-gray-300 hover:text-white'"
                          :title="copiedId === msg.id ? '已复制' : '复制内容'"
                      >
                          <Check v-if="copiedId === msg.id" class="w-3.5 h-3.5" />
                          <Copy v-else class="w-3.5 h-3.5" />
                      </button>
                      <button 
                          @click="startEditing(msg)" 
                          class="p-1.5 hover:bg-white/20 rounded text-gray-300 hover:text-white transition-colors"
                          title="编辑消息"
                      >
                          <Edit2 class="w-3.5 h-3.5" />
                      </button>
                  </div>
              </div>
            </div>

            <!-- Interactive Question -->
            <InteractiveQuestion 
                v-if="msg.role === 'assistant' && extractQuestion(msg.content)" 
                v-bind="extractQuestion(msg.content)!"
                @select="handleQuestionSelect"
            />

            <!-- Interactive Question -->
            <InteractiveQuestion 
                v-if="msg.question" 
                :question="msg.question.text" 
                :options="msg.question.options"
                @select="handleOptionSelect"
                @skip="msg.question = undefined"
            />
            
            <!-- Safe Mode Confirmation (Only show on last message if it's the assistant) -->
            <ConfirmationCard 
                v-if="pendingConfirmation && messages.indexOf(msg) === messages.length - 1"
                :tool-name="pendingConfirmation.toolName"
                :args="pendingConfirmation.args"
                @approve="handleConfirmation(true)"
                @deny="handleConfirmation(false)"
            />

        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="border-t border-white/10 bg-black/20">
      
      <!-- Toolbar -->
      <!-- Toolbar -->
      <div class="px-4 py-2 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <!-- Context Folder Picker -->
            <button 
                @click="pickDirectory"
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="workingDirectory ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-gray-300'"
                :title="$t('chat.workInFolder')"
            >
                <FolderOpen class="w-3.5 h-3.5" />
                <span v-if="workingDirectory" class="max-w-[200px] truncate" :title="workingDirectory">
                    {{ workingDirectory.split('/').pop() }}
                </span>
                <span v-else>{{ $t('chat.workInFolder') }}</span>
                
                <X v-if="workingDirectory" @click.stop="workingDirectory = null" class="w-3 h-3 ml-1 hover:text-white" />
            </button>

            <!-- Insert File -->
            <button 
                @click="handleInsertFile"
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 border border-white/5 hover:bg-white/10 hover:text-indigo-400 transition-colors"
                :title="t('chat.uploadFileTooltip')"
            >
                <Paperclip class="w-3.5 h-3.5" />
                <span>{{ t('chat.file') }}</span>
            </button>

            <!-- Insert Folder -->
            <button 
                @click="handleInsertDirectory"
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 border border-white/5 hover:bg-white/10 hover:text-indigo-400 transition-colors"
                :title="t('chat.selectDirTooltip')"
            >
                <FolderOpen class="w-3.5 h-3.5" />
                <span>{{ t('chat.directory') }}</span>
            </button>
          </div>

          <div class="flex items-center gap-2">
            <!-- Save as Workflow -->
            <button 
                @click="handleSaveAsWorkflow"
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-indigo-400 hover:bg-white/5 transition-colors"
                :title="t('workflows.saveFromChat') || 'Save as Workflow'"
            >
                <FilePlus class="w-3.5 h-3.5" />
                <span>{{ t('workflows.saveAs') }}</span>
            </button>
            
            <!-- Clear Chat -->
            <button 
                @click="handleClearChat"
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                :title="$t('chat.clearChat')"
            >
                <Trash2 class="w-3.5 h-3.5" />
                <span>{{ $t('chat.clearChat') }}</span>
            </button>
          </div>
      </div>

      <div class="px-4 pb-4 relative flex items-center gap-2">
        <!-- Model Switcher (Moved here) -->
        <div v-if="profiles.length > 0" class="flex items-center justify-center shrink-0">
            <div class="relative group">
                <button 
                    class="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all flex items-center justify-center text-gray-400 hover:text-indigo-400"
                    :title="$t('sidebar.models')"
                >
                    <Cpu class="w-5 h-5" />
                </button>
                <select 
                    :value="activeProfileId" 
                    @change="setActiveProfile(($event.target as HTMLSelectElement).value)"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                >
                    <option v-for="p in profiles" :key="p.id" :value="p.id">
                        {{ p.name }}
                    </option>
                </select>
            </div>
        </div>

        <div class="relative flex-1">
        <!-- Workflow Autocomplete Dropdown -->
        <div v-if="showWorkflowList && filteredWorkflows.length > 0" class="absolute bottom-full left-0 w-full mb-2 bg-[#1e1e24] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 max-h-60 overflow-y-auto">
            <div 
                v-for="(wf, index) in filteredWorkflows" 
                :key="wf.id" 
                @click="selectWorkflow(wf)"
                class="px-4 py-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors border-b border-white/5 last:border-0"
            >
                <div class="p-2 bg-indigo-500/10 rounded-lg shrink-0">
                    <BrainCircuit class="w-4 h-4 text-indigo-400" />
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-white truncate">{{ wf.name }}</div>
                    <div class="text-xs text-gray-500 truncate">{{ wf.description || '无描述' }}</div>
                </div>
            </div>
        </div>

        <input 
          v-model="currentInput"
          @keyup.enter="sendMessage"
          type="text" 
          :disabled="chatStore.isStreaming"
          :placeholder="t('chat.placeholder')"
          class="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />
        
        <!-- Send or Stop Button -->
        <div class="absolute right-2 top-1/2 -translate-y-1/2">
            <button 
              v-if="chatStore.isStreaming"
              @click="stopGeneration"
              class="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-white/10 transition-colors animate-pulse"
              :title="t('chat.stopGeneration')"
            >
              <Square class="w-4 h-4 fill-current" />
            </button>
            <button 
              v-else
              @click="toggleRecording"
              class="p-1.5 rounded-lg transition-colors mr-1"
              :class="isRecording ? 'text-red-400 bg-red-400/10 animate-pulse' : 'text-gray-400 hover:text-white hover:bg-white/10'"
              :title="isRecording ? t('chat.stopRecording') || 'Stop Recording' : t('chat.voiceInput') || 'Voice Input'"
            >
              <Mic class="w-4 h-4" />
            </button>
            <button 
              @click="sendMessage"
              class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Send class="w-4 h-4" />
            </button>
        </div>
        </div>
      </div>
    </div>
    </div>  <!-- Close main chat area -->
    
      <!-- Right Drawer -->
      <Transition name="slide-right">
          <div v-if="chatStore.isRightDrawerOpen" class="w-80 shrink-0 h-full" style="background-color: var(--bg-secondary); border-left: 1px solid var(--border-color);">
              <RightDrawer :embedded="true" />
          </div>
      </Transition>
    </div>  <!-- Close flex container -->

    <!-- Save Workflow Modal -->
    <div v-if="showWorkflowModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div class="bg-[#1e1e24] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 class="text-lg font-semibold text-white mb-2">{{ t('workflows.saveAs') }}</h3>
            <p class="text-sm text-gray-400 mb-4">{{ t('workflows.enterName') }}</p>
            
            <input 
                v-model="workflowName"
                @keyup.enter="confirmSaveWorkflow"
                type="text"
                class="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white/5 transition-all mb-6"
                :placeholder="t('workflows.enterName')"
                autoFocus
            />
            
            <div class="flex justify-end gap-3">
                <button 
                    @click="showWorkflowModal = false"
                    class="px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                    {{ t('common.cancel') }}
                </button>
                <button 
                    @click="confirmSaveWorkflow"
                    class="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-500/20"
                >
                    {{ t('common.save') }}
                </button>
            </div>
        </div>
    </div>

  </div>  <!-- Close outer wrapper -->
</template>

<style scoped>
/* Slide transition for history sidebar */
.slide-enter-active,
.slide-leave-active {
    transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
    transform: translateX(-100%);
    opacity: 0;
}

/* Slide-right transition for right drawer */
.slide-right-enter-active,
.slide-right-leave-active {
    transition: all 0.3s ease;
}

.slide-right-enter-from,
.slide-right-leave-to {
    transform: translateX(100%);
    opacity: 0;
}

/* Fade transition for scroll to bottom button */
.fade-enter-active,
.fade-leave-active {
    transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
    transform: translateY(10px);
}
</style>
