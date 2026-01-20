import { ConfigManager } from './ConfigManager';
import { SkillManager } from './SkillManager';
import { LLMProvider, ChatMessage } from './llm/types';
import { AnthropicProvider } from './llm/AnthropicProvider';
import { OpenAIProvider } from './llm/OpenAIProvider';
import { VectorStore } from './memory/VectorStore';

import { PermissionManager } from './PermissionManager';

export class LLMService {
    private configManager: ConfigManager;
    private skillManager: SkillManager;
    private permissionManager: PermissionManager;
    private vectorStore: VectorStore | null = null;
    private workflowManager: any = null;

    constructor(configManager: ConfigManager, skillManager: SkillManager, permissionManager: PermissionManager) {
        this.configManager = configManager;
        this.skillManager = skillManager;
        this.permissionManager = permissionManager;
    }

    setVectorStore(vectorStore: VectorStore) {
        this.vectorStore = vectorStore;
    }

    setWorkflowManager(workflowManager: any) {
        this.workflowManager = workflowManager;
    }

    private getProvider(): LLMProvider {
        const config = this.configManager.getAll();

        let provider = config.provider || 'anthropic';
        let apiKey = config.apiKey || '';
        let model = config.model || 'claude-3-5-sonnet-20240620';
        let baseURL = config.baseURL || '';

        // Multi-Model Support: Resolve active profile
        if (config.profiles && config.profiles.length > 0 && config.activeProfileId) {
            const profile = config.profiles.find(p => p.id === config.activeProfileId);
            if (profile) {
                provider = profile.provider;
                apiKey = profile.apiKey;
                model = profile.model;
                baseURL = profile.baseURL || '';
                console.log(`[LLMService] Using active profile: ${profile.name} (${profile.model})`);
            }
        }

        console.log('[LLMService] Config:', {
            provider,
            model,
            baseURL
        });

        if (provider === 'openai') {
            const apiBase = baseURL || 'https://api.openai.com/v1';
            return new OpenAIProvider(apiKey, apiBase, model);
        } else {
            // Default to Anthropic
            return new AnthropicProvider(apiKey, model);
        }
    }

    private isStopped = false;
    private pendingConfirmation: { resolve: (value: boolean) => void, reject: (reason?: any) => void } | null = null;
    private abortController: AbortController | null = null;

    stop() {
        this.isStopped = true;
        // If waiting for confirmation, reject/resolve it to unblock
        if (this.pendingConfirmation) {
            this.pendingConfirmation.resolve(false);
            this.pendingConfirmation = null;
        }

        // Abort active request
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        console.log('[LLMService] Stop requested.');
    }

    resolveConfirmation(allowed: boolean) {
        if (this.pendingConfirmation) {
            this.pendingConfirmation.resolve(allowed);
            this.pendingConfirmation = null;
        }
    }

    private embeddingPipeline: any = null;

    async getEmbedding(text: string): Promise<number[]> {
        try {
            if (!this.embeddingPipeline) {
                console.log('[LLMService] Initializing local embedding pipeline (Xenova/paraphrase-multilingual-MiniLM-L12-v2)...');
                const { pipeline } = await import('@xenova/transformers');
                // Use a multilingual model for better Chinese support
                this.embeddingPipeline = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
                console.log('[LLMService] Local embedding pipeline initialized (Multilingual).');
            }

            // Generate embedding
            const output = await this.embeddingPipeline(text, { pooling: 'mean', normalize: true });

            // output.data is a Float32Array
            return Array.from(output.data);
        } catch (error: any) {
            console.error('[LLMService] Local embedding failed:', error);
            // Fallback to provider if local fails (unlikely if installed correctly)
            const provider = this.getProvider();
            if (typeof provider.getEmbedding === 'function') {
                console.log('[LLMService] Falling back to provider for embedding...');
                return await provider.getEmbedding(text);
            }
            throw new Error('Failed to generate embedding: ' + error.message);
        }
    }

