
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { Workflow, WorkflowStep } from '../types';
import { SkillManager } from './SkillManager';

export class WorkflowManager {
    private workflows: Map<string, Workflow> = new Map();
    private workflowsDir: string;
    private skillManager: SkillManager;
    private llmService: any; // Type as any to avoid circular dependency for now, or use interface

    constructor(skillManager: SkillManager, llmService: any) {
        this.skillManager = skillManager;
        this.llmService = llmService;
        this.workflowsDir = path.join(app.getPath('userData'), 'workflows');

        if (!fs.existsSync(this.workflowsDir)) {
            fs.mkdirSync(this.workflowsDir, { recursive: true });
        }
    }

    /**
     * Load all workflows from disk
     */
    async loadWorkflows(): Promise<Workflow[]> {
        // Always seed defaults to ensure latest version (Chinese)
        await this.seedDefaultWorkflows();

        const files = fs.readdirSync(this.workflowsDir).filter(f => f.endsWith('.json'));
        this.workflows.clear();

        for (const file of files) {
            try {
                const content = fs.readFileSync(path.join(this.workflowsDir, file), 'utf-8');
                const workflow = JSON.parse(content) as Workflow;
                this.workflows.set(workflow.id, workflow);
            } catch (e) {
                console.error(`Failed to load workflow ${file}:`, e);
            }
        }
        return Array.from(this.workflows.values());
    }

    private async seedDefaultWorkflows() {
        console.log('Seeding default workflows...');
        const defaults: Workflow[] = [
            {
                id: 'morning-briefing',
                name: '每日早报 (TechCrunch) 🌅',
                description: '抓取 TechCrunch 最新标题并生成中文摘要。',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                steps: [
                    {
                        id: 'step1',
                        type: 'skill',
                        skillId: 'browser-automation',
                        params: {
                            action: 'navigate',
                            url: 'https://techcrunch.com'
                        }
                    },
                    {
                        id: 'step2',
                        type: 'skill',
                        skillId: 'browser-automation',
                        params: {
                            action: 'extract',
                            selector: '.loop-card__title-link'
                        },
                        outputVar: 'headlines'
                    },
                    {
                        id: 'step3',
                        type: 'llm',
                        prompt: '请根据以下新闻标题，总结核心科技趋势（中文输出）：\n\n{{headlines}}'
                    }
                ]
            },
            {
                id: 'hn-top-story',
                name: 'Hacker News 热点 🚀',
                description: '获取 Hacker News 排名第一的文章。',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                steps: [
                    {
                        id: 'step1',
                        type: 'skill',
                        skillId: 'browser-automation',
                        params: {
                            action: 'navigate',
                            url: 'https://news.ycombinator.com'
                        }
                    },
                    {
                        id: 'step2',
                        type: 'skill',
                        skillId: 'browser-automation',
                        params: {
                            action: 'extract',
                            selector: '.titleline > a'
                        },
                        outputVar: 'top_story'
                    },
                    {
                        id: 'step3',
                        type: 'llm',
                        prompt: '请用中文解释为什么这条新闻对开发者很重要：{{top_story}}'
                    }
                ]
            },
            {
                id: 'smart-cleanup',
                name: '系统整理 (智能) 🧹',
                description: '分析下载文件夹并自动分类整理文件。',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                steps: [
                    {
                        id: 'step1',
                        type: 'skill',
                        skillId: 'system-operator', // control_app
                        params: {
                            // Actually system-operator has multiple tools. 
                            // Wait, system-operator skill takes `directory` and `strategy`. 
                            // But usually it runs "organize_files". Let's check parameters. 
                            // Assuming system-operator takes these top-level args.
                            directory: '~/Downloads',
                            strategy: 'smart_cleanup'
                        }
                    }
                ]
            },
            {
                id: 'smart-social-agent',
                name: 'Smart Social Agent (朋友圈助手) 🤖',
                description: '拍照 -> 分析 -> 自动评论。需要配合 WeChat Automation 技能使用。',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                steps: [
                    {
                        id: 'step1',
                        type: 'skill',
                        name: 'Scan Moment',
                        skillId: 'wechat-automation',
                        params: {
                            action: 'scan_latest'
                        },
                        outputVar: 'scan_result'
                    },
                    {
                        id: 'step2',
                        type: 'llm',
                        name: 'Analyze & Write',
                        prompt: "这张图是朋友圈的第一条动态。请分析图片内容（是风景、美食、还是日常吐槽？）。\\n如果是值得互动的积极内容，请写一句简短、幽默或温馨的中文评论（20字以内）。\\n如果是广告、二维码或无聊内容，请直接回复 'SKIP'。",
                        images: ["{{scan_result.screenshot_path}}"],
                        outputVar: 'comment_content'
                    },
                    {
                        id: 'step3',
                        type: 'skill',
                        name: 'Post Comment',
                        skillId: 'wechat-automation',
                        params: {
                            action: 'comment_latest',
                            comment_text: "{{comment_content}}"
                        }
                    }
                ]
            }
        ];

        for (const wf of defaults) {
            await this.saveWorkflow(wf);
        }
    }

