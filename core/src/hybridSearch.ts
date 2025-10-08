
import { VectorIndex } from './vectorIndex';

export interface HybridSearchConfig {
  keywordIndex?: Array<{ ownerId: string; name: string }>;
  initialEmbeddings?: Record<string, number[]>;
}

export interface HybridSearchResult {
  ownerId: string;
  keywordScore: number;
  vectorScore: number;
  totalScore: number;
}

export class HybridSearchService {
  private readonly vectorIndex: VectorIndex;
  private readonly keywordIndex: Map<string, string>;

  constructor(config: HybridSearchConfig) {
    this.keywordIndex = new Map();
    if (config.keywordIndex) {
      for (const entry of config.keywordIndex) {
        this.keywordIndex.set(entry.ownerId, entry.name);
      }
    }
    this.vectorIndex = new VectorIndex({ initialEmbeddings: config.initialEmbeddings });
  }

  keywordSearch(query: string, limit = 10): Array<{ ownerId: string; score: number }> {
    const normalizedQuery = query.toLowerCase();
    const results: Array<{ ownerId: string; score: number }> = [];
    for (const [ownerId, name] of this.keywordIndex.entries()) {
      const score = name.toLowerCase().includes(normalizedQuery) ? 1 : 0;
      if (score > 0) {
        results.push({ ownerId, score });
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async hybridSearch(text: string, vector: number[], limit = 10): Promise<HybridSearchResult[]> {
    const keywordResults = this.keywordSearch(text, limit);
    const vectorResults = this.vectorIndex.search(vector, limit);

    const combined = new Map<string, HybridSearchResult>();

    for (const result of keywordResults) {
      combined.set(result.ownerId, {
        ownerId: result.ownerId,
        keywordScore: result.score,
        vectorScore: 0,
        totalScore: result.score,
      });
    }

    for (const result of vectorResults) {
      const existing = combined.get(result.ownerId);
      if (existing) {
        existing.vectorScore = result.score;
        existing.totalScore += result.score;
      } else {
        combined.set(result.ownerId, {
          ownerId: result.ownerId,
          keywordScore: 0,
          vectorScore: result.score,
          totalScore: result.score,
        });
      }
    }

    return Array.from(combined.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, limit);
  }
}


