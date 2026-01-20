import { useAppStore } from '../stores/app'
import { storeToRefs } from 'pinia'

/**
 * Provides a masking utility that replaces sensitive keywords defined in configuration
 * with '******'. Used to hide passwords, keys, etc. in the UI.
 */
export function useMasking() {
    const appStore = useAppStore()
    const { secrets } = storeToRefs(appStore)

    /**
     * Masks all occurrences of secrets in the given text.
     * @param text The raw text to mask.
     * @returns The masked text.
     */
    const mask = (text: string | null | undefined): string => {
        if (!text) return ''
        let masked = text

        // Iterate through all secrets and replace them
        // Sort by length desc to prevent partial replacement if one secret is a substring of another? 
        // Not critical for simple usage, but safer.
        const sortedSecrets = [...secrets.value].sort((a, b) => b.length - a.length)

        sortedSecrets.forEach(secret => {
            if (secret && secret.length > 0) {
                // Escape special regex chars if we used regex, but here split/join is safer and faster for literal replacement
                masked = masked.split(secret).join('******')
            }
        })
        return masked
    }

    return {
        mask
    }
}
