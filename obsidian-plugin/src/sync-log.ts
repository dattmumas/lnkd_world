export interface SyncLogEntry {
  timestamp: number;
  file: string;
  action: "synced" | "deleted" | "version_created" | "error" | "retry";
  contentType: string;
  slug: string;
  error?: string;
}

const MAX_LOG_ENTRIES = 200;

export class SyncLog {
  private entries: SyncLogEntry[] = [];
  private onUpdate?: () => void;

  constructor(initial: SyncLogEntry[] = []) {
    this.entries = initial.slice(-MAX_LOG_ENTRIES);
  }

  setOnUpdate(fn: () => void) {
    this.onUpdate = fn;
  }

  add(entry: Omit<SyncLogEntry, "timestamp">) {
    this.entries.push({ ...entry, timestamp: Date.now() });
    if (this.entries.length > MAX_LOG_ENTRIES) {
      this.entries = this.entries.slice(-MAX_LOG_ENTRIES);
    }
    this.onUpdate?.();
  }

  getAll(): SyncLogEntry[] {
    return [...this.entries];
  }

  getRecent(n: number = 20): SyncLogEntry[] {
    return this.entries.slice(-n);
  }

  getErrors(): SyncLogEntry[] {
    return this.entries.filter((e) => e.action === "error");
  }

  getRecentErrors(n: number = 10): SyncLogEntry[] {
    return this.getErrors().slice(-n);
  }

  clear() {
    this.entries = [];
    this.onUpdate?.();
  }

  toJSON(): SyncLogEntry[] {
    return this.entries;
  }

  get errorCount(): number {
    // Errors in the last hour
    const hourAgo = Date.now() - 60 * 60 * 1000;
    return this.entries.filter((e) => e.action === "error" && e.timestamp > hourAgo).length;
  }

  get lastSync(): SyncLogEntry | null {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i].action === "synced") return this.entries[i];
    }
    return null;
  }

  formatEntry(entry: SyncLogEntry): string {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const icon = entry.action === "error" ? "✗" : entry.action === "synced" ? "✓" : "↑";
    const msg = entry.error ? `: ${entry.error}` : "";
    return `[${time}] ${icon} ${entry.action} ${entry.contentType}/${entry.slug}${msg}`;
  }
}
