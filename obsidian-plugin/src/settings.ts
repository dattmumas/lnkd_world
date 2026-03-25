import { App, PluginSettingTab, Setting } from "obsidian";
import type LnkdSyncPlugin from "../main";

export interface LnkdSyncSettings {
  convexUrl: string;
  syncSecret: string;
  autoSync: boolean;
  debounceMs: number;
  maxConcurrent: number;
  syncFolders: {
    posts: string;
    readings: string;
    bookmarks: string;
  };
  nowFile: string;
}

export const DEFAULT_SETTINGS: LnkdSyncSettings = {
  convexUrl: "",
  syncSecret: "",
  autoSync: true,
  debounceMs: 2000,
  maxConcurrent: 3,
  syncFolders: {
    posts: "posts",
    readings: "readings",
    bookmarks: "bookmarks",
  },
  nowFile: "now.md",
};

export class LnkdSyncSettingTab extends PluginSettingTab {
  plugin: LnkdSyncPlugin;

  constructor(app: App, plugin: LnkdSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "LNKD Sync Settings" });

    new Setting(containerEl)
      .setName("Convex URL")
      .setDesc("Your Convex deployment URL (e.g., https://steady-butterfly-270.convex.cloud)")
      .addText((text) =>
        text
          .setPlaceholder("https://your-deployment.convex.cloud")
          .setValue(this.plugin.settings.convexUrl)
          .onChange(async (value) => {
            this.plugin.settings.convexUrl = value.trim();
            await this.plugin.saveSettings();
            this.plugin.reinitSyncer();
          })
      );

    new Setting(containerEl)
      .setName("Sync Secret")
      .setDesc("The SYNC_SECRET for authenticating mutations")
      .addText((text) => {
        text
          .setPlaceholder("your-sync-secret")
          .setValue(this.plugin.settings.syncSecret)
          .onChange(async (value) => {
            this.plugin.settings.syncSecret = value.trim();
            await this.plugin.saveSettings();
            this.plugin.reinitSyncer();
          });
        text.inputEl.type = "password";
      });

    new Setting(containerEl)
      .setName("Auto sync")
      .setDesc("Automatically sync files when saved")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoSync).onChange(async (value) => {
          this.plugin.settings.autoSync = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Debounce (ms)")
      .setDesc("Wait this long after the last save before syncing (default: 2000)")
      .addText((text) =>
        text
          .setPlaceholder("2000")
          .setValue(String(this.plugin.settings.debounceMs))
          .onChange(async (value) => {
            const n = parseInt(value, 10);
            if (!isNaN(n) && n >= 500) {
              this.plugin.settings.debounceMs = n;
              await this.plugin.saveSettings();
            }
          })
      );

    containerEl.createEl("h3", { text: "Folder Mapping" });

    new Setting(containerEl)
      .setName("Posts folder")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.syncFolders.posts)
          .onChange(async (value) => {
            this.plugin.settings.syncFolders.posts = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Readings folder")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.syncFolders.readings)
          .onChange(async (value) => {
            this.plugin.settings.syncFolders.readings = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Bookmarks folder")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.syncFolders.bookmarks)
          .onChange(async (value) => {
            this.plugin.settings.syncFolders.bookmarks = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Now file")
      .setDesc("Path to your now.md file")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.nowFile)
          .onChange(async (value) => {
            this.plugin.settings.nowFile = value.trim();
            await this.plugin.saveSettings();
          })
      );
  }
}
