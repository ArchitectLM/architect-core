/**
 * Strategy for handling backpressure in event streaming
 */
export interface BackpressureStrategy {
  /**
   * Determines whether to accept a message based on queue depth
   * @param queueDepth Current queue depth
   * @returns True if message should be accepted, false to apply backpressure
   */
  shouldAccept(queueDepth: number): boolean;
  
  /**
   * Calculates a delay to introduce before accepting the next message
   * @returns Delay in milliseconds
   */
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