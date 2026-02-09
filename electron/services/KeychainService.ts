import keytar from 'keytar'

/**
 * KeychainService - 系统钥匙串集成
 * 
 * 使用 macOS Keychain 安全存储主密码和加密 salt
 */
export class KeychainService {
    private static instance: KeychainService
    private readonly SERVICE_NAME = 'iml-agent-desktop'
    private readonly MASTER_PASSWORD_KEY = 'master-password'
    private readonly ENCRYPTION_SALT_KEY = 'encryption-salt'

    private constructor() { }

    static getInstance(): KeychainService {
        if (!KeychainService.instance) {
            KeychainService.instance = new KeychainService()
        }
        return KeychainService.instance
    }

    /**
     * 保存主密码到系统钥匙串
     */
    async saveMasterPassword(password: string): Promise<void> {
        try {
            await keytar.setPassword(
                this.SERVICE_NAME,
                this.MASTER_PASSWORD_KEY,
                password
            )
        } catch (error) {
            throw new Error(`Failed to save master password: ${error}`)
        }
    }

    /**
     * 从系统钥匙串读取主密码
     */
    async getMasterPassword(): Promise<string | null> {
        try {
            return await keytar.getPassword(
                this.SERVICE_NAME,
                this.MASTER_PASSWORD_KEY
            )
        } catch (error) {
            console.error('Failed to get master password:', error)
            return null
        }
    }

    /**
     * 删除主密码
     */
    async deleteMasterPassword(): Promise<boolean> {
        try {
            return await keytar.deletePassword(
                this.SERVICE_NAME,
                this.MASTER_PASSWORD_KEY
            )
        } catch (error) {
            console.error('Failed to delete master password:', error)
            return false
        }
    }

    /**
     * 保存加密 salt
     * Salt 以 base64 编码存储
     */
    async saveEncryptionSalt(salt: Buffer): Promise<void> {
        try {
            const saltBase64 = salt.toString('base64')
            await keytar.setPassword(
                this.SERVICE_NAME,
                this.ENCRYPTION_SALT_KEY,
                saltBase64
            )
        } catch (error) {
            throw new Error(`Failed to save encryption salt: ${error}`)
        }
    }

    /**
     * 读取加密 salt
     */
    async getEncryptionSalt(): Promise<Buffer | null> {
        try {
            const saltBase64 = await keytar.getPassword(
                this.SERVICE_NAME,
                this.ENCRYPTION_SALT_KEY
            )

            if (!saltBase64) return null

            return Buffer.from(saltBase64, 'base64')
        } catch (error) {
            console.error('Failed to get encryption salt:', error)
            return null
        }
    }

    /**
     * 检查是否已设置主密码
     */
    async hasMasterPassword(): Promise<boolean> {
        const password = await this.getMasterPassword()
        return password !== null
    }

    /**
     * 清除所有存储的凭证
     */
    async clearAll(): Promise<void> {
        await this.deleteMasterPassword()
        await keytar.deletePassword(this.SERVICE_NAME, this.ENCRYPTION_SALT_KEY)
    }
}

export default KeychainService.getInstance()
