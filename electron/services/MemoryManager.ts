import { EnhancedMemory, MemoryCategory } from '../types'
import { v4 as uuidv4 } from 'uuid'
import encryptionService from './EncryptionService'

/**
 * MemoryManager - 增强的记忆管理服务
 * 
 * 提供分类、优先级、过期管理和敏感信息检测功能
 */
export class MemoryManager {
    private static instance: MemoryManager

    private constructor() { }

    static getInstance(): MemoryManager {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager()
        }
        return MemoryManager.instance
    }

    /**
     * 创建增强记忆
     */
    createMemory(
        content: string,
        options: {
            category?: MemoryCategory
            priority?: 'high' | 'medium' | 'low'
            tags?: string[]
            expiresAt?: number
            encrypted?: boolean
            source?: string
            metadata?: Record<string, any>
        } = {}
    ): EnhancedMemory {
        const {
            category = MemoryCategory.PROJECT,
            priority = 'medium',
            tags = [],
            expiresAt,
            encrypted = false,
            source = 'manual',
            metadata = {}
        } = options

        // 自动检测敏感信息
        const shouldEncrypt = encrypted ||
            category === MemoryCategory.CREDENTIAL ||
            this.detectSensitiveContent(content)

        // 如果需要加密，检查服务状态
        if (shouldEncrypt && !encryptionService.isUnlocked()) {
            throw new Error('无法保存加密记忆：加密服务已锁定，请先解锁。')
        }

        // 如果需要加密，加密内容
        let finalContent = content
        if (shouldEncrypt) {
            try {
                finalContent = encryptionService.encrypt(content)
            } catch (error) {
                console.error('[MemoryManager] Encryption failed:', error)
                throw new Error('Failed to encrypt memory')
            }
        }

        const memory: EnhancedMemory = {
            id: uuidv4(),
            content: finalContent,
            encrypted: shouldEncrypt,
            category,
            priority,
            tags,
            expiresAt,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            source,
            metadata
        }

        return memory
    }

    /**
     * 解密记忆内容（如果已加密）
     */
    decryptMemory(memory: EnhancedMemory): string {
        if (!memory.encrypted) {
            return memory.content
        }

        if (!encryptionService.isUnlocked()) {
            throw new Error('Encryption service is locked. Please unlock first.')
        }

        try {
            return encryptionService.decrypt(memory.content)
        } catch (error) {
            console.error('[MemoryManager] Decryption failed:', error)
            throw new Error('Failed to decrypt memory')
        }
    }

    /**
     * 检测敏感内容
     * 自动识别密码、API key、token 等模式
     */
    private detectSensitiveContent(content: string): boolean {
        const sensitivePatterns = [
            /password\s*[:=]\s*\S+/i,           // password: xxx
            /api[_-]?key\s*[:=]\s*\S+/i,        // api_key: xxx
            /secret\s*[:=]\s*\S+/i,             // secret: xxx
            /token\s*[:=]\s*\S+/i,              // token: xxx
            /bearer\s+\S+/i,                    // Bearer xxx
            /[a-f0-9]{32,}/i,                   // 长十六进制字符串（可能是密钥）
            /sk-[a-zA-Z0-9]{20,}/,              // OpenAI API key 格式
            /ghp_[a-zA-Z0-9]{36}/,              // GitHub Personal Access Token
            /AIza[a-zA-Z0-9_-]{35}/,            // Google API key
        ]

        return sensitivePatterns.some(pattern => pattern.test(content))
    }

    /**
     * 按分类筛选记忆
     */
    filterByCategory(memories: EnhancedMemory[], category: MemoryCategory): EnhancedMemory[] {
        return memories.filter(m => m.category === category)
    }

    /**
     * 按优先级排序
     */
    sortByPriority(memories: EnhancedMemory[]): EnhancedMemory[] {
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        return [...memories].sort((a, b) => {
            return priorityOrder[a.priority] - priorityOrder[b.priority]
        })
    }

    /**
     * 按标签筛选
     */
    filterByTags(memories: EnhancedMemory[], tags: string[]): EnhancedMemory[] {
        return memories.filter(m =>
            tags.some(tag => m.tags.includes(tag))
        )
    }

    /**
     * 检查并清理过期记忆
     */
    filterExpired(memories: EnhancedMemory[]): {
        valid: EnhancedMemory[]
        expired: EnhancedMemory[]
    } {
        const now = Date.now()
        const valid: EnhancedMemory[] = []
        const expired: EnhancedMemory[] = []

        memories.forEach(memory => {
            if (memory.expiresAt && memory.expiresAt < now) {
                expired.push(memory)
            } else {
                valid.push(memory)
            }
        })

        return { valid, expired }
    }

    /**
     * 搜索记忆（支持加密记忆）
     */
    searchMemories(
        memories: EnhancedMemory[],
        query: string,
        options: {
            includeEncrypted?: boolean
            categories?: MemoryCategory[]
            priorities?: ('high' | 'medium' | 'low')[]
        } = {}
    ): EnhancedMemory[] {
        const {
            includeEncrypted = true,
            categories,
            priorities
        } = options

        const lowerQuery = query.toLowerCase()

        return memories.filter(memory => {
            // 分类筛选
            if (categories && !categories.includes(memory.category)) {
                return false
            }

            // 优先级筛选
            if (priorities && !priorities.includes(memory.priority)) {
                return false
            }

            // 内容搜索
            try {
                let searchContent = memory.content

                // 如果是加密记忆，尝试解密后搜索
                if (memory.encrypted) {
                    if (!includeEncrypted) return false
                    if (!encryptionService.isUnlocked()) return false

                    try {
                        searchContent = this.decryptMemory(memory)
                    } catch (error) {
                        return false
                    }
                }

                // 搜索内容、标签、来源
                return (
                    searchContent.toLowerCase().includes(lowerQuery) ||
                    memory.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
                    memory.source.toLowerCase().includes(lowerQuery)
                )
            } catch (error) {
                return false
            }
        })
    }

    /**
     * 建议分类
     * 基于内容关键词自动建议分类
     */
    suggestCategory(content: string): MemoryCategory {
        const lowerContent = content.toLowerCase()

        // 凭证相关关键词
        if (this.detectSensitiveContent(content)) {
            return MemoryCategory.CREDENTIAL
        }

        // 个人信息关键词
        const personalKeywords = ['name', 'email', 'phone', 'address', '姓名', '邮箱', '电话', '地址']
        if (personalKeywords.some(kw => lowerContent.includes(kw))) {
            return MemoryCategory.PERSONAL
        }

        // 偏好设置关键词
        const preferenceKeywords = ['prefer', 'like', 'dislike', 'favorite', 'style', '喜欢', '偏好', '风格']
        if (preferenceKeywords.some(kw => lowerContent.includes(kw))) {
            return MemoryCategory.PREFERENCE
        }

        // 默认为项目知识
        return MemoryCategory.PROJECT
    }

    /**
     * 更新记忆
     */
    updateMemory(
        memory: EnhancedMemory,
        updates: Partial<Omit<EnhancedMemory, 'id' | 'createdAt'>>
    ): EnhancedMemory {
        // 如果更新内容且需要加密
        if (updates.content && (memory.encrypted || updates.encrypted)) {
            if (!encryptionService.isUnlocked()) {
                throw new Error('Cannot update encrypted memory: encryption service is locked')
            }

            try {
                updates.content = encryptionService.encrypt(updates.content)
            } catch (error) {
                throw new Error('Failed to encrypt updated content')
            }
        }

        return {
            ...memory,
            ...updates,
            updatedAt: Date.now()
        }
    }

    /**
     * 获取记忆统计信息
     */
    getStatistics(memories: EnhancedMemory[]): {
        total: number
        byCategory: Record<MemoryCategory, number>
        byPriority: Record<'high' | 'medium' | 'low', number>
        encrypted: number
        expired: number
    } {
        const stats = {
            total: memories.length,
            byCategory: {
                [MemoryCategory.PERSONAL]: 0,
                [MemoryCategory.PROJECT]: 0,
                [MemoryCategory.PREFERENCE]: 0,
                [MemoryCategory.CREDENTIAL]: 0,
                [MemoryCategory.TEMPORARY]: 0
            },
            byPriority: {
                high: 0,
                medium: 0,
                low: 0
            },
            encrypted: 0,
            expired: 0
        }

        const now = Date.now()

        memories.forEach(memory => {
            stats.byCategory[memory.category]++
            stats.byPriority[memory.priority]++
            if (memory.encrypted) stats.encrypted++
            if (memory.expiresAt && memory.expiresAt < now) stats.expired++
        })

        return stats
    }

    /**
     * Phase 5: 智能优化功能
     */

    /**
     * 检测重复记忆
     * 使用简单的相似度算法（Levenshtein距离）
     */
    findDuplicates(memories: EnhancedMemory[], threshold: number = 0.8): Array<{
        memory1: EnhancedMemory
        memory2: EnhancedMemory
        similarity: number
    }> {
        const duplicates: Array<{
            memory1: EnhancedMemory
            memory2: EnhancedMemory
            similarity: number
        }> = []

        for (let i = 0; i < memories.length; i++) {
            for (let j = i + 1; j < memories.length; j++) {
                const mem1 = memories[i]
                const mem2 = memories[j]

                // 跳过加密记忆（无法比较）
                if (mem1.encrypted || mem2.encrypted) continue

                // 计算相似度
                const similarity = this.calculateSimilarity(mem1.content, mem2.content)

                if (similarity >= threshold) {
                    duplicates.push({
                        memory1: mem1,
                        memory2: mem2,
                        similarity
                    })
                }
            }
        }

        return duplicates
    }

    /**
     * 计算两个字符串的相似度（0-1）
     * 使用简化的 Jaccard 相似度
     */
    private calculateSimilarity(str1: string, str2: string): number {
        // 转换为小写并分词
        const words1 = new Set(str1.toLowerCase().split(/\s+/))
        const words2 = new Set(str2.toLowerCase().split(/\s+/))

        // 计算交集和并集
        const intersection = new Set([...words1].filter(x => words2.has(x)))
        const union = new Set([...words1, ...words2])

        // Jaccard 相似度
        return intersection.size / union.size
    }

    /**
     * 合并重复记忆
     * 保留较新的记忆，合并标签和元数据
     */
    mergeDuplicates(memory1: EnhancedMemory, memory2: EnhancedMemory): EnhancedMemory {
        // 选择较新的记忆作为基础
        const base = memory1.createdAt > memory2.createdAt ? memory1 : memory2
        const other = base === memory1 ? memory2 : memory1

        // 合并标签（去重）
        const mergedTags = Array.from(new Set([...base.tags, ...other.tags]))

        // 合并元数据
        const mergedMetadata = {
            ...other.metadata,
            ...base.metadata,
            mergedFrom: other.id,
            mergedAt: Date.now()
        }

        return {
            ...base,
            tags: mergedTags,
            metadata: mergedMetadata,
            updatedAt: Date.now()
        }
    }

    /**
     * 自动调整优先级
     * 基于使用频率和最后使用时间
     */
    adjustPriority(
        memory: EnhancedMemory,
        usageCount: number,
        lastUsedAt: number
    ): 'high' | 'medium' | 'low' {
        const now = Date.now()
        const daysSinceLastUse = (now - lastUsedAt) / (1000 * 60 * 60 * 24)

        // 高优先级：频繁使用且最近使用过
        if (usageCount >= 10 && daysSinceLastUse < 7) {
            return 'high'
        }

        // 中优先级：中等使用频率或最近使用过
        if (usageCount >= 5 || daysSinceLastUse < 30) {
            return 'medium'
        }

        // 低优先级：很少使用或很久没用
        return 'low'
    }

    /**
     * 批量优化记忆
     * 去重、调整优先级、清理过期
     */
    optimizeMemories(
        memories: EnhancedMemory[],
        usageStats?: Map<string, { count: number; lastUsedAt: number }>
    ): {
        optimized: EnhancedMemory[]
        removed: EnhancedMemory[]
        merged: Array<{ from: string[]; to: string }>
    } {
        const result = {
            optimized: [] as EnhancedMemory[],
            removed: [] as EnhancedMemory[],
            merged: [] as Array<{ from: string[]; to: string }>
        }

        // 1. 清理过期记忆
        const { valid, expired } = this.filterExpired(memories)
        result.removed.push(...expired)

        // 2. 检测并合并重复
        const duplicates = this.findDuplicates(valid)
        const mergedIds = new Set<string>()
        const mergedMemories = new Map<string, EnhancedMemory>()

        duplicates.forEach(({ memory1, memory2 }) => {
            if (!mergedIds.has(memory1.id) && !mergedIds.has(memory2.id)) {
                const merged = this.mergeDuplicates(memory1, memory2)
                mergedMemories.set(merged.id, merged)
                mergedIds.add(memory1.id)
                mergedIds.add(memory2.id)

                result.merged.push({
                    from: [memory1.id, memory2.id],
                    to: merged.id
                })
            }
        })

        // 3. 调整优先级（如果有使用统计）
        valid.forEach(memory => {
            if (mergedIds.has(memory.id)) {
                // 已合并的记忆，跳过
                return
            }

            let optimizedMemory = memory

            if (usageStats && usageStats.has(memory.id)) {
                const stats = usageStats.get(memory.id)!
                const newPriority = this.adjustPriority(memory, stats.count, stats.lastUsedAt)

                if (newPriority !== memory.priority) {
                    optimizedMemory = {
                        ...memory,
                        priority: newPriority,
                        updatedAt: Date.now()
                    }
                }
            }

            result.optimized.push(optimizedMemory)
        })

        // 添加合并后的记忆
        mergedMemories.forEach(merged => {
            result.optimized.push(merged)
        })

        return result
    }

    /**
     * 提取关键词（用于改进分类建议）
     */
    extractKeywords(content: string, topN: number = 5): string[] {
        // 移除标点符号和特殊字符
        const cleaned = content.toLowerCase().replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')

        // 分词
        const words = cleaned.split(/\s+/).filter(w => w.length > 2)

        // 统计词频
        const wordCount = new Map<string, number>()
        words.forEach(word => {
            wordCount.set(word, (wordCount.get(word) || 0) + 1)
        })

        // 排序并返回前N个
        return Array.from(wordCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, topN)
            .map(([word]) => word)
    }

    /**
     * 改进的分类建议
     * 结合关键词提取和模式匹配
     */
    suggestCategoryAdvanced(content: string): {
        category: MemoryCategory
        confidence: number
        keywords: string[]
    } {
        const keywords = this.extractKeywords(content)
        const lowerContent = content.toLowerCase()

        // 凭证检测（最高优先级）
        if (this.detectSensitiveContent(content)) {
            return {
                category: MemoryCategory.CREDENTIAL,
                confidence: 0.95,
                keywords
            }
        }

        // 基于关键词的分类评分
        const scores = {
            [MemoryCategory.PERSONAL]: 0,
            [MemoryCategory.PROJECT]: 0,
            [MemoryCategory.PREFERENCE]: 0,
            [MemoryCategory.CREDENTIAL]: 0,
            [MemoryCategory.TEMPORARY]: 0
        }

        // 个人信息关键词
        const personalKeywords = ['name', 'email', 'phone', 'address', 'birthday', '姓名', '邮箱', '电话', '地址', '生日']
        personalKeywords.forEach(kw => {
            if (lowerContent.includes(kw)) scores[MemoryCategory.PERSONAL] += 2
        })

        // 项目关键词
        const projectKeywords = ['project', 'code', 'function', 'class', 'api', '项目', '代码', '函数', '接口']
        projectKeywords.forEach(kw => {
            if (lowerContent.includes(kw)) scores[MemoryCategory.PROJECT] += 2
        })

        // 偏好关键词
        const preferenceKeywords = ['prefer', 'like', 'dislike', 'favorite', 'style', '喜欢', '偏好', '风格', '习惯']
        preferenceKeywords.forEach(kw => {
            if (lowerContent.includes(kw)) scores[MemoryCategory.PREFERENCE] += 2
        })

        // 临时关键词
        const temporaryKeywords = ['todo', 'reminder', 'temporary', 'temp', '待办', '提醒', '临时']
        temporaryKeywords.forEach(kw => {
            if (lowerContent.includes(kw)) scores[MemoryCategory.TEMPORARY] += 2
        })

        // 找出最高分
        const maxScore = Math.max(...Object.values(scores))
        const suggestedCategory = maxScore > 0
            ? (Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] as MemoryCategory)
            : MemoryCategory.PROJECT

        // 计算置信度
        const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)
        const confidence = totalScore > 0 ? maxScore / totalScore : 0.5

        return {
            category: suggestedCategory,
            confidence,
            keywords
        }
    }
}

export default MemoryManager.getInstance()
