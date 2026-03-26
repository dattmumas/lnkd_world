import { requestUrl } from "obsidian";
import { sleep, contentHash } from "./utils";
import type { WikilinkData } from "./wikilinks";

interface FailedSync {
  path: string;
  args: Record<string, unknown>;
  timestamp: number;
  attempts: number;
}

export class ConvexSyncer {
  private url: string;
  private secret: string;
  failedQueue: FailedSync[] = [];

  constructor(url: string, secret: string) {
    this.url = url;
    this.secret = secret;
  }

  updateCredentials(url: string, secret: string) {
    this.url = url;
    this.secret = secret;
  }

  private async mutation(path: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.url || !this.secret) {
      throw new Error("LNKD Sync: Convex URL or Sync Secret not configured");
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await requestUrl({
          url: `${this.url}/api/mutation`,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path,
            args: { ...args, secret: this.secret },
          }),
        });

        const body = response.json;
        console.log(`LNKD mutation ${path}:`, response.status, JSON.stringify(body).slice(0, 200));

        if (response.status >= 400) {
          throw new Error(`Convex error ${response.status}: ${response.text}`);
        }

        if (body?.status === "error") {
          throw new Error(`Convex mutation error: ${body.errorMessage ?? JSON.stringify(body)}`);
        }

        return body?.value;
      } catch (e) {
        if (attempt < 2) {
          await sleep(1000 * Math.pow(2, attempt));
        } else {
          // Persist to failed queue
          this.failedQueue.push({
            path,
            args,
            timestamp: Date.now(),
            attempts: 3,
          });
          throw e;
        }
      }
    }
  }

  async syncPost(
    slug: string,
    frontmatter: Record<string, unknown>,
    content: string,
    wikilinks: WikilinkData
  ): Promise<void> {
    await this.mutation("posts:upsertBySlug", {
      slug,
      title: (frontmatter.title as string) ?? slug,
      description: (frontmatter.description as string) ?? "",
      content: content.trim(),
      tags: (frontmatter.tags as string[]) ?? [],
      published: (frontmatter.published as boolean) ?? false,
      gated: (frontmatter.gated as boolean) ?? undefined,
      publishedAt: frontmatter.publishedAt ? String(frontmatter.publishedAt) : undefined,
      wikilinksRaw: wikilinks.raw,
      wikilinksResolved: wikilinks.resolved,
      wikilinksBroken: wikilinks.broken.length > 0 ? wikilinks.broken : undefined,
    });
  }

  async syncReading(
    slug: string,
    frontmatter: Record<string, unknown>,
    content: string,
    wikilinks: WikilinkData
  ): Promise<void> {
    await this.mutation("readings:upsertBySlug", {
      slug,
      title: (frontmatter.title as string) ?? slug,
      author: (frontmatter.author as string) ?? "Unknown",
      type: (frontmatter.type as string) ?? "book",
      rating: (frontmatter.rating as number) ?? undefined,
      content: content.trim(),
      tags: (frontmatter.tags as string[]) ?? [],
      published: (frontmatter.published as boolean) ?? false,
      gated: (frontmatter.gated as boolean) ?? undefined,
      publishedAt: frontmatter.publishedAt ? String(frontmatter.publishedAt) : undefined,
      url: (frontmatter.url as string) ?? undefined,
      coverUrl: (frontmatter.coverUrl as string) ?? undefined,
      wikilinksRaw: wikilinks.raw,
      wikilinksResolved: wikilinks.resolved,
      wikilinksBroken: wikilinks.broken.length > 0 ? wikilinks.broken : undefined,
    });
  }

  async syncBookmark(
    slug: string,
    frontmatter: Record<string, unknown>,
    content: string,
    wikilinks: WikilinkData
  ): Promise<void> {
    await this.mutation("bookmarks:upsertBySlug", {
      slug,
      title: (frontmatter.title as string) ?? slug,
      url: (frontmatter.url as string) ?? "",
      description: content.trim() || (frontmatter.description as string) || "",
      tags: (frontmatter.tags as string[]) ?? [],
      published: (frontmatter.published as boolean) ?? false,
      gated: (frontmatter.gated as boolean) ?? undefined,
      publishedAt: frontmatter.publishedAt ? String(frontmatter.publishedAt) : undefined,
      wikilinksRaw: wikilinks.raw,
      wikilinksResolved: wikilinks.resolved,
      wikilinksBroken: wikilinks.broken.length > 0 ? wikilinks.broken : undefined,
    });
  }

  async syncNow(content: string): Promise<void> {
    await this.mutation("now:upsert", {
      content: content.trim(),
      updatedAt: new Date().toISOString().split("T")[0],
    });
  }

  async createVersion(
    slug: string,
    contentType: "post" | "reading" | "bookmark",
    content: string,
    title: string,
    tags: string[]
  ): Promise<void> {
    const hash = contentHash(content.trim(), title, tags);
    await this.mutation("versions:createVersion", {
      slug,
      contentType,
      contentHash: hash,
      content: content.trim(),
      title,
      changeType: "edit",
      createdAt: new Date().toISOString(),
    });
  }

  async deleteContent(slug: string, contentType: "post" | "reading" | "bookmark"): Promise<void> {
    const table = contentType === "post" ? "posts" : contentType === "reading" ? "readings" : "bookmarks";
    await this.mutation(`${table}:deleteBySlug`, { slug });
  }

  async recomputeBacklinks(): Promise<void> {
    await this.mutation("graph:recomputeBacklinks", {});
  }

  async retryFailed(): Promise<number> {
    const toRetry = [...this.failedQueue];
    this.failedQueue = [];
    let succeeded = 0;

    for (const item of toRetry) {
      try {
        await this.mutation(item.path, item.args);
        succeeded++;
      } catch {
        // Re-add to queue if still failing
        this.failedQueue.push({ ...item, attempts: item.attempts + 1 });
      }
    }

    return succeeded;
  }
}
