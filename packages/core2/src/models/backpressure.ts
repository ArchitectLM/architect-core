export interface BackpressureStrategy {
  shouldAccept(queueDepth: number): boolean;
  calculateDelay(): number;
}

export class ThresholdBackpressure implements BackpressureStrategy {
  constructor(
    private threshold: number,
    private delay: number
  ) {}

  shouldAccept(queueDepth: number): boolean {
    return queueDepth < this.threshold;
  }

  calculateDelay(): number {
    return this.delay;
  }
} 