export interface Skill {
    id: string;          // 文件夹名，唯一标识
    name: string;        // from frontmatter
    displayName?: string; // Display name for UI (e.g. Chinese)
    description: string; // from frontmatter
    parameters?: any;    // from frontmatter (JSON Schema)
    content: string;     // markdown body
    path: string;        // Skill 根目录绝对路径
    defaultInChat?: boolean; // Show in chat suggestions by default
    metadata?: Record<string, any>; // Standard Claude metadata or any extra fields
}

export interface SkillExecutionResult {
    success: boolean;
    output?: any;
    error?: string;
}

export interface WorkflowStep {
    id: string;
    type: 'skill' | 'llm' | 'delay' | 'user_input';
    name?: string;
    // For 'skill' type
    skillId?: string;
    params?: Record<string, any>;
    // For 'llm' type
    // For 'llm' type
    // For 'llm' type
    prompt?: string | string[];
    images?: string[];
    // For 'delay' type
    duration?: number; // ms
    // Common
    outputVar?: string; // Variable name to store output
    continueOnError?: boolean; // If true, execution continues after failure
}

export interface Workflow {
    id: string;
    name: string;
    description?: string;
    steps: WorkflowStep[];
    createdAt: number;
    updatedAt: number;
}

/**
 * Enhanced Memory Data Model
 * 支持加密、分类、优先级等高级功能
 */

export enum MemoryCategory {
    PERSONAL = 'personal',      // 个人信息
    PROJECT = 'project',        // 项目知识
    PREFERENCE = 'preference',  // 偏好设置
    CREDENTIAL = 'credential',  // 凭证（强制加密）
    TEMPORARY = 'temporary'     // 临时记忆
}

export interface EnhancedMemory {
    id: string
    content: string              // 明文或密文（取决于 encrypted 字段）
    encrypted: boolean           // 是否加密
    category: MemoryCategory     // 分类
    priority: 'high' | 'medium' | 'low'
    tags: string[]
    expiresAt?: number          // 过期时间戳（可选）
    createdAt: number
    updatedAt: number
    source: string
    metadata: {
        conversationId?: string
        messageId?: string
        [key: string]: any
    }
}

/**
 * 记忆使用追踪
 */
export interface MemoryUsage {
    memoryId: string
    relevanceScore: number
    content: string
    category: MemoryCategory
}

/**
 * 加密配置
 */
export interface EncryptionConfig {
    enabled: boolean
    testCiphertext?: string  // 用于验证密码的测试密文
}
