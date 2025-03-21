import { CancellationToken } from '../models/index.js';

export class CancellationTokenImpl implements CancellationToken {
  isCancelled = false;
  private cancelCallbacks: (() => void)[] = [];

  cancel(): void {
    this.isCancelled = true;
    for (const callback of this.cancelCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error('Error in cancellation callback:', error);
      }
    }
  }

  onCancel(callback: () => void): void {
    if (this.isCancelled) {
      callback();
    } else {
      this.cancelCallbacks.push(callback);
    }
  }
} 