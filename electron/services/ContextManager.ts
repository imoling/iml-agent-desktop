import { getTokenCounter } from '../utils/TokenCounter';
import { getModelConfig } from '../config/modelLimits';
import { LLMProvider } from './llm/types';

/**
 * Message with priority score
 */
interface ScoredMessage {
    message: any;
    score: number;
    index: number;
}

/**
 * Compression strategy configuration
 */
export interface CompressionStrategy {
    // Enable smart summarization
    enableSummary: boolean;

    // Preserve tool calls
    preserveToolCalls: boolean;

    // Aggressiveness: 'conservative' | 'balanced' | 'aggressive'
    aggressiveness: 'conservative' | 'balanced' | 'aggressive';
}

/**
 * Context Manager for intelligent conversation history management
 */
export class ContextManager {
    private summaryCache: Map<string, string> = new Map();

    /**
     * Calculate priority score for a message
     * Higher score = higher priority to keep
     */
    calculatePriority(message: any, index: number, totalMessages: number): number {
        let score = 0;

        // 1. Recency bonus (most important factor)
        const recencyRatio = index / totalMessages;
        score += recencyRatio * 100;

        // 2. Role-based priority
        if (message.role === 'user') {
            score += 50; // User messages are critical
        } else if (message.role === 'assistant') {
            score += 20;
        } else if (message.role === 'tool') {
            score += 10;
        }

        // 3. Tool calls bonus (important context)
        if (message.tool_calls && message.tool_calls.length > 0) {
            score += 30;
        }

        // 4. Reasoning content bonus (DeepSeek R1)
        if (message.reasoning_content) {
            score += 15;
        }

        // 5. Content length penalty (very short messages are likely confirmations)
        const contentLength = typeof message.content === 'string' ? message.content.length : 0;
        if (contentLength < 50) {
            score -= 20;
        } else if (contentLength > 500) {
            score += 10; // Substantial content
        }

        return score;
    }

    /**
     * Select most relevant messages based on priority
     */
    selectRelevantMessages(
        messages: any[],
        targetTokens: number,
        modelName: string,
        strategy: CompressionStrategy
    ): any[] {
        const tokenCounter = getTokenCounter();

        // Score all messages
        const scoredMessages: ScoredMessage[] = messages.map((msg, idx) => ({
            message: msg,
            score: this.calculatePriority(msg, idx, messages.length),
            index: idx
        }));

        // Sort by score (descending)
        scoredMessages.sort((a, b) => b.score - a.score);

        // Select messages until we hit token limit
        const selected: ScoredMessage[] = [];
        let currentTokens = 0;

        for (const scored of scoredMessages) {
            const msgTokens = tokenCounter.countMessage(scored.message, modelName);

            if (currentTokens + msgTokens <= targetTokens) {
                selected.push(scored);
                currentTokens += msgTokens;
            } else if (strategy.preserveToolCalls && scored.message.tool_calls) {
                // Always try to include tool calls even if tight on space
                selected.push(scored);
                currentTokens += msgTokens;
            }
        }

        // Sort back to chronological order
        selected.sort((a, b) => a.index - b.index);

        return selected.map(s => s.message);
    }

    /**
     * Generate summary of a conversation segment using LLM
     */
    async summarizeConversation(
        messages: any[],
        provider: LLMProvider,
        modelName: string
    ): Promise<string> {
        // Create cache key
        const cacheKey = messages.map(m => m.content?.substring(0, 20) || '').join('|');

        if (this.summaryCache.has(cacheKey)) {
            return this.summaryCache.get(cacheKey)!;
        }

        // Build conversation text
        const conversationText = messages.map(m => {
            const role = m.role === 'user' ? '用户' : m.role === 'assistant' ? 'AI' : '工具';
            const content = typeof m.content === 'string' ? m.content : '[复杂内容]';
            return `${role}: ${content}`;
        }).join('\n');

        const summaryPrompt = `请简洁总结以下对话的关键信息和决策点。保留重要的文件名、代码引用和用户需求。控制在200字以内。

对话内容：
${conversationText}

总结：`;

        try {
            const response = await provider.chat(
                [{ role: 'user', content: summaryPrompt }],
                '你是一个专业的对话总结助手。',
                []
            );

            const summary = response.content || '[无法生成摘要]';

            // Cache the summary
            this.summaryCache.set(cacheKey, summary);

            // Limit cache size
            if (this.summaryCache.size > 50) {
                const firstKey = this.summaryCache.keys().next().value;
                if (firstKey) {
                    this.summaryCache.delete(firstKey);
                }
            }

            return summary;
        } catch (error) {
            console.error('[ContextManager] Failed to generate summary:', error);
            return '[摘要生成失败]';
        }
    }

    /**
     * Compress conversation with smart summarization
     */
    async compressWithSummary(
        messages: any[],
        systemPrompt: string,
        modelName: string,
        provider: LLMProvider,
        strategy: CompressionStrategy
    ): Promise<{ messages: any[], summary?: string }> {
        const tokenCounter = getTokenCounter();
        const modelConfig = getModelConfig(modelName);

        const systemTokens = tokenCounter.countSystemPrompt(systemPrompt, modelName);
        const totalTokens = systemTokens + tokenCounter.countMessages(messages, modelName);

        // If under limit, no compression needed
        if (totalTokens <= modelConfig.safeLimit) {
            return { messages };
        }

        // Determine how many tokens we can use for messages
        const availableTokens = modelConfig.safeLimit - systemTokens;

        // Adjust based on aggressiveness
        let targetTokens = availableTokens;
        if (strategy.aggressiveness === 'conservative') {
            targetTokens = availableTokens * 0.9; // Keep 90%
        } else if (strategy.aggressiveness === 'balanced') {
            targetTokens = availableTokens * 0.75; // Keep 75%
        } else {
            targetTokens = availableTokens * 0.6; // Keep 60%
        }

        // If summarization is enabled, summarize old messages
        let summary: string | undefined;
        if (strategy.enableSummary && messages.length > 10) {
            // Summarize the oldest 1/3 of messages
            const splitPoint = Math.floor(messages.length / 3);
            const oldMessages = messages.slice(0, splitPoint);
            const recentMessages = messages.slice(splitPoint);

            // Generate summary
            summary = await this.summarizeConversation(oldMessages, provider, modelName);

            // Select most relevant from recent messages
            const selected = this.selectRelevantMessages(
                recentMessages,
                targetTokens - tokenCounter.countText(summary, modelName),
                modelName,
                strategy
            );

            return { messages: selected, summary };
        } else {
            // Just select most relevant messages
            const selected = this.selectRelevantMessages(
                messages,
                targetTokens,
                modelName,
                strategy
            );

            return { messages: selected };
        }
    }
}

// Singleton instance
let contextManagerInstance: ContextManager | null = null;

export function getContextManager(): ContextManager {
    if (!contextManagerInstance) {
        contextManagerInstance = new ContextManager();
    }
    return contextManagerInstance;
}