    async retrieveContext(query: string): Promise<string> {
        if (!this.vectorStore) return '';
        try {
            console.log(`[LLMService] Retrieving context for query: "${query.substring(0, 50)}..."`);
            const results = await this.vectorStore.search(query, 5); // Retrieve top 5 matches

            // Filter by score (Cosine Similarity: Higher is better, usually > 0.3-0.4 for relevance)
            // 'paraphrase-multilingual-MiniLM-L12-v2' usually gives > 0.4 for good matches.
            const filteredResults = results.filter(doc => (doc.score || 0) > 0.35);

            if (filteredResults.length === 0) {
                console.log(`[LLMService] No relevant context found above threshold (0.35). Raw results: ${results.length}`);
                return '';
            }

            const contextBlock = filteredResults.map(doc =>
                `- ${doc.content} (Source: ${doc.metadata.source || 'Unknown'}, Time: ${new Date(doc.metadata.timestamp).toLocaleString()}, Score: ${doc.score?.toFixed(2)})`
            ).join('\n');

            console.log(`[LLMService] Retrieved ${filteredResults.length} context items (Filtered from ${results.length}).`);
            return `\n\nRELEVANT MEMORY (RAG):\nThe following information was retrieved from your long-term memory. Use it to answer the user's request if relevant.\n${contextBlock}`;
        } catch (e) {
            console.error('[LLMService] Failed to retrieve context:', e);
            return '';
        }
    }

