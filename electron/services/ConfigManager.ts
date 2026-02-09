import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';

export interface ModelProfile {
    id: string;
    name: string;
    provider: 'anthropic' | 'openai';
    model: string;
    apiKey: string;
    baseURL?: string;
}

interface UserConfig {
    // New Multi-Model Config
    profiles: ModelProfile[];
    activeProfileId: string;

    // Dedicated Vision Model (Optional)
    visionModel?: Omit<ModelProfile, 'id' | 'name'> & { enabled: boolean };

    // Legacy fields (kept for migration detection, can be optional now)
    apiKey?: string;
    model?: string;
    provider?: 'anthropic' | 'openai';
    baseURL?: string;

    // Global Settings
    safeMode?: boolean;
    browserMode?: 'gui' | 'headless';
    tavilyApiKey?: string;
    secrets?: string[];
    theme?: 'system' | 'dark' | 'light';
    language?: 'zh-CN' | 'en';

    // Context Management Settings
    contextManagement?: {
        enableSummary: boolean;
        compressionStrategy: 'conservative' | 'balanced' | 'aggressive';
    };

    // Encryption Settings
    encryptionConfig?: {
        enabled: boolean;
        testCiphertext?: string;
    };

    // ...
}

export class ConfigManager {
    private store: Store<UserConfig>;

    constructor() {
        this.store = new Store<UserConfig>({
            defaults: {
                profiles: [],
                activeProfileId: '',
                safeMode: true,
                browserMode: 'gui',
                secrets: [],
                theme: 'system',
                language: 'zh-CN',
                contextManagement: {
                    enableSummary: false, // Disabled by default (P1 compression is enough)
                    compressionStrategy: 'balanced'
                },
                visionModel: {
                    enabled: false,
                    provider: 'openai',
                    model: 'gpt-4o',
                    apiKey: ''
                }
            }
        });


        this.migrate();
    }

    private migrate() {
        // electron-store exposes .store property to get full object
        const config = (this.store as any).store;

        // Migration: If no profiles but legacy apiKey exists
        if ((!config.profiles || config.profiles.length === 0) && config.apiKey) {
            console.log('[ConfigManager] Migrating legacy config to profile...');
            const defaultProfile: ModelProfile = {
                id: uuidv4(),
                name: 'Default',
                provider: config.provider || 'anthropic',
                model: config.model || 'claude-3-5-sonnet-20240620',
                apiKey: config.apiKey,
                baseURL: config.baseURL
            };

            // Use .set method
            (this.store as any).set('profiles', [defaultProfile]);
            (this.store as any).set('activeProfileId', defaultProfile.id);

            // Optional: Clean up legacy fields, but keeping them safe for now matches user expectations
            // this.store.delete('apiKey'); 
        } else if ((!config.profiles || config.profiles.length === 0) && !config.apiKey) {
            // Fresh install? Initialize with a default empty profile structure if needed, or leave empty.
            // Let's create a default placeholder if completely empty so UI isn't blank
            const defaultProfile: ModelProfile = {
                id: uuidv4(),
                name: 'Default Profile',
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20240620',
                apiKey: ''
            };
            (this.store as any).set('profiles', [defaultProfile]);
            (this.store as any).set('activeProfileId', defaultProfile.id);
        }
    }

    get<K extends keyof UserConfig>(key: K): UserConfig[K] {
        return (this.store as any).get(key);
    }

    set<K extends keyof UserConfig>(key: K, value: UserConfig[K]): void {
        (this.store as any).set(key, value);
    }

    getAll(): UserConfig {
        return (this.store as any).store;
    }
}
