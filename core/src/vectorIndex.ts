export interface VectorIndexConfig {
  initialEmbeddings?: Record<string, number[]>;
}

export interface SearchResult {
  ownerId: string;
  score: number;
}

export class VectorIndex {
  private readonly vectors = new Map<string, number[]>();

  constructor(private readonly config: VectorIndexConfig) {
    if (config.initialEmbeddings) {
      for (const [ownerId, vector] of Object.entries(config.initialEmbeddings)) {
        this.vectors.set(ownerId, vector);
      }
    }
  }

  upsertEmbedding(ownerId: string, vector: number[]) {
    this.vectors.set(ownerId, vector);
  }

  search(vector: number[], limit = 5): SearchResult[] {
    return Array.from(this.vectors.entries())
      .map(([ownerId, storedVector]) => ({ ownerId, score: cosineSimilarity(vector, storedVector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
  const magA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const magB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  if (magA === 0 || magB === 0) {
    return 0;
  }
  return dot / (magA * magB);
}


