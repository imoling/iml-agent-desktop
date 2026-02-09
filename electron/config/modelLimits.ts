/**
 * Model-specific token limits and configuration
 */

export interface ModelConfig {
    maxTokens: number;        // Maximum context length
    safeLimit: number;        // Safe limit with buffer (90%)
    recentMessages: number;   // Recommended recent message count
    encoding: string;         // Tiktoken encoding name
}

export const MODEL_LIMITS: Record<string, ModelConfig> = {
    // DeepSeek Models
    'deepseek-chat': {
        maxTokens: 131072,
        safeLimit: 120000,
        recentMessages: 20,
        encoding: 'cl100k_base' // GPT-4 compatible
    },
    'deepseek-reasoner': {
        maxTokens: 131072,
        safeLimit: 110000, // More conservative for reasoning
        recentMessages: 15,
        encoding: 'cl100k_base'
    },

    // OpenAI Models
    'gpt-4o': {
        maxTokens: 128000,
        safeLimit: 115000,
        recentMessages: 25,
        encoding: 'o200k_base'
    },
    'gpt-4o-mini': {
        maxTokens: 128000,
        safeLimit: 115000,
        recentMessages: 30,
        encoding: 'o200k_base'
    },
    'gpt-4-turbo': {
        maxTokens: 128000,
        safeLimit: 115000,
        recentMessages: 25,
        encoding: 'cl100k_base'
    },
    'gpt-4': {
        maxTokens: 8192,
        safeLimit: 7000,
        recentMessages: 10,
        encoding: 'cl100k_base'
    },
    'gpt-3.5-turbo': {
        maxTokens: 16385,
        safeLimit: 14000,
        recentMessages: 15,
        encoding: 'cl100k_base'
    },

    // Claude Models
    'claude-3-5-sonnet-20240620': {
        maxTokens: 200000,
        safeLimit: 180000,
        recentMessages: 40,
        encoding: 'cl100k_base' // Approximation
    },
    'claude-3-opus-20240229': {
        maxTokens: 200000,
        safeLimit: 180000,
        recentMessages: 40,
        encoding: 'cl100k_base'
    },
    'claude-3-haiku-20240307': {
        maxTokens: 200000,
        safeLimit: 180000,
        recentMessages: 40,
        encoding: 'cl100k_base'
    },

    // Default fallback
    'default': {
        maxTokens: 100000,
        safeLimit: 90000,
        recentMessages: 20,
        encoding: 'cl100k_base'
    }
};

/**
 * Get model configuration, with fallback to default
 */
export function getModelConfig(modelName: string): ModelConfig {
    return MODEL_LIMITS[modelName] || MODEL_LIMITS['default'];
}
