
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { LocalIndex } from 'vectra';
import { LLMService } from '../LLMService';

export interface VectorDocument {
    id: string;
    content: string;
    metadata: Record<string, any>;
    score?: number;
}

export class VectorStore {
    private index: LocalIndex | null = null;
    private llmService: LLMService;
    private indexPath: string;

    constructor(llmService: LLMService) {
        this.llmService = llmService;
        this.indexPath = path.join(app.getPath('userData'), 'memory-index');
        this.initialize();
    }

    private async initialize() {
        console.log('[VectorStore] Initializing index at:', this.indexPath);
        if (!fs.existsSync(this.indexPath)) {
            console.log('[VectorStore] Creating index directory');
            fs.mkdirSync(this.indexPath, { recursive: true });
        }
        this.index = new LocalIndex(this.indexPath);

        // Ensure index is created if not exists
        if (!await this.index.isIndexCreated()) {
            console.log('[VectorStore] Creating new index file');
            await this.index.createIndex();
        }
        console.log('[VectorStore] Index initialized');
    }

    async addDocument(content: string, metadata: Record<string, any> = {}): Promise<void> {
        console.log('[VectorStore] addDocument called with content length:', content.length);
        if (!this.index) await this.initialize();

        // Simple chunking strategy: Split by paragraphs, then ensure chunks are not too large
        // For MVP, just paragraph splitting.
        const chunks = this.chunkText(content, 1000);
        console.log(`[VectorStore] Content split into ${chunks.length} chunks`);

        for (const chunk of chunks) {
            if (!chunk.trim()) continue;

            try {
                console.log('[VectorStore] Getting embedding for chunk...');
                const vector = await this.llmService.getEmbedding(chunk);
                console.log('[VectorStore] Embedding received, length:', vector.length);

                await this.index!.insertItem({
                    vector,
                    metadata: {
                        ...metadata,
                        content: chunk,
                        timestamp: Date.now()
                    }
                });
                console.log('[VectorStore] Chunk inserted successfully');
            } catch (e) {
                console.error('[VectorStore] Failed to embed/insert chunk:', e);
            }
        }
    }

    async listDocuments(): Promise<VectorDocument[]> {
        console.log('[VectorStore] listDocuments called');
        if (!this.index) await this.initialize();
        try {
            const items = await this.index!.listItems();
            console.log(`[VectorStore] Found ${items.length} items`);
            return items.map(item => ({
                id: item.id,
                content: item.metadata.content as string,
                metadata: item.metadata
            }));
        } catch (e) {
            console.error('[VectorStore] Error listing documents:', e);
            throw e;
        }
    }

    async deleteDocument(id: string): Promise<void> {
        console.log('[VectorStore] deleteDocument called for ID:', id);
        if (!this.index) await this.initialize();
        await this.index!.deleteItem(id);
        console.log('[VectorStore] Document deleted successfully');
    }

    async deleteDocumentsBySource(source: string): Promise<number> {
        console.log('[VectorStore] deleteDocumentsBySource called for source:', source);
        if (!this.index) await this.initialize();

        try {
            const items = await this.index!.listItems();
            const itemsToDelete = items.filter(item => item.metadata.source === source);
            console.log(`[VectorStore] Found ${itemsToDelete.length} items to delete for source: ${source}`);

            for (const item of itemsToDelete) {
                await this.index!.deleteItem(item.id);
            }
            return itemsToDelete.length;
        } catch (e) {
            console.error('[VectorStore] Failed to delete documents by source:', e);
            throw e;
        }
    }

    async search(query: string, limit: number = 3): Promise<VectorDocument[]> {
        console.log(`[VectorStore] search called with query: "${query}"`);
        if (!this.index) await this.initialize();

        try {
            const vector = await this.llmService.getEmbedding(query);
            const results = await this.index!.queryItems(vector, query, limit);
            console.log(`[VectorStore] Search returned ${results.length} results`);

            return results.map(item => ({
                id: item.item.id,
                content: item.item.metadata.content as string,
                metadata: item.item.metadata,
                score: item.score
            }));
        } catch (e) {
            console.error('[VectorStore] Search failed:', e);
            throw e;
        }
    }

    private chunkText(text: string, maxLength: number): string[] {
        // Split by double newline (paragraphs) first
        const paragraphs = text.split(/\n\s*\n/);
        const chunks: string[] = [];

        for (const para of paragraphs) {
            if (para.length <= maxLength) {
                chunks.push(para);
            } else {
                // If paragraph is too long, split by sentences (rough approximation)
                const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
                let currentChunk = '';

                for (const sentence of sentences) {
                    if ((currentChunk + sentence).length > maxLength) {
                        chunks.push(currentChunk);
                        currentChunk = sentence;
                    } else {
                        currentChunk += sentence;
                    }
                }
                if (currentChunk) chunks.push(currentChunk);
            }
        }
        return chunks;
    }
}
