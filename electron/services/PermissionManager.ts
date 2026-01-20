import { BrowserWindow, ipcMain } from 'electron';

export class PermissionManager {
    private permissions: Set<string> = new Set();
    private sessionWhitelist: Set<string> = new Set();
    private mainWindow: BrowserWindow | null = null;
    private pendingRequests: Map<string, { resolve: (value: any) => void, tool?: string }> = new Map();

    constructor() {
        // Listen for responses from Renderer
        ipcMain.on('permission-response', (event, { requestId, allow, options }) => {
            const pending = this.pendingRequests.get(requestId);
            if (pending) {
                // Return context so we can see what tool it was
                pending.resolve({ allow, tool: pending.tool });
                this.pendingRequests.delete(requestId);

                // Handle Persist
                if (allow && options?.persist && pending.tool) {
                    console.log(`[PermissionManager] Whitelisting tool for session: ${pending.tool}`);
                    this.sessionWhitelist.add(pending.tool);
                }
            }
        });
    }

    setMainWindow(window: BrowserWindow) {
        this.mainWindow = window;
    }

    /**
     * Check if a specific permission is granted.
     * Note: Some permissions might be implied by others or global Safe Mode settings (legacy).
     */
    check(permission: string, toolName?: string): boolean {
        if (this.permissions.has(permission) || this.permissions.has('*')) return true;
        if (toolName && this.sessionWhitelist.has(toolName)) return true;
        return false;
    }

    /**
     * Grant a permission specifically.
     */
    grant(permission: string) {
        this.permissions.add(permission);
    }

    /**
     * Revoke a permission.
     */
    revoke(permission: string) {
        this.permissions.delete(permission);
        // Also clear session whitelist check? Maybe not for specific tool revocation unless explicit.
    }

    /**
     * Request a permission from the user via the UI.
     * Returns a Promise that resolves to true (allowed) or false (denied).
     */
    async request(permission: string, context?: any): Promise<boolean> {
        const toolName = context?.tool;

        if (this.check(permission, toolName)) {
            return true;
        }

        if (!this.mainWindow) {
            console.error('PermissionManager: No main window set.');
            return false;
        }

        const requestId = `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        console.log(`[PermissionManager] Requesting permission: ${permission} (Tool: ${toolName}) (ID: ${requestId})`);

        return new Promise((resolve) => {
            // We store the resolve wrapper to handle the boolean return
            this.pendingRequests.set(requestId, {
                resolve: (res: any) => resolve(res.allow),
                tool: toolName
            });

            this.mainWindow?.webContents.send('permission-request', {
                requestId,
                permission,
                context
            });
        });
    }
}
