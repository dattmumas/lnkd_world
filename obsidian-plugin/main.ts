import { Notice, Plugin, TFile, TAbstractFile } from "obsidian";
import { LnkdSyncSettings, DEFAULT_SETTINGS, LnkdSyncSettingTab } from "./src/settings";
import { ConvexSyncer } from "./src/syncer";
import { SyncQueue } from "./src/queue";
import { SyncLog } from "./src/sync-log";
import { extractWikilinks } from "./src/wikilinks";
import { slugFromPath, getContentType, ContentType } from "./src/utils";
import { transformBookSearchFile } from "./src/book-transform";

export default class LnkdSyncPlugin extends Plugin {
  settings: LnkdSyncSettings = DEFAULT_SETTINGS;
  syncer!: ConvexSyncer;
  syncLog!: SyncLog;
  queue!: SyncQueue;
  statusBarEl!: HTMLElement;

  // Batch coalescing
  private pendingBatch = new Map<string, TFile>();
  private batchTimer: ReturnType<typeof setTimeout> | null = null;

  async onload() {
    await this.loadSettings();

    this.syncer = new ConvexSyncer(this.settings.convexUrl, this.settings.syncSecret);
    this.queue = new SyncQueue(this.settings.maxConcurrent);
    this.syncLog = new SyncLog((await this.loadData())?.syncLog ?? []);
    this.statusBarEl = this.addStatusBarItem();
    this.setStatus("idle");

    // Auto-sync on file modify
    this.registerEvent(
      this.app.vault.on("modify", (file: TAbstractFile) => {
        if (!this.settings.autoSync) return;
        if (!(file instanceof TFile)) return;
        if (!this.isWatchedFile(file)) return;
        this.enqueueBatch(file);
      })
    );

    // New file creation — also check for book-search files to auto-transform
    this.registerEvent(
      this.app.vault.on("create", (file: TAbstractFile) => {
        if (!(file instanceof TFile)) return;
        if (!file.path.endsWith(".md")) return;

        // Delay to let Obsidian write content + populate metadataCache
        setTimeout(async () => {
          // Check if this is a book-search file that needs transformation
          const cache = this.app.metadataCache.getFileCache(file);
          const fm = cache?.frontmatter ?? {};
          if (fm.isbn || fm.isbn13 || fm.publisher) {
            const transformed = await transformBookSearchFile(
              this.app, file, fm, this.settings.syncFolders.readings
            );
            if (transformed) {
              new Notice(`LNKD: Transformed "${fm.title}" → readings format`);
              // After transform + move, the modify/create events will trigger sync
              return;
            }
          }

          // Normal sync for watched files
          if (!this.settings.autoSync) return;
          if (!this.isWatchedFile(file)) return;
          this.enqueueBatch(file);
        }, 1000);
      })
    );

    // Rename handling (file moved or renamed)
    this.registerEvent(
      this.app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
        if (!(file instanceof TFile)) return;
        if (!file.path.endsWith(".md")) return;

        // Delete old slug if it was in a watched folder
        const oldType = getContentType({ path: oldPath } as TFile, this.settings.syncFolders, this.settings.nowFile);
        if (oldType && oldType !== "now") {
          const oldSlug = slugFromPath(oldPath);
          this.queue.enqueue(oldPath, async () => {
            try {
              await this.syncer.deleteContent(oldSlug, oldType);
            } catch (e) {
              console.error(`LNKD: failed to delete old slug ${oldSlug}:`, e);
            }
          });
        }

        // Sync new location if it's in a watched folder
        if (this.isWatchedFile(file)) {
          this.enqueueBatch(file);
        }
      })
    );

    // Delete handling
    this.registerEvent(
      this.app.vault.on("delete", (file: TAbstractFile) => {
        if (!(file instanceof TFile)) return;
        if (!file.path.endsWith(".md")) return;
        const type = getContentType(file, this.settings.syncFolders, this.settings.nowFile);
        if (!type || type === "now") return;

        const slug = slugFromPath(file.path);
        this.queue.enqueue(file.path, async () => {
          try {
            await this.syncer.deleteContent(slug, type);
            await this.syncer.recomputeBacklinks();
            console.log(`LNKD: deleted ${type} "${slug}"`);
          } catch (e) {
            console.error(`LNKD: failed to delete ${slug}:`, e);
          }
        });
      })
    );

    // Commands
    this.addCommand({
      id: "sync-current",
      name: "Sync current file",
      callback: () => this.syncActiveFile(),
    });

    this.addCommand({
      id: "sync-all",
      name: "Sync all content",
      callback: () => this.syncAll(),
    });

    this.addCommand({
      id: "retry-failed",
      name: "Retry failed syncs",
      callback: () => this.retryFailed(),
    });

    this.addCommand({
      id: "view-sync-log",
      name: "View sync log",
      callback: () => this.showSyncLog(),
    });

    // Settings tab
    this.addSettingTab(new LnkdSyncSettingTab(this.app, this));

    // Retry any persisted failed syncs on load
    const saved = await this.loadData();
    if (saved?.failedQueue?.length > 0) {
      this.syncer.failedQueue = saved.failedQueue;
      setTimeout(() => this.retryFailed(), 5000);
    }
  }

  async onunload() {
    // Persist failed sync queue + sync log
    const data = (await this.loadData()) ?? {};
    if (this.syncer.failedQueue.length > 0) {
      data.failedQueue = this.syncer.failedQueue;
    }
    data.syncLog = this.syncLog.toJSON();
    await this.saveData(data);
  }

  private showSyncLog() {
    const recent = this.syncLog.getRecent(30);
    if (recent.length === 0) {
      new Notice("LNKD: No sync activity yet");
      return;
    }

    const lines = recent.map((e) => this.syncLog.formatEntry(e));
    const errors = this.syncLog.errorCount;
    const header = errors > 0 ? `${errors} error(s) in last hour\n\n` : "";
    new Notice(header + lines.join("\n"), 15000);
  }

  // ─── Settings ──────────────────────────────────────

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  reinitSyncer() {
    this.syncer.updateCredentials(this.settings.convexUrl, this.settings.syncSecret);
  }

  // ─── File Classification ───────────────────────────

  isWatchedFile(file: TFile): boolean {
    if (!file.path.endsWith(".md")) return false;
    return getContentType(file, this.settings.syncFolders, this.settings.nowFile) !== null;
  }

  // ─── Batch Coalescing ─────────────────────────────

  private enqueueBatch(file: TFile) {
    this.pendingBatch.set(file.path, file);
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = setTimeout(() => this.flushBatch(), this.settings.debounceMs);
  }

  private async flushBatch() {
    const files = [...this.pendingBatch.values()];
    this.pendingBatch.clear();
    this.batchTimer = null;

    let needsBacklinkRecompute = false;

    for (const file of files) {
      this.queue.enqueue(file.path, async () => {
        const synced = await this.syncFile(file);
        if (synced) needsBacklinkRecompute = true;
      });
    }

    // After all files in batch are synced, recompute backlinks once
    if (files.length > 0) {
      this.queue.enqueue("__backlinks__", async () => {
        if (needsBacklinkRecompute) {
          try {
            await this.syncer.recomputeBacklinks();
          } catch (e) {
            console.error("LNKD: backlink recompute failed:", e);
          }
        }
      });
    }
  }

  // ─── Sync Logic ───────────────────────────────────

  private async syncFile(file: TFile): Promise<boolean> {
    this.setStatus("syncing");
    const type = getContentType(file, this.settings.syncFolders, this.settings.nowFile);
    if (!type) return false;
    const slug = slugFromPath(file.path);

    try {
      const raw = await this.app.vault.read(file);
      // Use Obsidian's metadataCache for frontmatter (handles all YAML formats)
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter: Record<string, unknown> = cache?.frontmatter ?? {};
      // Strip frontmatter from raw to get content body
      const fmEnd = raw.indexOf("---", 4);
      const content = fmEnd >= 0 ? raw.slice(raw.indexOf("\n", fmEnd) + 1) : raw;

      if (type === "now") {
        await this.syncer.syncNow(content);
        this.setStatus("synced");
        return false; // no backlinks for now.md
      }

      const wikilinks = extractWikilinks(this.app, file);

      if (type === "post") {
        await this.syncer.syncPost(slug, frontmatter, content, wikilinks);
      } else if (type === "reading") {
        await this.syncer.syncReading(slug, frontmatter, content, wikilinks);
      } else if (type === "bookmark") {
        await this.syncer.syncBookmark(slug, frontmatter, content, wikilinks);
      }

      // Create version
      const title = (frontmatter.title as string) ?? slug;
      const tags = (frontmatter.tags as string[]) ?? [];
      await this.syncer.createVersion(slug, type, content, title, tags);

      this.syncLog.add({
        file: file.path,
        action: "synced",
        contentType: type,
        slug,
      });
      this.setStatus("synced");
      return true;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      this.syncLog.add({
        file: file.path,
        action: "error",
        contentType: type ?? "unknown",
        slug: slugFromPath(file.path),
        error: errorMsg,
      });
      this.setStatus("error");
      new Notice(`LNKD sync failed: ${file.name}\n${errorMsg.slice(0, 100)}`, 8000);
      console.error(`LNKD: sync failed for ${file.path}:`, e);
      return false;
    }
  }

  private async syncActiveFile() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("No active file");
      return;
    }
    if (!this.isWatchedFile(file)) {
      new Notice("File not in a watched folder");
      return;
    }

    this.setStatus("syncing");
    const synced = await this.syncFile(file);
    if (synced) {
      try {
        await this.syncer.recomputeBacklinks();
      } catch (e) {
        console.error("LNKD: backlink recompute failed:", e);
      }
    }
    new Notice("LNKD: File synced");
  }

  private async syncAll() {
    const folders = this.settings.syncFolders;
    const allFiles = this.app.vault.getMarkdownFiles().filter((f) => this.isWatchedFile(f));

    if (allFiles.length === 0) {
      new Notice("No watched files found");
      return;
    }

    new Notice(`LNKD: Syncing ${allFiles.length} files...`);
    this.setStatus("syncing");
    let synced = 0;
    let errors = 0;

    for (const file of allFiles) {
      try {
        // Run book transform/backfill before syncing
        const cache = this.app.metadataCache.getFileCache(file);
        const fm = cache?.frontmatter ?? {};
        if (fm.isbn || fm.isbn13 || fm.publisher) {
          await transformBookSearchFile(
            this.app, file, fm, this.settings.syncFolders.readings
          );
        }

        const result = await this.syncFile(file);
        if (result) synced++;
      } catch {
        errors++;
      }
    }

    // Recompute backlinks once after all synced
    try {
      await this.syncer.recomputeBacklinks();
    } catch (e) {
      console.error("LNKD: backlink recompute failed:", e);
    }

    this.setStatus(errors > 0 ? "error" : "synced");
    new Notice(`LNKD: ${synced} synced, ${errors} errors`);
  }

  private async retryFailed() {
    if (this.syncer.failedQueue.length === 0) {
      new Notice("LNKD: No failed syncs to retry");
      return;
    }

    const count = this.syncer.failedQueue.length;
    new Notice(`LNKD: Retrying ${count} failed syncs...`);
    const succeeded = await this.syncer.retryFailed();
    const remaining = this.syncer.failedQueue.length;

    if (remaining > 0) {
      new Notice(`LNKD: ${succeeded} recovered, ${remaining} still failing`);
    } else {
      new Notice(`LNKD: All ${count} retries succeeded`);
    }
  }

  // ─── Status Bar ───────────────────────────────────

  private statusTimeout: ReturnType<typeof setTimeout> | null = null;

  private setStatus(state: "idle" | "syncing" | "synced" | "error") {
    if (this.statusTimeout) clearTimeout(this.statusTimeout);

    const labels: Record<string, string> = {
      idle: "LNKD",
      syncing: "LNKD ↑",
      synced: "LNKD ✓",
      error: "LNKD ✗",
    };

    this.statusBarEl.setText(labels[state]);

    if (state === "synced") {
      this.statusTimeout = setTimeout(() => this.setStatus("idle"), 3000);
    }
  }
}
