import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SyncLog } from "../src/sync-log";

describe("SyncLog", () => {
  it("adds and retrieves entries", () => {
    const log = new SyncLog();
    log.add({ file: "posts/test.md", action: "synced", contentType: "post", slug: "test" });
    assert.equal(log.getAll().length, 1);
    assert.equal(log.getAll()[0].action, "synced");
  });

  it("tracks errors separately", () => {
    const log = new SyncLog();
    log.add({ file: "posts/ok.md", action: "synced", contentType: "post", slug: "ok" });
    log.add({ file: "posts/bad.md", action: "error", contentType: "post", slug: "bad", error: "fail" });
    assert.equal(log.getErrors().length, 1);
    assert.equal(log.getErrors()[0].slug, "bad");
  });

  it("respects max entries", () => {
    const log = new SyncLog();
    for (let i = 0; i < 250; i++) {
      log.add({ file: `f${i}.md`, action: "synced", contentType: "post", slug: `f${i}` });
    }
    assert.ok(log.getAll().length <= 200);
  });

  it("returns recent entries", () => {
    const log = new SyncLog();
    for (let i = 0; i < 50; i++) {
      log.add({ file: `f${i}.md`, action: "synced", contentType: "post", slug: `f${i}` });
    }
    assert.equal(log.getRecent(5).length, 5);
    assert.equal(log.getRecent(5)[4].slug, "f49");
  });

  it("counts recent errors", () => {
    const log = new SyncLog();
    log.add({ file: "err.md", action: "error", contentType: "post", slug: "err", error: "x" });
    assert.equal(log.errorCount, 1);
  });

  it("finds last sync", () => {
    const log = new SyncLog();
    log.add({ file: "a.md", action: "synced", contentType: "post", slug: "a" });
    log.add({ file: "b.md", action: "error", contentType: "post", slug: "b", error: "x" });
    assert.equal(log.lastSync?.slug, "a");
  });

  it("serializes to JSON", () => {
    const log = new SyncLog();
    log.add({ file: "test.md", action: "synced", contentType: "post", slug: "test" });
    const json = log.toJSON();
    assert.equal(json.length, 1);
    assert.ok(json[0].timestamp > 0);
  });

  it("restores from saved data", () => {
    const saved = [
      { timestamp: 1000, file: "old.md", action: "synced" as const, contentType: "post", slug: "old" },
    ];
    const log = new SyncLog(saved);
    assert.equal(log.getAll().length, 1);
    assert.equal(log.getAll()[0].slug, "old");
  });

  it("clears entries", () => {
    const log = new SyncLog();
    log.add({ file: "test.md", action: "synced", contentType: "post", slug: "test" });
    log.clear();
    assert.equal(log.getAll().length, 0);
  });

  it("formats entries", () => {
    const log = new SyncLog();
    log.add({ file: "test.md", action: "synced", contentType: "post", slug: "test" });
    const formatted = log.formatEntry(log.getAll()[0]);
    assert.ok(formatted.includes("✓"));
    assert.ok(formatted.includes("post/test"));
  });
});
