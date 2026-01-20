import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
    const activeMenu = ref('chat')
    const showSettingsModal = ref(false)
    const settingsTab = ref('general')
    const secrets = ref<string[]>([])

    const loadSecrets = async () => {
        if (window.electron && window.electron.getConfig) {
            const config = await window.electron.getConfig()
            if (config && config.secrets) {
                secrets.value = config.secrets
            }
        }
    }

    // Initial Load
    loadSecrets()

    const setActiveMenu = (menu: string) => {
        activeMenu.value = menu
    }

    const openSettings = (tab = 'general') => {
        settingsTab.value = tab
        showSettingsModal.value = true
    }

    return {
        activeMenu,
        setActiveMenu,
        showSettingsModal,
        settingsTab,
        openSettings,
        secrets,
        loadSecrets
    }
})
