import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useWorkflowsStore = defineStore('workflows', () => {
    const workflows = ref<any[]>([])
    const loading = ref(false)
    const draftWorkflow = ref<any>(null)

    const fetchWorkflows = async () => {
        loading.value = true
        try {
            if (window.electron && window.electron.getWorkflows) {
                workflows.value = await window.electron.getWorkflows()
            }
        } catch (e) {
            console.error('Failed to fetch workflows', e)
        } finally {
            loading.value = false
        }
    }

    const saveWorkflow = async (workflow: any) => {
        if (window.electron && window.electron.saveWorkflow) {
            await window.electron.saveWorkflow(workflow)
            await fetchWorkflows()
        }
    }

    const deleteWorkflow = async (id: string) => {
        if (window.electron && window.electron.deleteWorkflow) {
            await window.electron.deleteWorkflow(id)
            await fetchWorkflows()
        }
    }

    const setDraftWorkflow = (workflow: any) => {
        draftWorkflow.value = workflow
    }

    const clearDraftWorkflow = () => {
        draftWorkflow.value = null
    }

    return {
        workflows,
        loading,
        draftWorkflow,
        fetchWorkflows,
        saveWorkflow,
        deleteWorkflow,
        setDraftWorkflow,
        clearDraftWorkflow
    }
})
