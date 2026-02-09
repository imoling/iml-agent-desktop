import { Tiktoken, encoding_for_model, get_encoding } from 'tiktoken';
import { getModelConfig } from '../config/modelLimits';

/**
 * Token counter utility for accurate token counting
 */
export class TokenCounter {
    private encoders: Map<string, Tiktoken> = new Map();
    private cache: Map<string, number> = new Map();

    /**
     * Get or create encoder for a specific encoding
     */
    private getEncoder(encodingName: string): Tiktoken {
        if (!this.encoders.has(encodingName)) {
            try {
                const encoder = get_encoding(encodingName as any);
                this.encoders.set(encodingName, encoder);
            } catch (error) {
                console.warn(`[TokenCounter] Failed to load encoding ${encodingName}, using cl100k_base`);
                const encoder = get_encoding('cl100k_base');
                this.encoders.set(encodingName, encoder);
            }
        }
        return this.encoders.get(encodingName)!;
    }

    /**
     * Count tokens in a single text string
     */
    countText(text: string, modelName: string): number {
        if (!text) return 0;

        // Check cache
        const cacheKey = `${modelName}:${text.substring(0, 100)}:${text.length}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        const config = getModelConfig(modelName);
        const encoder = this.getEncoder(config.encoding);

        try {
            const tokens = encoder.encode(text);
            const count = tokens.length;

            // Cache the result
            this.cache.set(cacheKey, count);

            // Limit cache size
            if (this.cache.size > 1000) {
                const firstKey = this.cache.keys().next().value;
                if (firstKey) {
                    this.cache.delete(firstKey);
                }
            }

            return count;
        } catch (error) {
            console.error('[TokenCounter] Error counting tokens:', error);
            // Fallback: rough estimate (1 token ≈ 4 characters)
            return Math.ceil(text.length / 4);
        }
    }

    /**
     * Count tokens in a message object
     */
    countMessage(message: any, modelName: string): number {
        let total = 0;

        // Count content
        if (typeof message.content === 'string') {
            total += this.countText(message.content, modelName);
        } else if (Array.isArray(message.content)) {
            // Multi-modal content
            for (const part of message.content) {
                if (part.type === 'text' && part.text) {
                    total += this.countText(part.text, modelName);
                }
                // Images are counted separately by the API
            }
        }

        // Count tool calls
        if (message.tool_calls && Array.isArray(message.tool_calls)) {
            for (const toolCall of message.tool_calls) {
                total += this.countText(toolCall.function.name, modelName);
                total += this.countText(toolCall.function.arguments, modelName);
            }
        }

        // Count reasoning content (DeepSeek R1)
        if (message.reasoning_content) {
            total += this.countText(message.reasoning_content, modelName);
        }

        // Add overhead for message formatting (role, etc.)
        // OpenAI format: ~4 tokens per message
        total += 4;

        return total;
    }

    /**
     * Count tokens in an array of messages
     */
    countMessages(messages: any[], modelName: string): number {
        let total = 0;
        for (const message of messages) {
            total += this.countMessage(message, modelName);
        }
        // Add overhead for conversation priming
        total += 3;
        return total;
    }

    /**
     * Count tokens in system prompt
     */
    countSystemPrompt(systemPrompt: string | undefined, modelName: string): number {
        if (!systemPrompt) return 0;
        return this.countText(systemPrompt, modelName) + 4; // +4 for message overhead
    }

    /**
     * Estimate total tokens for a chat request
     */
    estimateTotal(
        messages: any[],
        systemPrompt: string | undefined,
        modelName: string
    ): number {
        let total = 0;

        if (systemPrompt) {
            total += this.countSystemPrompt(systemPrompt, modelName);
        }

        total += this.countMessages(messages, modelName);

        return total;
    }

    /**
     * Clean up encoders
     */
    dispose() {
        for (const encoder of this.encoders.values()) {
            encoder.free();
        }
        this.encoders.clear();
        this.cache.clear();
    }
}

// Singleton instance
let tokenCounterInstance: TokenCounter | null = null;

export function getTokenCounter(): TokenCounter {
    if (!tokenCounterInstance) {
        tokenCounterInstance = new TokenCounter();
    }
    return tokenCounterInstance;
}
