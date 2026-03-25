import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SyncQueue } from "../src/queue";

describe("SyncQueue", () => {
  it("executes tasks", async () => {
    const queue = new SyncQueue(3);
    let executed = false;
    await queue.enqueue("file.md", async () => {
      executed = true;
    });
    assert.equal(executed, true);
  });

  it("serializes tasks for the same file", async () => {
    const queue = new SyncQueue(3);
    const order: number[] = [];

    const p1 = queue.enqueue("same.md", async () => {
      await new Promise((r) => setTimeout(r, 50));
      order.push(1);
    });

    const p2 = queue.enqueue("same.md", async () => {
      order.push(2);
    });

    await Promise.all([p1, p2]);
    assert.deepEqual(order, [1, 2]);
  });

  it("allows concurrent tasks for different files", async () => {
    const queue = new SyncQueue(3);
    const running: string[] = [];
    const maxConcurrent: number[] = [];

    const task = (name: string) =>
      queue.enqueue(name, async () => {
        running.push(name);
        maxConcurrent.push(running.length);
        await new Promise((r) => setTimeout(r, 30));
        running.splice(running.indexOf(name), 1);
      });

    await Promise.all([task("a.md"), task("b.md"), task("c.md")]);
    // All three should have been running concurrently
    assert.ok(Math.max(...maxConcurrent) >= 2, "Should run at least 2 concurrently");
  });

  it("respects concurrency limit", async () => {
    const queue = new SyncQueue(2); // limit to 2
    const running: string[] = [];
    const maxConcurrent: number[] = [];

    const task = (name: string) =>
      queue.enqueue(name, async () => {
        running.push(name);
        maxConcurrent.push(running.length);
        await new Promise((r) => setTimeout(r, 50));
        running.splice(running.indexOf(name), 1);
      });

    await Promise.all([task("a.md"), task("b.md"), task("c.md"), task("d.md")]);
    assert.ok(Math.max(...maxConcurrent) <= 2, `Max concurrent was ${Math.max(...maxConcurrent)}, expected <= 2`);
  });

  it("handles task errors without breaking the queue", async () => {
    const queue = new SyncQueue(3);
    let secondRan = false;

    try {
      await queue.enqueue("fail.md", async () => {
        throw new Error("intentional");
      });
    } catch {
      // expected
    }

    await queue.enqueue("success.md", async () => {
      secondRan = true;
    });

    assert.equal(secondRan, true);
  });

  it("tracks active and pending counts", async () => {
    const queue = new SyncQueue(1);
    let sawPending = false;

    const p1 = queue.enqueue("a.md", async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Enqueue while a.md is running
    const p2 = queue.enqueue("b.md", async () => {
      // By the time this runs, a.md should be done
    });

    // Check pending while a.md is still running
    setTimeout(() => {
      if (queue.pending > 0) sawPending = true;
    }, 10);

    await Promise.all([p1, p2]);
    assert.equal(sawPending, true);
  });
});