    /**
     * Save a workflow
     */
    async saveWorkflow(workflow: Workflow): Promise<void> {
        workflow.updatedAt = Date.now();
        if (!workflow.createdAt) workflow.createdAt = Date.now();

        const filePath = path.join(this.workflowsDir, `${workflow.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2));
        this.workflows.set(workflow.id, workflow);
    }

    /**
     * Delete a workflow
     */
    async deleteWorkflow(id: string): Promise<void> {
        const filePath = path.join(this.workflowsDir, `${id}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        this.workflows.delete(id);
    }

    private activeExecutions: Map<string, boolean> = new Map();

    /**
     * Stop a running workflow
     */
    async stopWorkflow(id: string): Promise<boolean> {
        if (this.activeExecutions.has(id)) {
            console.log(`[Workflow] Stopping workflow ${id}`);
            this.activeExecutions.set(id, false); // Signal stop
            return true;
        }
        return false;
    }

    /**
     * Execute a workflow
     */
    async executeWorkflow(id: string, initialContext: Record<string, any> = {}, onProgress?: (stepId: string, status: string, output?: any) => void): Promise<Record<string, any>> {
        const workflow = this.workflows.get(id);
        if (!workflow) throw new Error(`Workflow ${id} not found`);

        const context = { ...initialContext };

        // Mark as running
        this.activeExecutions.set(id, true);

        try {
            // Emit Plan
            if (onProgress) {
                const planItems = workflow.steps.map(s => {
                    let desc = s.name || s.type;
                    if (s.type === 'skill' && s.params?.action) {
                        desc += ` (${s.params.action})`;
                    } else if (s.type === 'skill') {
                        desc = s.skillId || desc;
                    }
                    return {
                        id: s.id,
                        description: desc,
                        status: 'pending'
                    };
                });
                onProgress('workflow-plan', 'plan', planItems);
            }

            for (const step of workflow.steps) {
                // Check cancellation
                if (this.activeExecutions.get(id) === false) {
                    console.log(`[Workflow] Execution cancelled for ${id}`);
                    onProgress?.(step.id, 'cancelled', 'Workflow stopped by user');
                    break;
                }

                console.log(`[Workflow] Executing step ${step.id} (${step.type})`);
                onProgress?.(step.id, 'running');

                try {
                    let output: any = null;

                    if (step.type === 'skill') {
                        if (!step.skillId) throw new Error('Skill ID required');

                        // Substitute variables in params
                        const params = this.substituteVariables(step.params || {}, context);

                        const result = await this.skillManager.executeSkill(step.skillId, params);

                        // Check cancellation after execution
                        if (this.activeExecutions.get(id) === false) {
                            console.log(`[Workflow] Execution cancelled during step ${step.id}`);
                            onProgress?.(step.id, 'cancelled', 'Workflow stopped by user');
                            break;
                        }

                        if (!result.success) throw new Error(result.error);
                        output = result.output;
                    }
                    else if (step.type === 'llm') {
                        if (!step.prompt) throw new Error('Prompt required');

                        // Substitute variables in prompt
                        let rawPrompt = step.prompt;
                        if (Array.isArray(rawPrompt)) {
                            rawPrompt = rawPrompt.join('\n');
                        }
                        const prompt = this.substituteString(rawPrompt, context);

                        if (!this.llmService) throw new Error('LLM Service not available');

                        let content: any = prompt;

                        // Support Vision (Images)
                        if (step.images && Array.isArray(step.images) && step.images.length > 0) {
                            content = [{ type: 'text', text: prompt }];

                            for (const imgPathRaw of step.images) {
                                const imgPath = this.substituteString(imgPathRaw, context);
                                if (fs.existsSync(imgPath)) {
                                    const ext = path.extname(imgPath).toLowerCase();
                                    let mediaType = 'image/jpeg';
                                    if (ext === '.png') mediaType = 'image/png';
                                    else if (ext === '.webp') mediaType = 'image/webp';
                                    else if (ext === '.gif') mediaType = 'image/gif';

                                    const b64 = fs.readFileSync(imgPath, 'base64');
                                    // Anthropic / OpenAI compatible format
                                    content.push({
                                        type: 'image',
                                        source: {
                                            type: 'base64',
                                            media_type: mediaType,
                                            data: b64
                                        }
                                    });
                                } else {
                                    console.warn(`[Workflow] Image not found: ${imgPath}`);
                                }
                            }
                        }

                        const response = await this.llmService.chat([{ role: 'user', content: content }]);
                        output = response.content;
                    }
                    else if (step.type === 'delay') {
                        const duration = step.duration || 1000;
                        await new Promise(resolve => setTimeout(resolve, duration));
                        output = `Waited ${duration}ms`;
                    }

                    // Global cancellation check after ANY step execution
                    if (this.activeExecutions.get(id) === false) {
                        console.log(`[Workflow] Execution cancelled during step ${step.id}`);
                        onProgress?.(step.id, 'cancelled', 'Workflow stopped by user');
                        break;
                    }

                    // Store output if outputVar is defined
                    if (step.outputVar) {
                        context[step.outputVar] = output;
                    }

                    onProgress?.(step.id, 'completed', output);

                } catch (e: any) {
                    console.error(`[Workflow] Step ${step.id} failed:`, e);

                    if (step.continueOnError) {
                        onProgress?.(step.id, 'failed (continued)', e.message || 'Error occurred but execution continued');
                        // Optionally store error as output?
                        if (step.outputVar) {
                            context[step.outputVar] = { error: e.message };
                        }
                    } else {
                        onProgress?.(step.id, 'failed', e.message);
                        throw e; // Stop execution
                    }
                }
            }
        } finally {
            this.activeExecutions.delete(id);
        }

        return context;
    }

    private substituteVariables(params: Record<string, any>, context: Record<string, any>): Record<string, any> {
        const newParams: Record<string, any> = {};
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'string') {
                newParams[key] = this.substituteString(value, context);
            } else {
                newParams[key] = value;
            }
        }
        return newParams;
    }

    private substituteString(str: string, context: Record<string, any>): string {
        return str.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            const val = context[key.trim()];
            return val !== undefined ? String(val) : match;
        });
    }
}
