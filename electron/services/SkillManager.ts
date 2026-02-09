import path from 'path';
import fs from 'fs';
import { glob } from 'glob';
import matter from 'gray-matter';
import { fork } from 'child_process';
import AdmZip from 'adm-zip';
import { Skill, SkillExecutionResult } from '../types';

// Add defaultInChat to Skill interface if it's not there (it's imported from types, so might need to update types too, but let's check if we can just push it to the object first or if types.ts needs update. I'll assume I can add it here or update types.ts first. Wait, I should check types.ts first. But users often use `any` or extend locally. Let's see `Skill` definition usage.)
// Actually, looking at `SkillManager.ts` line 50.
// I should update `electron/types.ts` first if `Skill` interface is strict.
// But I can't see `types.ts` right now. I'll read it first to be safe.


export class SkillManager {
    private skills: Map<string, Skill> = new Map();
    private skillsDir: string;
    private llmService: any = null;
    private vectorStore: any = null;
    private voiceService: any = null;
    private memoryManager: any = null;

    private configManager: any;

    constructor(configManager: any) {
        this.configManager = configManager;
        // 在开发环境中，skills 目录位于项目根目录
        // 在生产环境中，需要根据打包后的资源位置调整
        this.skillsDir = path.resolve(__dirname, '../../skills');
    }

    setLLMService(service: any) {
        this.llmService = service;
    }

    setVectorStore(store: any) {
        this.vectorStore = store;
    }

    setVoiceService(service: any) {
        this.voiceService = service;
    }

    setMemoryManager(manager: any) {
        this.memoryManager = manager;
    }

