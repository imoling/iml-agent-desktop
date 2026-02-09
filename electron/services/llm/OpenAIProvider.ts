import OpenAI from 'openai';
import { LLMProvider, ChatMessage, LLMResponse } from './types';
import { Skill } from '../../types';

export class OpenAIProvider implements LLMProvider {
    private client: OpenAI | null = null;
    private apiKey: string;
    private baseURL: string;
    private model: string;

    constructor(apiKey: string, baseURL: string, model: string) {
        this.apiKey = apiKey;
        this.baseURL = baseURL;
        this.model = model;
    }

    private getClient(): OpenAI {
        if (!this.client) {
            this.client = new OpenAI({
                apiKey: this.apiKey,
                baseURL: this.baseURL || undefined,
                timeout: 1200 * 1000, // 20 minutes (Fix for Deepseek-R1 timeouts)
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
        console.log(`[OpenAI] Sending request... model=${this.model}, baseURL=${this.baseURL}`);

        const formattedMessages: any[] = [];

        if (systemPrompt) {
            formattedMessages.push({ role: 'system', content: systemPrompt });
        }

        formattedMessages.push(...messages.map(m => ({
            role: m.role,
            content: m.content,
            tool_calls: (m as any).tool_calls,
            tool_call_id: (m as any).tool_call_id,
            name: (m as any).name,
            reasoning_content: (m as any).reasoning_content // Pass reasoning for R1
        })));

        const tools = skills?.map(skill => {
            const hasParams = skill.parameters && Object.keys(skill.parameters).length > 0;
            return {
                type: 'function',
                function: {
                    name: skill.name,
                    description: skill.description,
                    parameters: hasParams ? skill.parameters : { type: 'object', properties: {} }
                }
            };
        });

        // Enable streaming if onUpdate is provided
        const isStreaming = !!onUpdate;

        try {
            if (isStreaming) {
                const stream = await client.chat.completions.create({
                    model: this.model,
                    messages: formattedMessages,
                    tools: tools as any,
                    tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
                    stream: true,
                    stream_options: { include_usage: true }, // Enable usage reporting
                }, { signal: options?.signal });

                let fullContent = '';
                let fullReasoning = '';
                let toolCallsMap: Record<number, any> = {};
                let finalUsage: any = undefined;

                for await (const chunk of stream) {
                    const delta = chunk.choices[0]?.delta;

                    if (delta?.content) {
                        fullContent += delta.content;
                        onUpdate?.({ type: 'text', content: delta.content });
                    }


                    if ((delta as any)?.reasoning_content) {
                        const rDelta = (delta as any).reasoning_content;
                        fullReasoning += rDelta;
                        console.log('[OpenAI] Reasoning delta received:', rDelta.substring(0, 100));
                        onUpdate?.({ type: 'reasoning', content: rDelta });
                    }


                    if (delta?.tool_calls) {
                        for (const toolCallChunk of delta.tool_calls) {
                            const index = toolCallChunk.index;
                            if (!toolCallsMap[index]) {
                                toolCallsMap[index] = {
                                    id: toolCallChunk.id || '',
                                    type: toolCallChunk.type || 'function',
                                    function: {
                                        name: toolCallChunk.function?.name || '',
                                        arguments: toolCallChunk.function?.arguments || ''
                                    }
                                };
                            } else {
                                if (toolCallChunk.function?.arguments) {
                                    toolCallsMap[index].function.arguments += toolCallChunk.function.arguments;
                                }
                            }
                        }
                    }

                    // Capture usage from the final chunk (usually has usage but no choices)
                    if (chunk.usage) {
                        finalUsage = chunk.usage;
                        onUpdate?.({
                            type: 'usage',
                            content: JSON.stringify(finalUsage),
                            data: finalUsage
                        });
                    }
                }

                const tool_calls = Object.values(toolCallsMap);

                return {
                    content: fullContent,
                    tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
                    reasoning_content: fullReasoning || undefined,
                    usage: finalUsage
                };
            } else {
                const response = await client.chat.completions.create({
                    model: this.model,
                    messages: formattedMessages,
                    tools: tools as any,
                    tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
                }, { signal: options?.signal });

                const choice = response.choices[0];
                return {
                    content: choice.message.content || '',
                    tool_calls: choice.message.tool_calls,
                    reasoning_content: (choice.message as any).reasoning_content,
                    usage: response.usage
                };
            }
        } catch (error) {
            console.error('[OpenAI] Error:', error);
            throw error;
        }
    }

    async getEmbedding(text: string): Promise<number[]> {
        const client = this.getClient();
        try {
            // Use a standard efficient embedding model
            // Ideally this should be configurable, but 3-small is a good default for OpenAI
            const response = await client.embeddings.create({
                model: 'text-embedding-3-small',
                input: text,
            });
            return response.data[0].embedding;
        } catch (error) {
            console.error('[OpenAI] Embedding Error:', error);
            throw error;
        }
    }
}
