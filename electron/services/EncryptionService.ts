import crypto from 'crypto'

/**
 * EncryptionService - 提供 AES-256-GCM 加密/解密功能
 * 
 * 用于加密敏感记忆数据，使用主密码派生加密密钥
 */
export class EncryptionService {
    private static instance: EncryptionService
    private encryptionKey: Buffer | null = null
    private readonly ALGORITHM = 'aes-256-gcm'
    private readonly KEY_LENGTH = 32 // 256 bits
    private readonly IV_LENGTH = 16  // 128 bits
    private readonly SALT_LENGTH = 32
    private readonly TAG_LENGTH = 16
    private readonly PBKDF2_ITERATIONS = 100000

    private constructor() { }

    static getInstance(): EncryptionService {
        if (!EncryptionService.instance) {
            EncryptionService.instance = new EncryptionService()
        }
        return EncryptionService.instance
    }

    /**
     * 从主密码派生加密密钥
     * 使用 PBKDF2 进行密钥派生
     */
    async deriveKey(masterPassword: string, salt: Buffer): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            crypto.pbkdf2(
                masterPassword,
                salt,
                this.PBKDF2_ITERATIONS,
                this.KEY_LENGTH,
                'sha256',
                (err, derivedKey) => {
                    if (err) reject(err)
                    else resolve(derivedKey)
                }
            )
        })
    }

    /**
     * 设置加密密钥（从主密码派生）
     * 密钥会缓存在内存中，直到应用关闭
     */
    async setMasterPassword(masterPassword: string, salt?: Buffer): Promise<Buffer> {
        // 如果没有提供 salt，生成新的
        const keySalt = salt || crypto.randomBytes(this.SALT_LENGTH)

        // 派生密钥
        this.encryptionKey = await this.deriveKey(masterPassword, keySalt)

        return keySalt
    }

    /**
     * 检查是否已设置加密密钥
     */
    isUnlocked(): boolean {
        return this.encryptionKey !== null
    }

    /**
     * 清除内存中的加密密钥
     */
    lock(): void {
        if (this.encryptionKey) {
            this.encryptionKey.fill(0) // 安全清零
            this.encryptionKey = null
        }
    }

    /**
     * 加密数据
     * 
     * @param plaintext 要加密的明文
     * @returns 加密后的数据（包含 IV、tag 和密文）
     */
    encrypt(plaintext: string): string {
        if (!this.encryptionKey) {
            throw new Error('Encryption key not set. Call setMasterPassword first.')
        }

        // 生成随机 IV
        const iv = crypto.randomBytes(this.IV_LENGTH)

        // 创建加密器
        const cipher = crypto.createCipheriv(this.ALGORITHM, this.encryptionKey, iv)

        // 加密数据
        let encrypted = cipher.update(plaintext, 'utf8', 'hex')
        encrypted += cipher.final('hex')

        // 获取认证标签
        const tag = cipher.getAuthTag()

        // 组合: IV + tag + 密文
        const result = Buffer.concat([
            iv,
            tag,
            Buffer.from(encrypted, 'hex')
        ])

        // 返回 base64 编码的结果
        return result.toString('base64')
    }

    /**
     * 解密数据
     * 
     * @param ciphertext 加密的数据（base64 编码）
     * @returns 解密后的明文
     */
    decrypt(ciphertext: string): string {
        if (!this.encryptionKey) {
            throw new Error('Encryption key not set. Call setMasterPassword first.')
        }

        // 解码 base64
        const data = Buffer.from(ciphertext, 'base64')

        // 提取 IV、tag 和密文
        const iv = data.subarray(0, this.IV_LENGTH)
        const tag = data.subarray(this.IV_LENGTH, this.IV_LENGTH + this.TAG_LENGTH)
        const encrypted = data.subarray(this.IV_LENGTH + this.TAG_LENGTH)

        // 创建解密器
        const decipher = crypto.createDecipheriv(this.ALGORITHM, this.encryptionKey, iv)
        decipher.setAuthTag(tag)

        // 解密数据
        let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8')
        decrypted += decipher.final('utf8')

        return decrypted
    }

    /**
     * 验证密码是否正确
     * 通过尝试解密一个测试字符串来验证
     */
    async verifyPassword(
        masterPassword: string,
        salt: Buffer,
        testCiphertext: string
    ): Promise<boolean> {
        let originalKey = this.encryptionKey

        try {
            // 临时派生密钥
            const tempKey = await this.deriveKey(masterPassword, salt)

            // 临时设置密钥
            this.encryptionKey = tempKey

            // 尝试解密
            this.decrypt(testCiphertext)
            return true
        } catch (error) {
            return false
        } finally {
            // 无论成功失败，都恢复原密钥
            if (originalKey) {
                this.encryptionKey = originalKey
            } else {
                this.encryptionKey = null
            }
        }
    }

    /**
     * 生成测试密文（用于密码验证）
     */
    generateTestCiphertext(): string {
        const testString = 'encryption-test-' + Date.now()
        return this.encrypt(testString)
    }
}

export default EncryptionService.getInstance()
