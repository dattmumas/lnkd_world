"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

type XPost = FunctionReturnType<typeof api.xPosts.board>[number];

const PILLAR_CHIP: Record<XPost["pillar"], { label: string; cls: string }> = {
  health: { label: "Health", cls: "gc-pillar-health" },
  finance: { label: "Finance", cls: "gc-pillar-finance" },
  startup: { label: "Startup", cls: "gc-pillar-startup" },
};

const field =
  "border border-[var(--color-border)] rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "K";
  return String(n);
}

function fullText(post: XPost): string {
  return [post.body, ...(post.threadParts ?? [])].join("\n\n");
}

/**
 * One pipeline card (growth dashboard). Posting is manual by design: the card
 * copies the text and opens X's compose intent; the user posts from their real
 * session and pastes the tweet URL back so metrics can attach.
 */
export function PostCard({
  post,
  now,
  onEdit,
}: {
  post: XPost;
  now: number;
  onEdit: (post: XPost) => void;
}) {
  const setStatus = useMutation(api.xPosts.setStatus);
  const scheduleMut = useMutation(api.xPosts.schedule);
  const markPosted = useMutation(api.xPosts.markPosted);
  const recycle = useMutation(api.xPosts.recycle);
  const remove = useMutation(api.xPosts.remove);
  const retry = useMutation(api.xPoster.retry);
  const postNow = useAction(api.xPoster.postNow);

  const [copied, setCopied] = useState(false);
  const [showPostedForm, setShowPostedForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [tweetUrl, setTweetUrl] = useState("");
  const [when, setWhen] = useState("");
  const [posting, setPosting] = useState(false);
  const [postNowError, setPostNowError] = useState("");

  const isThread = post.kind === "thread";
  const auto = post.autoPost !== false;
  const dueNow =
    post.status === "scheduled" && post.scheduledAt != null && post.scheduledAt <= now;
  const chip = PILLAR_CHIP[post.pillar];

  const onPostNow = async () => {
    if (!confirm("Post this to X right now?")) return;
    setPosting(true);
    setPostNowError("");
    try {
      await postNow({ id: post._id });
    } catch (e) {
      setPostNowError(e instanceof Error ? e.message : String(e));
    } finally {
      setPosting(false);
    }
  };

  const copyAndOpen = () => {
    navigator.clipboard?.writeText(fullText(post)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    window.open(
      `https://x.com/intent/post?text=${encodeURIComponent(post.body)}`,
      "_blank",
      "noopener",
    );
  };

  const btn =
    "text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]";

  return (
    <div className="border border-[var(--color-border)] rounded-lg bg-white p-3 space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        <span className={`gc-chip ${chip.cls}`}>{chip.label}</span>
        {isThread && (
          <span className="gc-chip gc-chip-plain">
            thread · {1 + (post.threadParts?.length ?? 0)}
          </span>
        )}
        {post.isEvergreen && (
          <span className="text-[var(--color-text-secondary)]" title="Evergreen">
            ♻
          </span>
        )}
        {post.status === "scheduled" && auto && !post.postError && (
          <span
            className={`gc-chip ${dueNow ? "gc-chip-ok" : "gc-chip-plain"}`}
            title="Posts through the X API at the scheduled time"
          >
            {dueNow ? "posting…" : "auto"}
          </span>
        )}
        {dueNow && (!auto || post.postError) && (
          <span className="gc-chip gc-chip-due">due now</span>
        )}
        <span className="ml-auto gc-num text-[11px] text-[var(--color-text-secondary)]">
          {post.status === "scheduled" && post.scheduledAt != null
            ? new Date(post.scheduledAt).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : post.status === "posted" && post.postedAt != null
              ? new Date(post.postedAt).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })
              : null}
        </span>
      </div>

      <p className="text-sm whitespace-pre-wrap break-words line-clamp-5">{post.body}</p>

      {(post.postError || postNowError) && (
        <div className="gc-banner-fault text-xs text-[var(--gc-fault)] px-2 py-1.5 flex items-center gap-2">
          <span className="min-w-0 truncate" title={post.postError ?? postNowError}>
            {post.postError ?? postNowError}
          </span>
          {post.postError && (
            <button
              onClick={() => void retry({ id: post._id })}
              className="shrink-0 font-semibold hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {post.status === "posted" && (
        <div className="text-xs text-[var(--color-text-secondary)]">
          {post.latestViews != null ? (
            <span className="gc-num text-[11px] flex gap-3 flex-wrap">
              <span>{fmt(post.latestViews)} views</span>
              <span>{fmt(post.latestLikes ?? 0)} likes</span>
              <span>{fmt(post.latestReplies ?? 0)} replies</span>
              <span>{fmt(post.latestReposts ?? 0)} reposts</span>
            </span>
          ) : post.tweetId ? (
            <span>metrics pending — pulled daily</span>
          ) : (
            <span className="text-[var(--gc-due)]">
              no metrics — add the tweet URL below
            </span>
          )}
        </div>
      )}

      {/* Actions by status */}
      <div className="flex items-center gap-3 flex-wrap pt-1">
        {(post.status === "idea" ||
          post.status === "draft" ||
          post.status === "scheduled") && (
          <>
            <button onClick={() => onEdit(post)} className={btn}>
              Edit
            </button>
            {post.status === "idea" && (
              <button
                onClick={() => void setStatus({ id: post._id, status: "draft" })}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                → Draft
              </button>
            )}
            {post.status === "draft" && (
              <button
                onClick={() => setShowScheduleForm((s) => !s)}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Schedule…
              </button>
            )}
            {(post.status === "draft" || post.status === "scheduled") && (
              <>
                <button
                  onClick={() => void onPostNow()}
                  disabled={posting}
                  className="text-xs font-semibold text-[var(--color-accent)] hover:underline disabled:opacity-50"
                >
                  {posting ? "Posting…" : "Post now"}
                </button>
                <button
                  onClick={copyAndOpen}
                  className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
                >
                  {copied ? "Copied!" : isThread ? "Copy all & open X ↗" : "Copy & open X ↗"}
                </button>
                <button
                  onClick={() => setShowPostedForm((s) => !s)}
                  className={btn}
                >
                  Mark posted…
                </button>
              </>
            )}
            {post.status === "scheduled" && (
              <button
                onClick={() => void setStatus({ id: post._id, status: "draft" })}
                className={btn}
              >
                Unschedule
              </button>
            )}
            <button
              onClick={() => void setStatus({ id: post._id, status: "archived" })}
              className={`${btn} ml-auto`}
            >
              Archive
            </button>
          </>
        )}
        {post.status === "posted" && (
          <>
            {post.tweetUrl && (
              <a
                href={post.tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Open on X ↗
              </a>
            )}
            {!post.tweetId && (
              <button onClick={() => setShowPostedForm((s) => !s)} className={btn}>
                Add tweet URL…
              </button>
            )}
            {post.isEvergreen && (
              <button
                onClick={() => void recycle({ id: post._id })}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Recycle as draft
              </button>
            )}
            <button
              onClick={() => void setStatus({ id: post._id, status: "archived" })}
              className={`${btn} ml-auto`}
            >
              Archive
            </button>
          </>
        )}
        {post.status === "archived" && (
          <>
            <button
              onClick={() => void setStatus({ id: post._id, status: "draft" })}
              className={btn}
            >
              Restore to drafts
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this post permanently?"))
                  void remove({ id: post._id });
              }}
              className={`${btn} hover:text-[var(--gc-fault)] ml-auto`}
            >
              Delete
            </button>
          </>
        )}
      </div>

      {showScheduleForm && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!when) return;
            void scheduleMut({ id: post._id, scheduledAt: new Date(when).getTime() });
            setShowScheduleForm(false);
            setWhen("");
          }}
        >
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className={field}
          />
          <button
            type="submit"
            className="text-xs bg-[var(--color-accent)] text-white rounded px-2.5 py-1 hover:bg-[var(--color-accent-hover)]"
          >
            Set
          </button>
        </form>
      )}

      {showPostedForm && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void markPosted({ id: post._id, tweetUrl: tweetUrl.trim() || undefined });
            setShowPostedForm(false);
            setTweetUrl("");
          }}
        >
          <input
            placeholder="Tweet URL (enables metrics tracking)"
            value={tweetUrl}
            onChange={(e) => setTweetUrl(e.target.value)}
            className={`${field} flex-1`}
          />
          <button
            type="submit"
            className="text-xs bg-[var(--color-accent)] text-white rounded px-2.5 py-1 hover:bg-[var(--color-accent-hover)]"
          >
            {post.status === "posted" ? "Attach" : "Posted"}
          </button>
        </form>
      )}
    </div>
  );
}