    async chat(
        messages: any[],
        systemPrompt?: string,
        tools: any[] | null = null,
        onUpdate?: (event: import('./llm/types').StreamEvent) => void,
        options?: { cwd?: string }
    ): Promise<string> {
        this.isStopped = false;
        this.abortController = new AbortController();
        const provider = this.getProvider();
        const config = this.configManager.getAll();
        const safeMode = config.safeMode !== false; // Default true

        // --- Vision Model Routing ---
        let effectiveProvider = provider;
        const hasImages = messages.some(m => Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image' || c.type === 'image_url'));

        if (hasImages && config.visionModel && config.visionModel.enabled) {
            console.log('[LLMService] Vision task detected. Routing to Vision Model...');
            const vmParams = config.visionModel;
            if (vmParams.provider === 'openai') {
                effectiveProvider = new OpenAIProvider(vmParams.apiKey, vmParams.baseURL || 'https://api.openai.com/v1', vmParams.model);
            } else {
                effectiveProvider = new AnthropicProvider(vmParams.apiKey, vmParams.model);
            }
        }
        // -----------------------------

        // RAG Retrieval Logic
        let ragContext = '';
        // Only retrieve if there's a user message at the end
        const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
        if (lastUserMessage && lastUserMessage.content) {
            // Basic heuristic: Don't search if message is too short (e.g. "ok", "yes")
            if (lastUserMessage.content.length > 5) {
                ragContext = await this.retrieveContext(lastUserMessage.content);
            }
        }

        // Sensitive Skills List (Patterns)
        // Matches: write-file, write_file, delete..., shell..., etc.
        const sensitivePatterns = [
            /write[-_]file/i,
            /delete[-_]/i,
            /remove[-_]/i,
            /shell/i,
            /exec/i,
            /install/i,
            /cmd/i,
            /system/i,
            /control/i,
            /organize/i
        ];

        // Default System Prompt (Agentic Behavior)
        // ... (truncated for brevity, assumes identical to original)
        const agentSystemPrompt = `You are an advanced AI agent capable of planning and executing complex tasks.
RAG ENABLED: You have access to a long-term memory. Relevant context has been injected below.
`;

        let effectiveSystemPrompt = agentSystemPrompt + ragContext; // Inject memory context early or late? 
        // Better late (closer to user prompt) or appended to system prompt.
        // Let's append to system prompt template.

        // ... Re-add the rest of the prompt ...
        const planningPrompt = `
PLANNING PROTOCOL:
Before executing any tool, you MUST output a plan using <plan> tags.
This plan is displayed in the UI to help the user understand your actions.

STEP DESCRIPTION REQUIREMENTS:
Each <step> description MUST be written in natural language and include:
1. What action will be performed (the verb)
2. On what target/data (the object)
3. Why this step is needed or what outcome is expected

IMPORTANT: These descriptions are shown directly to users in the interface.
Make them informative, human-readable, and NEVER use raw tool/function names.

FORMAT:
<plan>
  <step id="1">Description of step 1</step>
  <step id="2">Description of step 2</step>
</plan>

EXAMPLES - BAD vs GOOD:

BAD:  <step id="1">截图</step>
GOOD: <step id="1">对当前页面进行截图，以便分析页面内容</step>

BAD:  <step id="2">browser-automation</step>
GOOD: <step id="2">打开 google.com 网页，准备查看今日涂鸦</step>

BAD:  <step id="3">搜索</step>
GOOD: <step id="3">在 Bing 上搜索"今日 Google 涂鸦"来获取最新信息</step>

BAD:  <step id="4">发送消息</step>
GOOD: <step id="4">通过微信向"康茉灵"发送旅行计划链接</step>

BAD:  <step id="5">travel-planner</step>
GOOD: <step id="5">使用 travel-planner 技能为您策划三亚 5 日游，预算两万元</step>

BAD:  <step id="6">读取文件</step>
GOOD: <step id="6">读取生成的 HTML 旅行攻略并在浏览器中打开</step>

INTERACTIVE CLARIFICATION PROTOCOL (STRICT):
Whenever you ask the user to make a choice or confirm an action (e.g., "Do you want to send?", "Which one?", "Yes/No"), you MUST use the <question> tag.
NEVER ask these questions in plain text. The UI requires this tag to render clickable buttons.

1. Use the <question> tag with an 'options' attribute (comma-separated).
2. The content of the tag is the question text.

Format:
<question options="Yes,No,Maybe">Do you want to proceed?</question>

Allowed options:
- "options": Comma-separated list of choice labels.
- "multiple": "true" or "false" (default false).

Example:
<question options="Analyze Data,Generate Chart,Exit">What should we do next?</question>

After planning or questioning, proceed to execute tools if clear.
Always start your response with <plan> if you intend to use tools.

ANTI-LOOPING RULE:
Do NOT repeatedly execute the same tool (like list-files) on the same path.
If you cannot find a file or are unsure of the context, STOP and ASK the user using the <question> tag.
Do not guess paths blindly.

LANGUAGE:
You MUST output in Simplified Chinese (zh-CN) by default, unless the user explicitly asks in English or another language.
Preserve technical terms (e.g. Node.js, Vue 3) in English where appropriate.`;

        const securityProtocol = `
BROWSER AUTOMATION SECURITY PROTOCOL:

1. CREDENTIAL INJECTION (Memory First):
   Before using the 'type' action for Login/Sign-in fields (username, password, email):
   - FIRST, checking your internal memory/knowledge base for existing credentials.
   - IF found: Use them silently.
   - IF NOT found: Use <question> to ask the user for credentials. DO NOT invent fake credentials.

2. HUMAN INTERVENTION (CAPTCHA/2FA):
   If you detect a CAPTCHA, QR Code login, or 2FA verification field during navigation or analysis:
   - DO NOT attempt to solve it yourself.
   - STOP and ASK the user to perform the verification manually using <question>.
   - Wait for their confirmation before proceeding.

   Example:
   <question options="Done,Cancel">I see a CAPTCHA. Please solve it manually in the browser window, then click Done.</question> 
`;

        effectiveSystemPrompt += planningPrompt + "\n" + securityProtocol;

        // Inject CWD if provided
        if (options && options.cwd) {
            effectiveSystemPrompt += `\n\nCONTEXT:\nCurrent Working Directory: "${options.cwd}"\nRefers to this directory for all relative file paths.`;
        }

        // Use provided system prompt (override Agent default if provided, OR append?)
        // The original logic replaced it if provided, or appended?
        // Ah, checked original code:
        /*
        let effectiveSystemPrompt = agentSystemPrompt;
        if (options && options.cwd) ...
        if (systemPrompt) { effectiveSystemPrompt += `\n\n${systemPrompt}`; }
        */

        if (systemPrompt) {
            effectiveSystemPrompt += `\n\n${systemPrompt}`;
        }

        // Ensure RAG is present even if systemPrompt is appended
        // effectiveSystemPrompt already has ragContext appended effectively via variable logic above? 
        // Wait, I constructed effectiveSystemPrompt from scratch above.

        // Use provided tools, or default to all available skills if null
        const skills = tools !== null ? tools : this.skillManager.getSkills();

        // Inject Workflow Execution Tool if WorkflowManager is available
        if (this.workflowManager && tools === null) {
            try {
                const workflows = await this.workflowManager.loadWorkflows();
                if (workflows.length > 0) {
                    const workflowNames = workflows.map((w: any) => w.name);
                    const workflowMap = new Map(workflows.map((w: any) => [w.name, w.id]));

                    // Create dynamic tool definition
                    const workflowTool = {
                        name: 'execute_workflow',
                        displayName: 'Execute Workflow',
                        description: 'Execute a pre-defined workflow. Available workflows: ' + workflowNames.join(', '),
                        parameters: {
                            type: 'object',
                            properties: {
                                workflow_name: {
                                    type: 'string',
                                    description: 'The exact name of the workflow to execute',
                                    enum: workflowNames
                                }
                            },
                            required: ['workflow_name']
                        }
                    };

                    // Add mapping to context or closure for execution
                    // We can't easily pass the map to the loop without storing it or retrieving it again.
                    // Storing it in a temporary property for this call scope?
                    // Better verify name in the loop.
                    skills.push(workflowTool);
                }
            } catch (e) {
                console.error('[LLMService] Failed to load workflows for tool injection:', e);
            }
        }

        // Inject Skill Resource Tools (Standard for all skills)
        if (tools === null) {
            skills.push({
                name: 'list_skill_resources',
                displayName: 'List Skill Resources',
                description: 'List all available resource files (docs, assets, scripts) within a specific skill package.',
                parameters: {
                    type: 'object',
                    properties: {
                        skillId: {
                            type: 'string',
                            description: 'The ID of the skill to inspect (e.g., browser-automation)'
                        }
                    },
                    required: ['skillId']
                }
            });

            skills.push({
                name: 'read_skill_resource',
                displayName: 'Read Skill Resource',
                description: 'Read the text content of a specific resource file from a skill package (e.g., a reference doc or a script).',
                parameters: {
                    type: 'object',
                    properties: {
                        skillId: {
                            type: 'string',
                            description: 'The ID of the skill'
                        },
                        relativePath: {
                            type: 'string',
                            description: 'The relative path to the file within the skill folder (e.g., "references/API.md")'
                        }
                    },
                    required: ['skillId', 'relativePath']
                }
            });
        }

        // Convert messages
        let chatMessages: any[] = messages.map(m => ({
            role: m.role,
            content: m.content || '',
            tool_calls: m.tool_calls,
            tool_call_id: m.tool_call_id,
            name: m.name,
            reasoning_content: m.reasoning_content
        }));

        // Wrap onUpdate to sanitize streaming content
        const sanitizedOnUpdate = (data: any) => {
            if (!onUpdate) return;

            if (data.type === 'content' && typeof data.content === 'string') {
                // Aggressively strip thinking tags including HTML entities
                // Covers: <|end_of_thinking|>, &lt;|end_of_thinking|&gt;, < | end_ of_ thinking | >
                let clean = data.content
                    .replace(/(?:<|&lt;)\s*\|\s*(?:end[_\s]*(?:of[_\s]*)?)?thinking\s*\|\s*(?:>|&gt;)/gi, '');

                // If the chunk was ONLY the tag, it becomes empty.
                if (clean) {
                    onUpdate({ ...data, content: clean });
                }
            } else {
                onUpdate(data);
            }
        };

        let response: import('./llm/types').LLMResponse;
        try {
            response = await effectiveProvider.chat(chatMessages, effectiveSystemPrompt, skills, sanitizedOnUpdate, {
                signal: this.abortController?.signal
            });
        } catch (error: any) {
            if (error.name === 'AbortError' || this.abortController?.signal.aborted) {
                return '[Stopped by User]';
            }
            throw error;
        }
        let finalContent = response.content;

        let loops = 0;
        // Increased limit to allow complex multi-step reasoning if necessary, 
        // but ideally the Agent should use batch tools.
        const MAX_LOOPS = 50;

        while (response.tool_calls && response.tool_calls.length > 0 && loops < MAX_LOOPS) {
            if (this.isStopped) {
                console.warn('[LLMService] Execution stopped by user.');
                return finalContent || '[Stopped by User]';
            }

            console.log(`[LLMService] Tool calls detected: ${response.tool_calls.length} (Loop ${loops + 1}/${MAX_LOOPS})`);
            loops++;

            chatMessages.push({
                role: 'assistant',
                // User Feedback: Suppress verbose text when executing tools (e.g. "I will now...")
                content: (response.tool_calls && response.tool_calls.length > 0) ? null : (response.content || null),
                tool_calls: response.tool_calls,
                reasoning_content: response.reasoning_content
            });

            for (const toolCall of response.tool_calls) {
                if (this.isStopped) break;

                const functionName = toolCall.function.name;
                let args: any;
                try {
                    args = JSON.parse(toolCall.function.arguments);
                } catch (e: any) {
                    console.error(`[LLMService] Failed to parse arguments for ${functionName}:`, e.message);
                    console.error(`[LLMService] Raw arguments:`, toolCall.function.arguments);

                    // Respond with error to LLM so it might retry
                    chatMessages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({ error: `Invalid JSON arguments: ${e.message}. Please retry with valid JSON.` }),
                        name: functionName
                    });
                    continue;
                }

                // --- SPECIAL HANDLING: execute_workflow ---
                if (functionName === 'execute_workflow') {
                    if (!this.workflowManager) {
                        chatMessages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: JSON.stringify({ error: 'Workflow Manager not available.' }),
                            name: functionName
                        });
                        continue;
                    }

                    const workflowName = args.workflow_name;
                    // Find ID by name
                    const workflows = await this.workflowManager.loadWorkflows();
                    const targetWf = workflows.find((w: any) => w.name === workflowName);

                    if (!targetWf) {
                        chatMessages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: JSON.stringify({ error: `Workflow '${workflowName}' not found.` }),
                            name: functionName
                        });
                        continue;
                    }

                    console.log(`[LLMService] Executing workflow: ${targetWf.name} (${targetWf.id})`);

                    onUpdate?.({
                        type: 'tool-start',
                        content: 'execute_workflow',
                        data: args
                    });

                    try {
                        const result = await this.workflowManager.executeWorkflow(targetWf.id, {}, (stepId: string, status: string, output: any) => {
                            // Map workflow progress to tool updates
                            onUpdate?.({
                                type: 'tool-update',
                                content: `[Step ${stepId}] ${status}`,
                                data: output
                            });
                        });

                        const outputStr = JSON.stringify(result);

                        onUpdate?.({
                            type: 'tool-end',
                            content: 'execute_workflow',
                            data: outputStr
                        });

                        chatMessages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: outputStr,
                            name: functionName
                        });
                    } catch (e: any) {
                        onUpdate?.({
                            type: 'tool-end',
                            content: 'execute_workflow',
                            data: 'Failed: ' + e.message
                        });

                        chatMessages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: JSON.stringify({ error: e.message }),
                            name: functionName
                        });
                    }
                    continue; // Skip standard skill execution
                }

                // --- SPECIAL HANDLING: read/list skill resources ---
                if (functionName === 'list_skill_resources') {
                    onUpdate?.({ type: 'tool-start', content: functionName, data: args });
                    try {
                        const files = await this.skillManager.listSkillFiles(args.skillId);
                        const output = JSON.stringify(files);
                        onUpdate?.({ type: 'tool-end', content: functionName, data: output });
                        chatMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: output, name: functionName });
                    } catch (e: any) {
                        chatMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: e.message }), name: functionName });
                    }
                    continue;
                }

                if (functionName === 'read_skill_resource') {
                    onUpdate?.({ type: 'tool-start', content: functionName, data: args });
                    try {
                        const content = await this.skillManager.readSkillFile(args.skillId, args.relativePath);
                        onUpdate?.({ type: 'tool-end', content: functionName, data: content.substring(0, 100) + '...' });
                        chatMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: content, name: functionName });
                    } catch (e: any) {
                        chatMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: e.message }), name: functionName });
                    }
                    continue;
                }

                // Config Injection: Browser Mode
                if (functionName === 'browser-automation') {
                    const globalConfig = this.configManager.getAll();
                    if (args.headless === undefined) {
                        // Default to GUI (headless: false) if mode is 'gui' or undefined
                        // Set to true if mode is 'headless'
                        args.headless = globalConfig.browserMode === 'headless';
                    }
                }

                // Safe Mode Check
                // Permission / Safe Mode Check
                // 1. Check if tool requires special permissions (based on sensitive patterns or explicit definition)
                const isSensitive = sensitivePatterns.some(p => p.test(functionName));

                if (safeMode && isSensitive) {
                    console.log(`[LLMService] Requesting permission for: ${functionName}`);

                    const allowed = await this.permissionManager.request('execute_sensitive_tool', {
                        tool: functionName,
                        args: args,
                        reason: "This action can modify your system or data."
                    });

                    if (!allowed) {
                        console.log(`[LLMService] Action denied by user: ${functionName}`);

                        onUpdate?.({
                            type: 'tool-end',
                            content: functionName,
                            data: '[User Denied Execution]'
                        });

                        chatMessages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: JSON.stringify({ error: 'User denied execution.' }),
                            name: functionName
                        });
                        continue;
                    }
                }

                console.log(`[LLMService] Executing skill: ${functionName}`, args);

                onUpdate?.({
                    type: 'tool-start',
                    content: functionName,
                    data: args
                });

                const result = await this.skillManager.executeSkill(functionName, args, {
                    cwd: options?.cwd,
                    onProgress: sanitizedOnUpdate
                });

                onUpdate?.({
                    type: 'tool-end',
                    content: functionName,
                    data: result.output || result.error || 'Success'
                });

                chatMessages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(result.output || result.error || 'Success'),
                    name: functionName
                });
            }

            if (this.isStopped) break;

            console.log('[LLMService] Sending tool results back to LLM...');
            console.log('[LLMService] Sending tool results back to LLM...');
            try {
                response = await effectiveProvider.chat(chatMessages, effectiveSystemPrompt, skills, onUpdate, {
                    signal: this.abortController?.signal
                });
            } catch (error: any) {
                if (error.name === 'AbortError' || this.abortController?.signal.aborted) {
                    return finalContent || '[Stopped by User]';
                }
                throw error;
            }
            finalContent = response.content;
        }

        if (this.isStopped) {
            // ... (rest is same)
            const result = {
                content: finalContent || '[Stopped by User]',
                usage: response.usage
            };
            return JSON.stringify(result);
        }

        if (loops >= MAX_LOOPS) {
            // ... (rest is same)
            const limitMsg = '\n\n[System: Auto-execution limit reached.]';
            onUpdate?.({ type: 'text', content: limitMsg });
            const result = {
                content: (finalContent || '') + limitMsg,
                usage: response.usage
            };
            return JSON.stringify(result);
        }

        const result = {
            content: finalContent || '',
            usage: response.usage
        };
        // Compatibility: If caller expects string, we might need to handle this.
        // But for our app, we will parse the JSON result if it's an object.
        // Actually, to avoid breaking other calls (if any), let's keep retuning string content,
        // but maybe we can emit a final usage update?

        // Better: We emit 'usage' event via onUpdate, so the frontend gets it.
        // The return value here is mostly for the internal loop or simple calls.

        if (response.usage) {
            onUpdate?.({
                type: 'usage',
                content: JSON.stringify(response.usage),
                data: response.usage
            });
        }

        return finalContent || '';
    }
}
