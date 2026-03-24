/**
 * Watch the Obsidian vault for changes and auto-sync to Convex.
 *
 * Usage:
 *   npx tsx scripts/watch.ts <vault-path>
 *
 * Watches for .md file changes in posts/, readings/, bookmarks/, and now.md.
 * Debounces rapid changes and runs the sync script automatically.
 */
import { watch } from "fs";
import { execSync } from "child_process";
import { join } from "path";

const vaultPath = process.argv[2];
if (!vaultPath) {
  console.error("Usage: npx tsx scripts/watch.ts <vault-path>");
  process.exit(1);
}

const DEBOUNCE_MS = 2000;
let timeout: ReturnType<typeof setTimeout> | null = null;
let syncing = false;

function runSync() {
  if (syncing) return;
  syncing = true;

  console.log(`\n[${new Date().toLocaleTimeString()}] Changes detected, syncing...`);
  try {
    execSync(`npx tsx scripts/sync.ts "${vaultPath}"`, {
      stdio: "inherit",
      cwd: join(import.meta.dirname, ".."),
    });
  } catch {
    console.error("Sync failed");
  }
  syncing = false;
}

function scheduleSync() {
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(runSync, DEBOUNCE_MS);
}

// Watch directories
const dirs = ["posts", "readings", "bookmarks"];
for (const dir of dirs) {
  const fullPath = join(vaultPath, dir);
  try {
    watch(fullPath, { recursive: true }, (_, filename) => {
      if (filename?.endsWith(".md")) {
        console.log(`  [change] ${dir}/${filename}`);
        scheduleSync();
      }
    });
    console.log(`Watching ${fullPath}`);
  } catch {
    console.log(`Skipping ${dir}/ (not found)`);
  }
}

// Watch now.md separately
const nowFile = join(vaultPath, "now.md");
try {
  watch(nowFile, () => {
    console.log("  [change] now.md");
    scheduleSync();
  });
  console.log(`Watching ${nowFile}`);
} catch {
  console.log("Skipping now.md (not found)");
}

console.log("\nWatching for changes. Press Ctrl+C to stop.\n");

// Keep process alive
process.on("SIGINT", () => {
  console.log("\nStopped watching.");
  process.exit(0);
});
