import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { slugFromPath, contentHash, parseFrontmatter, getContentType } from "../src/utils";

describe("slugFromPath", () => {
  it("converts filename to slug", () => {
    assert.equal(slugFromPath("posts/Hello World.md"), "hello-world");
  });

  it("handles special characters", () => {
    assert.equal(slugFromPath("posts/Benedict's Maw.md"), "benedicts-maw");
  });

  it("strips leading/trailing hyphens", () => {
    assert.equal(slugFromPath("posts/---test---.md"), "test");
  });

  it("handles nested paths", () => {
    assert.equal(slugFromPath("posts/subfolder/My Post.md"), "my-post");
  });

  it("handles already-slugged names", () => {
    assert.equal(slugFromPath("posts/already-a-slug.md"), "already-a-slug");
  });

  it("handles numbers", () => {
    assert.equal(slugFromPath("posts/2026-03-23 Daily Note.md"), "2026-03-23-daily-note");
  });
});

describe("contentHash", () => {
  it("produces consistent hash", () => {
    const h1 = contentHash("content", "title", ["tag1"]);
    const h2 = contentHash("content", "title", ["tag1"]);
    assert.equal(h1, h2);
  });

  it("changes with different content", () => {
    const h1 = contentHash("content1", "title", ["tag1"]);
    const h2 = contentHash("content2", "title", ["tag1"]);
    assert.notEqual(h1, h2);
  });

  it("changes with different title", () => {
    const h1 = contentHash("content", "title1", ["tag1"]);
    const h2 = contentHash("content", "title2", ["tag1"]);
    assert.notEqual(h1, h2);
  });

  it("changes with different tags", () => {
    const h1 = contentHash("content", "title", ["tag1"]);
    const h2 = contentHash("content", "title", ["tag2"]);
    assert.notEqual(h1, h2);
  });

  it("returns 32 char hex string", () => {
    const h = contentHash("test", "test", []);
    assert.equal(h.length, 32);
    assert.match(h, /^[0-9a-f]{32}$/);
  });
});

describe("parseFrontmatter", () => {
  it("parses basic frontmatter", () => {
    const input = `---
title: Hello World
published: true
tags: [meta, philosophy]
---
Body content here.`;

    const { data, content } = parseFrontmatter(input);
    assert.equal(data.title, "Hello World");
    assert.equal(data.published, true);
    assert.deepEqual(data.tags, ["meta", "philosophy"]);
    assert.equal(content.trim(), "Body content here.");
  });

  it("handles quoted strings", () => {
    const input = `---
title: "Quoted Title"
description: 'Single quoted'
---
Body`;
    const { data } = parseFrontmatter(input);
    assert.equal(data.title, "Quoted Title");
    assert.equal(data.description, "Single quoted");
  });

  it("handles numbers", () => {
    const input = `---
rating: 5
---
Body`;
    const { data } = parseFrontmatter(input);
    assert.equal(data.rating, 5);
  });

  it("handles no frontmatter", () => {
    const input = "Just plain content";
    const { data, content } = parseFrontmatter(input);
    assert.deepEqual(data, {});
    assert.equal(content, "Just plain content");
  });

  it("handles empty frontmatter", () => {
    const input = `---
---
Body`;
    const { data, content } = parseFrontmatter(input);
    assert.deepEqual(data, {});
    assert.equal(content.trim(), "Body");
  });

  it("handles boolean false", () => {
    const input = `---
published: false
---
Body`;
    const { data } = parseFrontmatter(input);
    assert.equal(data.published, false);
  });
});

describe("getContentType", () => {
  const folders = { posts: "posts", readings: "readings", bookmarks: "bookmarks" };
  const nowFile = "now.md";

  // Minimal TFile mock
  const mockFile = (path: string) => ({ path }) as any;

  it("identifies posts", () => {
    assert.equal(getContentType(mockFile("posts/hello.md"), folders, nowFile), "post");
  });

  it("identifies readings", () => {
    assert.equal(getContentType(mockFile("readings/meditations.md"), folders, nowFile), "reading");
  });

  it("identifies bookmarks", () => {
    assert.equal(getContentType(mockFile("bookmarks/link.md"), folders, nowFile), "bookmark");
  });

  it("identifies now.md", () => {
    assert.equal(getContentType(mockFile("now.md"), folders, nowFile), "now");
  });

  it("returns null for untracked files", () => {
    assert.equal(getContentType(mockFile("other/random.md"), folders, nowFile), null);
  });

  it("returns null for root-level files", () => {
    assert.equal(getContentType(mockFile("random.md"), folders, nowFile), null);
  });
});