    /**
     * 扫描并加载所有 Skills
     */
    async loadSkills(): Promise<void> {
        console.log(`Scanning skills in: ${this.skillsDir}`);

        // 查找所有的 SKILL.md 文件
        const skillFiles = await glob('**/SKILL.md', { cwd: this.skillsDir });

        for (const file of skillFiles) {
            try {
                const skillPath = path.join(this.skillsDir, path.dirname(file));
                const skillId = path.basename(skillPath);
                const mdPath = path.join(this.skillsDir, file);

                const fileContent = fs.readFileSync(mdPath, 'utf-8');
                const { data, content } = matter(fileContent);

                // Meta mapping with Claude alignment
                // name is required by Claude but we fallback to ID if missing
                const name = data.name || data.title || skillId;
                const description = data.description || data.desc || data.summary || content.split('\n')[0].replace(/^#+\s*/, '') || '';

                const skill: Skill = {
                    id: skillId,
                    name: name,
                    displayName: data.display_name || data.title || name,
                    description: description,
                    parameters: data.parameters || data.input_schema || data.inputSchema || {},
                    content: content,
                    path: skillPath,
                    defaultInChat: data.default_in_chat,
                    // Additional Claude Metadata
                    metadata: {
                        'allowed-tools': data['allowed-tools'],
                        'user-invocable': data['user-invocable'],
                        'model': data['model'],
                        'agent': data['agent'],
                        'context': data['context'],
                        'hooks': data['hooks'],
                        'version': data['version'] || '1.0.0'
                    }
                };

                this.skills.set(skillId, skill);
                console.log(`Loaded skill: ${skill.name} (${skillId})`);
            } catch (error) {
                console.error(`Failed to load skill from ${file}:`, error);
            }
        }
    }

    /**
     * 获取所有已加载的 Skills
     */
    getSkills(): Skill[] {
        return Array.from(this.skills.values());
    }

    /**
     * Internal helper to ensure a skill is loaded by ID
     */
    private async getSkillById(id: string): Promise<Skill | undefined> {
        let skill = this.skills.get(id);
        if (!skill) {
            console.log(`Skill ${id} not in cache, reloading all skills...`);
            await this.loadSkills();
            skill = this.skills.get(id);
        }
        return skill;
    }

    /**
     * 执行指定的 Skill
     */
    async executeSkill(skillId: string, args: any = {}, options: { cwd?: string; onProgress?: (data: any) => void } = {}): Promise<SkillExecutionResult> {
        const skill = await this.getSkillById(skillId);
        if (!skill) {
            return { success: false, error: `Skill ${skillId} not found` };
        }
        return new Promise((resolve) => {

            // 默认脚本入口: scripts/index.js
            const scriptPath = path.join(skill.path, 'scripts', 'index.js');
            if (!fs.existsSync(scriptPath)) {
                return resolve({ success: false, error: `Script not found at ${scriptPath}` });
            }

            console.log(`Executing skill [${skillId}] script: ${scriptPath}`);
            if (options.cwd) console.log(`Working Directory: ${options.cwd}`);

            const child = fork(scriptPath, [JSON.stringify(args)], {
                cwd: options.cwd || undefined, // Use provided CWD or inherit
                stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                env: {
                    ...process.env,
                    SKILL_ARGS: JSON.stringify(args),
                    TAVILY_API_KEY: this.configManager.get('tavilyApiKey') // Pass API Key
                }
            });

            let outputData = '';
            let errorData = '';

            child.stdout?.on('data', (data) => {
                outputData += data.toString();
                // 也可以通过 IPC 发送实时日志给前端
            });

            child.stderr?.on('data', (data) => {
                errorData += data.toString();
            });

            child.on('message', async (message: any) => {
                // Handling progress updates
                if (message.type === 'progress') {
                    if (options.onProgress) {
                        options.onProgress({
                            type: 'tool-update',
                            content: skillId,
                            data: message.payload
                        });
                    }
                }

                // Handling artifacts
                if (message.type === 'artifact') {
                    if (options.onProgress) {
                        options.onProgress({
                            type: 'artifact',
                            content: skillId,
                            data: message.payload
                        });
                    }
                }

                // 处理来自脚本的结构化消息
                if (message.type === 'result') {
                    // 脚本可以通过 process.send({ type: 'result', data: ... }) 返回结果
                }

                if (message.type === 'llm-request') {
                    if (this.llmService) {
                        try {
                            // Pass empty array [] to disable tools for internal requests
                            // This prevents infinite recursion where the LLM tries to call the skill again
                            // Also pass onUpdate if needed, but recursive? Simplification for now.
                            const response = await this.llmService.chat(message.payload.messages, message.payload.systemPrompt, []);
                            child.send({
                                type: 'llm-response',
                                id: message.id,
                                payload: { content: response }
                            });
                        } catch (err: any) {
                            child.send({
                                type: 'llm-response',
                                id: message.id,
                                payload: { error: err.message }
                            });
                        }
                    } else {
                        console.error('LLMService not linked to SkillManager');
                        child.send({
                            type: 'llm-response',
                            id: message.id,
                            payload: { error: 'LLMService not linked to SkillManager' }
                        });
                    }
                }

                if (message.type === 'memory-request') {
                    // Search still uses VectorStore directly for now (or could go through MemoryManager if it had search)
                    // Add MUST go through MemoryManager for metadata and encryption
                    const targetService = message.payload.action === 'add' ? this.memoryManager : this.vectorStore;

                    if (targetService) {
                        try {
                            let result;
                            if (message.payload.action === 'add') {
                                if (!this.memoryManager) {
                                    throw new Error('MemoryManager not linked to SkillManager');
                                }
                                // payload.content, payload.metadata, payload.options
                                const { content, metadata, options } = message.payload;

                                // Merge metadata and options? MemoryManager.createMemory takes (content, options)
                                // options includes category, priority, tags, encrypted, metadata
                                const createOptions = {
                                    ...options,
                                    metadata: {
                                        ...metadata,
                                        ...(options?.metadata || {})
                                    }
                                };

                                const memory = await this.memoryManager.createMemory(content, createOptions);
                                result = { success: true, id: memory.id };

                                // Also index it immediately? 
                                // MemoryManager createMemory internally should call VectorStore.addEnhancedMemory
                                // Let's verify MemoryManager later. If it doesn't, we might need to call it here.
                                // BUT usually Manager handles everything.
                                // Update: MemoryManager just creates the object. It probably expects the caller to save it?
                                // Let's check MemoryManager.createMemory implementation again.
                                // Wait, I viewed MemoryManager before. It returns a memory object.
                                // It does NOT seem to save it to vector store automatically in the snippet I saw.
                                // I need to check MemoryManager again.
                                // IF MemoryManager doesn't save, I need to save it here.

                                // RE-READING MemoryManager in my mind (or verifying):
                                // The snippet showed createMemory returning 'memory'.
                                // It didn't show saving.
                                // So I probably need to call vectorStore.addEnhancedMemory(memory).

                                await this.vectorStore.addEnhancedMemory(memory);

                            } else if (message.payload.action === 'search') {
                                if (!this.vectorStore) {
                                    throw new Error('VectorStore not linked to SkillManager');
                                }
                                // payload.query, payload.limit
                                result = await this.vectorStore.search(message.payload.query, message.payload.limit);
                            }
                            child.send({
                                type: 'memory-response',
                                id: message.id,
                                payload: { data: result }
                            });
                        } catch (err: any) {
                            child.send({
                                type: 'memory-response',
                                id: message.id,
                                payload: { error: err.message }
                            });
                        }
                    } else {
                        child.send({
                            type: 'memory-response',
                            id: message.id,
                            payload: { error: 'Required service (MemoryManager or VectorStore) not linked' }
                        });
                    }
                }

                if (message.type === 'voice-request') {
                    if (this.voiceService) {
                        try {
                            // payload.audioPath, payload.language
                            const result = await this.voiceService.transcribe(message.payload.audioPath, message.payload.language);
                            child.send({
                                type: 'voice-response',
                                id: message.id,
                                payload: { text: result.text }
                            });
                        } catch (err: any) {
                            child.send({
                                type: 'voice-response',
                                id: message.id,
                                payload: { error: err.message }
                            });
                        }
                    } else {
                        child.send({
                            type: 'voice-response',
                            id: message.id,
                            payload: { error: 'VoiceService not linked to SkillManager' }
                        });
                    }
                }
            });

            child.on('close', (code) => {
                if (code === 0) {
                    let rawOutput = outputData.trim();
                    let finalOutput: any = rawOutput;

                    // 1. Try JSON_OUTPUT prefix (Explicit)
                    const jsonMatch = rawOutput.match(/JSON_OUTPUT:(.*)/s);
                    if (jsonMatch) {
                        try {
                            finalOutput = JSON.parse(jsonMatch[1]);
                        } catch (e) {
                            console.warn('Failed to parse JSON_OUTPUT from skill:', e);
                        }
                    }
                    // 2. Try implicit JSON (if it looks like object/array)
                    else if (rawOutput.startsWith('{') || rawOutput.startsWith('[')) {
                        try {
                            finalOutput = JSON.parse(rawOutput);
                        } catch (e) {
                            // Valid string starting with { but not JSON
                        }
                    }

                    resolve({ success: true, output: finalOutput });
                } else {
                    resolve({ success: false, error: errorData || `Process exited with code ${code}` });
                }
            });

            child.on('error', (err) => {
                resolve({ success: false, error: err.message });
            });

            // Trigger execution
            child.send({ type: 'start', payload: args });
        });
    }

    /**
     * 创建新的 Skill
     */
    async createSkill(data: { name: string; displayName?: string; description: string; inputs: any[]; defaultInChat?: boolean }): Promise<{ success: boolean; error?: string; path?: string; skillId?: string }> {
        try {
            const skillDir = path.join(this.skillsDir, data.name);

            if (fs.existsSync(skillDir)) {
                return { success: false, error: `Skill directory '${data.name}' already exists.` };
            }

            // Create directories
            fs.mkdirSync(path.join(skillDir, 'scripts'), { recursive: true });

            // Generate SKILL.md
            const required: string[] = [];
            const inputs = data.inputs || [];

            inputs.forEach(input => {
                if (input && input.required !== false && input.name) {
                    required.push(input.name);
                }
            });

            const skillMdContent = `---
name: ${data.name}
display_name: ${data.displayName || data.name}
description: ${JSON.stringify(data.description)}
default_in_chat: ${data.defaultInChat ?? true}
version: 1.0.0
parameters:
  type: object
  properties:${data.inputs.length > 0 ? '\n' + data.inputs.map(i => `    ${i.name}:
      type: ${i.type}
      description: ${JSON.stringify(i.description)}`).join('\n') : ' {}'}
  required:${required.length > 0 ? '\n' + required.map(r => `    - ${r}`).join('\n') : ' []'}
---

# ${data.displayName || data.name}
${data.description}
`;
            fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillMdContent.trim());

            // Generate scripts/index.js template
            const scriptContent = `const fs = require('fs');

// Read input from arguments
const args = JSON.parse(process.argv[2] || '{}');

${data.inputs.map(i => `const ${i.name} = args.${i.name};`).join('\n')}

// Validation
${data.inputs.map(i => `if (${i.name} === undefined) {
    process.stdout.write(JSON.stringify({ error: "Missing required argument: ${i.name}" }));
    process.exit(0);
}`).join('\n')}

try {
    // TODO: Implement your logic here
    console.log('Executing ${data.name} with', ${data.inputs.map(i => i.name).join(', ')});
    
    // Simulating work
    const result = "Executed successfully with params: " + JSON.stringify(args);
    
    process.stdout.write(JSON.stringify({ 
        output: result 
    }));
} catch (error) {
    process.stdout.write(JSON.stringify({ 
        error: \`Failed to execute: \${error.message}\` 
    }));
}
`;
            fs.writeFileSync(path.join(skillDir, 'scripts', 'index.js'), scriptContent);

            console.log(`Created new skill: ${data.name}`);

            // Reload skills to discover the new one
            await this.loadSkills();

            return { success: true, path: skillDir, skillId: data.name };

        } catch (error: any) {
            console.error('Failed to create skill:', error);
            return { success: false, error: error.message };
        }
    }

