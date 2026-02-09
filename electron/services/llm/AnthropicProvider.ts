import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, ChatMessage, LLMResponse } from './types';
import { Skill } from '../../types';

export class AnthropicProvider implements LLMProvider {
    private client: Anthropic | null = null;
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string) {
        this.apiKey = apiKey;
        this.model = model;
    }

    private getClient(): Anthropic {
        if (!this.client) {
            this.client = new Anthropic({
                apiKey: this.apiKey,
            });
        }
        return this.client;
    }

    async chat(
        messages: ChatMessage[],
        systemPrompt?: string,
        skills?: Skill[],
        onUpdate?: (event: import('./types').StreamEvent) => void,
        options?: { signal?: AbortSignal }
    ): Promise<LLMResponse> {
        const client = this.getClient();
        console.log(`[Anthropic] Sending request... model=${this.model}`);

        // Convert skills to Anthropic tools
        const tools = skills?.map(skill => ({
            name: skill.name,
            description: skill.description,
            input_schema: skill.parameters || { type: 'object', properties: {} }
        }));

        try {
            const response = await client.messages.create({
                model: this.model || 'claude-3-5-sonnet-20240620',
                max_tokens: 8192, // Increased for long tasks
                system: systemPrompt,
                tools: tools as any,
                messages: messages.map(m => {
                    const content: any[] = [];
                    if (m.content) {
                        content.push({ type: 'text', text: m.content });
                    }
                    if (m.tool_calls) {
                        m.tool_calls.forEach((tc: any) => {
                            content.push({
                                type: 'tool_use',
                                id: tc.id,
                                name: tc.function.name,
                                input: JSON.parse(tc.function.arguments)
                            });
                        });
                    }
                    if (m.role === 'tool') {
                        return {
                            role: 'user',
                            content: [{
                                type: 'tool_result',
                                tool_use_id: m.tool_call_id,
                                content: m.content
                            }]
                        } as any;
                    }
                    return {
                        role: m.role as 'user' | 'assistant',
                        content: content
                    };
                }),
            });

            console.log(`[Anthropic] Response received. Stop reason: ${response.stop_reason}`);

            const usage = {
                prompt_tokens: response.usage.input_tokens,
                completion_tokens: response.usage.output_tokens,
                total_tokens: response.usage.input_tokens + response.usage.output_tokens
            };

            let finalContent = '';
            let tool_calls: any[] = [];

            for (const block of response.content) {
                if (block.type === 'text') {
                    finalContent += block.text;
                } else if (block.type === 'tool_use') {
                    tool_calls.push({
                        id: block.id,
                        type: 'function',
                        function: {
                            name: block.name,
                            arguments: JSON.stringify(block.input)
                        }
                    });
                }
            }

            return {
                content: finalContent,
                tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
                usage: usage
            };
        } catch (error) {
            console.error('[Anthropic] Error:', error);
            throw error;
        }
    }
}
