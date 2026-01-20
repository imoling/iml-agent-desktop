import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Skill, SkillExecutionResult } from '../types';

export const useSkillsStore = defineStore('skills', () => {
    const skills = ref<Skill[]>([]);
    const loading = ref(false);
    const executionIds = ref<Set<string>>(new Set());

    async function fetchSkills() {
        loading.value = true;
        try {
            if (window.electron && window.electron.getSkills) {
                skills.value = await window.electron.getSkills();
            } else {
                console.warn('Electron API not available, using mock data');
                skills.value = [
                    {
                        id: 'mock-1',
                        name: 'mock-meeting-notes',
                        description: 'Mock skill for dev in browser',
                        content: '',
                        path: ''
                    }
                ];
            }
        } catch (error) {
            console.error('Failed to fetch skills:', error);
        } finally {
            loading.value = false;
        }
    }

    async function runSkill(skillId: string, args: any = {}): Promise<SkillExecutionResult> {
        executionIds.value.add(skillId);
        try {
            if (window.electron && window.electron.executeSkill) {
                return await window.electron.executeSkill(skillId, args);
            }
            // Mock execution
            await new Promise(resolve => setTimeout(resolve, 1000));
            return { success: true, output: 'Mock execution result' };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return { success: false, error: errorMsg };
        } finally {
            executionIds.value.delete(skillId);
        }
    }

    function isExecuting(skillId: string) {
        return executionIds.value.has(skillId);
    }

    return {
        skills,
        loading,
        fetchSkills,
        runSkill,
        isExecuting
    };
});
