import { CancellationToken } from '../models/index';

export class CancellationTokenImpl implements CancellationToken {
  private _isCancellationRequested = false;
  private cancelCallbacks: (() => void)[] = [];

  get isCancellationRequested(): boolean {
    return this._isCancellationRequested;
  }

  cancel(): void {
    this._isCancellationRequested = true;
    for (const callback of this.cancelCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error('Error in cancellation callback:', error);
      }
    }
  }

  onCancellationRequested(callback: () => void): void {
    if (this._isCancellationRequested) {
      callback();
    } else {
      this.cancelCallbacks.push(callback);
    }
  }

  throwIfCancellationRequested(): void {
    if (this._isCancellationRequested) {
      throw new Error('Operation cancelled');
    }
  }
} 