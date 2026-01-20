export interface SkillGenerationResult {
    name: string;
    displayName: string;
    description: string;
    inputs: Array<{
        name: string;
        type: string;
        description: string;
        required: boolean;
    }>;
    code: string;
}

export interface Skill {
    id: string;
    name: string;
    displayName?: string;
    description: string;
    parameters?: any;
    content: string;     // markdown body
    path: string;        // Skill 根目录绝对路径
    defaultInChat?: boolean; // Show in chat suggestions by default
    metadata?: Record<string, any>;
}

export interface SkillExecutionResult {
    success: boolean;
    output?: any;
    error?: string;
}
