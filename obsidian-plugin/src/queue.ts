export class SyncQueue {
  private fileChains = new Map<string, Promise<void>>();
  private activeSyncs = 0;
  private maxConcurrent: number;
  private waiting: Array<{
    filePath: string;
    task: () => Promise<void>;
    resolve: () => void;
    reject: (err: unknown) => void;
  }> = [];

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  setMaxConcurrent(n: number) {
    this.maxConcurrent = n;
  }

  async enqueue(filePath: string, task: () => Promise<void>): Promise<void> {
    // Per-file serialization: chain after any pending sync for this file
    const existingChain = this.fileChains.get(filePath) ?? Promise.resolve();

    const newChain = existingChain.then(() => this.runWithConcurrency(filePath, task));
    this.fileChains.set(filePath, newChain.catch(() => {})); // swallow for chain continuity

    return newChain;
  }

  private runWithConcurrency(filePath: string, task: () => Promise<void>): Promise<void> {
    if (this.activeSyncs < this.maxConcurrent) {
      return this.executeTask(filePath, task);
    }

    // Queue and wait for a slot
    return new Promise<void>((resolve, reject) => {
      this.waiting.push({ filePath, task, resolve, reject });
    });
  }

  private async executeTask(filePath: string, task: () => Promise<void>): Promise<void> {
    this.activeSyncs++;
    try {
      await task();
    } finally {
      this.activeSyncs--;
      // Clean up file chain if no more pending
      if (this.fileChains.get(filePath) === Promise.resolve()) {
        this.fileChains.delete(filePath);
      }
      // Drain waiting queue
      this.drainWaiting();
    }
  }

  private drainWaiting() {
    while (this.activeSyncs < this.maxConcurrent && this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      this.executeTask(next.filePath, next.task).then(next.resolve, next.reject);
    }
  }

  get pending(): number {
    return this.waiting.length;
  }

  get active(): number {
    return this.activeSyncs;
  }
}
