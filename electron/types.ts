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