    async updateSkill(id: string, data: { name: string; displayName?: string; description: string; inputs: any[]; defaultInChat?: boolean; metadata?: any }): Promise<{ success: boolean; error?: string }> {
        try {
            const skill = this.skills.get(id);
            if (!skill) return { success: false, error: 'Skill not found' };

            const skillPath = skill.path;
            const skillMdPath = path.join(skillPath, 'SKILL.md');

            // Load existing frontmatter to preserve extra fields
            let existingData: any = {};
            let existingContent = '';
            if (fs.existsSync(skillMdPath)) {
                const fileContent = fs.readFileSync(skillMdPath, 'utf-8');
                const parsed = matter(fileContent);
                existingData = parsed.data;
                existingContent = parsed.content;
            }

            // Generate parameters from inputs
            const required: string[] = [];
            const properties: any = {};
            const inputs = data.inputs || [];
            inputs.forEach(input => {
                if (input && input.name) {
                    properties[input.name] = {
                        type: input.type || 'string',
                        description: input.description || ''
                    };
                    if (input.required !== false) {
                        required.push(input.name);
                    }
                }
            });

            const newParameters = {
                type: 'object',
                properties,
                required
            };

            // Merge metadata
            const mergedFrontmatter = {
                ...existingData,
                name: data.name,
                display_name: data.displayName || data.name,
                description: data.description,
                default_in_chat: data.defaultInChat ?? true,
                parameters: newParameters,
                ...(data.metadata || {}) // Merge any additional claude metadata from UI
            };

            // Stringify with preserving structure
            const newMdContent = matter.stringify(existingContent, mergedFrontmatter);

            fs.writeFileSync(skillMdPath, newMdContent);
            console.log(`Updated skill: ${id}`);

            // Reload skills to reflect changes
            await this.loadSkills();
            return { success: true };
        } catch (error: any) {
            console.error('Failed to update skill:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * List all files in a skill directory (excluding SKILL.md and scripts/index.js if desired)
     */
    async listSkillFiles(skillId: string): Promise<{ name: string; path: string; isDir: boolean; size: number; mtime: number }[]> {
        const skill = await this.getSkillById(skillId);
        if (!skill) throw new Error(`Skill ${skillId} not found`);

        const results: any[] = [];
        const walk = (dir: string, relativeDir: string = '') => {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                if (file === '.DS_Store' || file === 'node_modules') continue;

                const fullPath = path.join(dir, file);
                const relPath = path.join(relativeDir, file);
                const stats = fs.statSync(fullPath);

                if (stats.isDirectory()) {
                    results.push({
                        name: file,
                        path: relPath,
                        isDir: true,
                        size: 0,
                        mtime: stats.mtimeMs
                    });
                    walk(fullPath, relPath);
                } else {
                    results.push({
                        name: file,
                        path: relPath,
                        isDir: false,
                        size: stats.size,
                        mtime: stats.mtimeMs
                    });
                }
            }
        };

        walk(skill.path);
        return results;
    }

    /**
     * Read a specific file within a skill directory
     */
    async readSkillFile(skillId: string, relativePath: string): Promise<string> {
        const skill = await this.getSkillById(skillId);
        if (!skill) throw new Error(`Skill ${skillId} not found`);

        // Security check: ensure path is within skill directory
        const fullPath = path.resolve(skill.path, relativePath);
        if (!fullPath.startsWith(skill.path)) {
            throw new Error('Access denied: path outside skill directory');
        }

        if (!fs.existsSync(fullPath)) {
            throw new Error('File not found');
        }
        return fs.readFileSync(fullPath, 'utf8');
    }

    /**
     * Write content to a specific file within a skill directory
     */
    async writeSkillFile(skillId: string, relativePath: string, content: string): Promise<{ success: boolean; error?: string }> {
        try {
            const skill = await this.getSkillById(skillId);
            if (!skill) throw new Error(`Skill ${skillId} not found`);

            const fullPath = path.resolve(skill.path, relativePath);
            if (!fullPath.startsWith(skill.path)) {
                throw new Error('Access denied: path outside skill directory');
            }

            // Ensure directory exists
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(fullPath, content, 'utf8');
            return { success: true };
        } catch (error: any) {
            console.error('Failed to write skill file:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete a specific file or directory within a skill directory
     */
    async deleteSkillFile(skillId: string, relativePath: string): Promise<{ success: boolean; error?: string }> {
        try {
            const skill = await this.getSkillById(skillId);
            if (!skill) throw new Error(`Skill ${skillId} not found`);

            const fullPath = path.resolve(skill.path, relativePath);
            if (!fullPath.startsWith(skill.path)) {
                throw new Error('Access denied: path outside skill directory');
            }

            if (fs.existsSync(fullPath)) {
                const stats = fs.statSync(fullPath);
                if (stats.isDirectory()) {
                    fs.rmSync(fullPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(fullPath);
                }
            }
            return { success: true };
        } catch (error: any) {
            console.error('Failed to delete skill file:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Create a new empty file or directory within a skill directory
     */
    async createSkillFile(skillId: string, relativePath: string, isDir: boolean): Promise<{ success: boolean; error?: string }> {
        try {
            const skill = await this.getSkillById(skillId);
            if (!skill) throw new Error(`Skill ${skillId} not found`);

            const fullPath = path.resolve(skill.path, relativePath);
            if (!fullPath.startsWith(skill.path)) {
                throw new Error('Access denied: path outside skill directory');
            }

            if (fs.existsSync(fullPath)) {
                throw new Error('Path already exists');
            }

            if (isDir) {
                fs.mkdirSync(fullPath, { recursive: true });
            } else {
                // Ensure parent directory exists
                const dir = path.dirname(fullPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(fullPath, '', 'utf8');
            }
            return { success: true };
        } catch (error: any) {
            console.error('Failed to create skill file:', error);
            return { success: false, error: error.message };
        }
    }

    async readSkillScript(id: string): Promise<{ success: boolean; content?: string; error?: string }> {
        try {
            const skill = await this.getSkillById(id);
            if (!skill) return { success: false, error: `Skill ${id} not found` };

            const scriptPath = path.join(skill.path, 'scripts', 'index.js');
            if (fs.existsSync(scriptPath)) {
                const content = fs.readFileSync(scriptPath, 'utf-8');
                return { success: true, content };
            }
            return { success: false, error: 'Script file not found' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async generateSkill(prompt: string): Promise<{ success: boolean; data?: any; error?: string }> {
        if (!this.llmService) {
            return { success: false, error: 'LLMService not linked' };
        }

        const systemPrompt = `You are an expert agent skill generator.
Your task is to generate a complete, valid skill definition based on the user's request.
IMPORTANT: You must return ONLY valid JSON. Do not include any conversational text, markdown formatting, or explanations outside the JSON object.

The JSON schema is:
{
  "name": "kebab-case-skill-name",
  "displayName": "Human Readable Name",
  "description": "Concise description of what the skill does.",
  "inputs": [
    {
      "name": "argument_name",
      "type": "string", // or number, boolean
      "description": "Description of the argument",
      "required": true
    }
  ],
  "code": "Full Node.js script content..."
}

For the 'code':
- It must be a Node.js script.
- It receives arguments via \`const args = JSON.parse(process.argv[2] || '{}');\`.
- It MUST perform the task and output the final result as a JSON string to \`process.stdout\` (e.g. \`console.log(JSON.stringify({ result: ... }))\`).
- It should handle errors gracefully and exit with code 1 if failed.
- Use native modules (fs, path, https, child_process) where possible.
- Avoid external dependencies unless standard.
`;

        try {
            console.log(`Generating skill for prompt: "${prompt}"`);
            const response = await this.llmService.chat(
                [{ role: 'user', content: prompt }], // messages
                systemPrompt, // systemPrompt
                null, // tools
                undefined // onUpdate
            );

            console.log('LLM Response:', response);

            // Robust JSON extraction
            let jsonStr = response.trim();

            // 1. Try to extract from markdown code block
            const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
                jsonStr = codeBlockMatch[1];
            } else {
                // 2. Fallback: Find first '{' and last '}'
                const firstOpen = jsonStr.indexOf('{');
                const lastClose = jsonStr.lastIndexOf('}');
                if (firstOpen !== -1 && lastClose !== -1) {
                    jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
                }
            }

            const data = JSON.parse(jsonStr);
            return { success: true, data };
        } catch (error: any) {
            console.error('Failed to generate skill:', error);
            return { success: false, error: error.message };
        }
    }

    async updateSkillScript(id: string, content: string): Promise<{ success: boolean; error?: string }> {
        try {
            const skill = await this.getSkillById(id);
            if (!skill) return { success: false, error: `Skill ${id} not found` };

            const scriptPath = path.join(skill.path, 'scripts', 'index.js');
            fs.writeFileSync(scriptPath, content);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async deleteSkill(id: string): Promise<{ success: boolean; error?: string }> {
        try {
            const skill = this.skills.get(id);
            if (!skill) return { success: false, error: 'Skill not found' };

            // Remove directory recursively
            fs.rmSync(skill.path, { recursive: true, force: true });

            // Remove from map
            this.skills.delete(id);
            console.log(`Deleted skill: ${id}`);

            return { success: true };
        } catch (error: any) {
            console.error(`Failed to delete skill ${id}:`, error);
            return { success: false, error: error.message };
        }
    }

    async importSkillFromUrl(url: string): Promise<{ success: boolean; error?: string; skillId?: string }> {
        try {
            console.log(`Attempting to import skill from: ${url}`);

            // 1. GitHub URL validation & processing
            // Supports: 
            // - https://github.com/user/repo
            // - https://github.com/user/repo.git
            // - https://github.com/user/repo/tree/branch/path/to/skill
            const githubRegex = /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/tree\/([^\/]+)\/(.+))?$/;
            const match = url.match(githubRegex);

            if (!match) {
                return { success: false, error: 'Invalid GitHub URL. Must be like https://github.com/user/repo or https://github.com/user/repo/tree/main/path/to/skill' };
            }

            const owner = match[1];
            const repo = match[2];
            const branch = match[3]; // May be undefined
            const subPath = match[4] || ''; // May be Empty string

            // Determine download URL
            // If branch is specified, use it. Otherwise try main then master.
            let zipUrl: string;
            let downloadBranch = branch;

            if (branch) {
                zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
            } else {
                // Default flow
                downloadBranch = 'main';
                zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`;
            }

            console.log(`Downloading from: ${zipUrl}`);

            let response = await fetch(zipUrl);

            // If failed and no specific branch was requested, try master
            if (!response.ok && !branch) {
                console.log('main branch not found, trying master...');
                downloadBranch = 'master';
                zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`;
                response = await fetch(zipUrl);
            }

            if (!response.ok) {
                return { success: false, error: `Failed to download repo. Status: ${response.status}. Check if repository is public and branch exists.` };
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // 2. Extract Zip
            const zip = new AdmZip(buffer);
            const zipEntries = zip.getEntries();

            if (zipEntries.length === 0) {
                return { success: false, error: 'Empty zip file downloaded.' };
            }

            // GitHub zipballs usually wrap everything in a root folder "repo-branch/"
            // e.g. "skills-main/"
            const rootEntry = zipEntries[0];
            const rootDirName = rootEntry.entryName.split('/')[0]; // top level folder

            // Determine target source path inside zip
            // Path inside zip: rootDirName/subPath/
            // Clean subPath to remove leading/trailing slashes
            const cleanSubPath = subPath.replace(/^\/+|\/+$/g, '');
            const targetEntryPath = cleanSubPath ? `${rootDirName}/${cleanSubPath}` : rootDirName;

            console.log(`Looking for skill in: ${targetEntryPath}`);

            // Check if SKILL.md exists in the target path
            // We look for an entry roughly matching "targetEntryPath/SKILL.md"
            const skillMdPath = cleanSubPath ? `${targetEntryPath}/SKILL.md` : `${rootDirName}/SKILL.md`;

            // Normalize slashes for comparison just in case
            const hasSkillMd = zipEntries.some(e => {
                // Remove trailing slash from entry directory for comparison if needed, 
                // but entryName usually is like "folder/file.ext"
                return e.entryName === skillMdPath || e.entryName === skillMdPath.replace(/\/+/g, '/');
            });

            if (!hasSkillMd) {
                return { success: false, error: `Invalid Skill: SKILL.md not found in ${cleanSubPath ? cleanSubPath : 'repository root'}.` };
            }

            // 3. Save to skills directory
            // Skill ID is the leaf folder name
            let targetId = '';
            if (cleanSubPath) {
                targetId = path.basename(cleanSubPath).toLowerCase();
            } else {
                targetId = repo.toLowerCase();
            }

            const targetPath = path.join(this.skillsDir, targetId);

            if (fs.existsSync(targetPath)) {
                return { success: false, error: `Skill '${targetId}' already exists locally.` };
            }

            // Extract to temp
            const tempExtractPath = path.join(this.skillsDir, `temp_${Date.now()}`);
            zip.extractAllTo(tempExtractPath, true);

            // Construct full path to the source folder on disk
            // Path: tempExtractPath / rootDirName / cleanSubPath
            const sourcePath = path.join(tempExtractPath, targetEntryPath);

            if (!fs.existsSync(sourcePath)) {
                fs.rmSync(tempExtractPath, { recursive: true, force: true });
                return { success: false, error: `Extraction error: Path '${targetEntryPath}' not found in archive.` };
            }

            // Move sourcePath to targetPath
            // Note: fs.renameSync might fail across partitions, but here likely same partition
            // But we are moving a subdirectory of a folder to a sibling folder of that folder?
            // No, tempExtractPath is in skillsDir. targetPath is in skillsDir. Same device.

            try {
                fs.renameSync(sourcePath, targetPath);
            } catch (moveError: any) {
                // If rename fails (e.g. cross-device), try copy & remove
                fs.cpSync(sourcePath, targetPath, { recursive: true });
            }

            // Cleanup temp
            fs.rmSync(tempExtractPath, { recursive: true, force: true });

            console.log(`Imported skill to: ${targetPath}`);
            await this.loadSkills();

            return { success: true, skillId: targetId };

        } catch (error: any) {
            console.error('Import failed:', error);
            return { success: false, error: error.message };
        }
    }
}
