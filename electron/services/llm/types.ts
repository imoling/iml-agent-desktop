import { Skill } from '../../types';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> | null;
    tool_calls?: any[];
    tool_call_id?: string;
    name?: string;
    reasoning_content?: string; // DeepSeek R1 support
}

export interface LLMResponse {
    content: string;
    tool_calls?: any[];
    reasoning_content?: string; // DeepSeek R1 support
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface StreamEvent {
    type: 'text' | 'reasoning' | 'tool-start' | 'tool-update' | 'tool-end' | 'usage';
    content: string; // text content, or reasoning delta, or tool name, or usage json
    data?: any; // args for tool-start, result for tool-end, or usage object
}

export interface LLMProvider {
    chat(
        messages: ChatMessage[],
        systemPrompt?: string,
        skills?: Skill[],
        onUpdate?: (event: StreamEvent) => void,
        options?: { signal?: AbortSignal }
    ): Promise<LLMResponse>;

    getEmbedding?(text: string): Promise<number[]>;
}
