import { IEmbeddingFunction } from 'chromadb';

export class SimpleEmbeddingFunction implements IEmbeddingFunction {
  constructor(private dimension: number = 1536) {}
  
  async generate(texts: string[]): Promise<number[][]> {
    return texts.map(text => {
      const embedding = new Array(this.dimension).fill(0);
      const hash = this.hashText(text);
      
      for (let i = 0; i < this.dimension; i++) {
        embedding[i] = Math.sin(hash * (i + 1)) * 0.5;
      }
      
      return this.normalize(embedding);
    });
  }
  
  private hashText(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }
    return hash;
  }
  
  private normalize(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 
      ? vector.map(v => v / magnitude) 
      : vector.map(() => 1 / Math.sqrt(this.dimension));
  }
} 