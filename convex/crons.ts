import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Refresh "Trending on X" from the X API once a day (13:00 UTC ≈ early-morning US).
crons.daily(
  "refresh-x-trends",
  { hourUTC: 13, minuteUTC: 0 },
  internal.xTrends.refreshInternal,
);

// Refresh the curated "Creators" feed (offset to avoid simultaneous X API calls).
crons.daily(
  "refresh-creators",
  { hourUTC: 13, minuteUTC: 30 },
  internal.creators_feed.refreshInternal,
);

// "Early Engagement" — fast watchlist polling. The tick throttles itself to
// ~20 min outside the configured active hours (convex/growthSettings.ts).
crons.interval("refresh-early", { minutes: 5 }, internal.earlyFeed.tick, {});

// Growth tracking — daily snapshot of the tracked account's followers.
crons.daily(
  "growth-snapshot",
  { hourUTC: 12, minuteUTC: 0 },
  internal.growth.snapshotInternal,
);

// Consumer Deal Radar — hourly tick; full RSS+X sweep during active hours,
// RSS-only every 4h overnight (:20 offset avoids the :00 getXAPI cluster).
crons.hourly(
  "deal-radar",
  { minuteUTC: 20 },
  internal.dealsFeed.tickInternal,
);

// Deal retention — old deals + extraction-dedup markers.
crons.daily(
  "prune-deals",
  { hourUTC: 10, minuteUTC: 5 },
  internal.deals.prune,
);

// beehiiv → pipeline: seed new newsletter posts as thread ideas.
crons.daily(
  "pull-beehiiv",
  { hourUTC: 11, minuteUTC: 0 },
  internal.beehiiv.pullInternal,
);

// Science News — comb the RSS sources for stories worth sharing. Three times
// a day (4:30am / 10:30am / 4:30pm US-Pacific) so the briefing stays fresh
// through the working day, not one 4:30am edition that reads stale by noon.
crons.cron(
  "refresh-science",
  "30 11,17,23 * * *",
  internal.scienceFeed.refreshInternal,
);

// Unified queue retention — expire decayed items, drop old rows and actions.
crons.daily(
  "prune-feed-items",
  { hourUTC: 10, minuteUTC: 0 },
  internal.feedItems.prune,
);

// Affinity forgetting — decay behavior counters (~30-day half-life) so old
// engagement patterns stop steering the queue.
crons.daily(
  "decay-affinities",
  { hourUTC: 10, minuteUTC: 15 },
  internal.queue.decayAffinities,
);

// Auto-poster — fire due scheduled pipeline posts through the X API.
// 5-min cadence (posts land within 5 min of their slot): the 2-min loop was
// 720 no-op function calls/day against a mostly empty schedule.
crons.interval(
  "fire-scheduled-posts",
  { minutes: 5 },
  internal.xPoster.fireInternal,
);

// Post metrics — snapshot public metrics for recently posted pipeline posts
// (offset from the 12:00 growth snapshot so getXAPI calls don't overlap).
crons.daily(
  "pull-x-metrics",
  { hourUTC: 12, minuteUTC: 30 },
  internal.xMetrics.pullInternal,
);

// Follow sync — accounts the tracked handle follows join the creators
// watchlist automatically (additive only).
crons.daily(
  "sync-follows",
  { hourUTC: 12, minuteUTC: 45 },
  internal.creators.syncFollowsInternal,
);

// Own-reply tracking — ground truth of every reply the account posts on X,
// on-system or not, for reply counts / ROI / attribution.
crons.interval(
  "track-own-replies",
  { hours: 1 },
  internal.ownReplies.trackInternal,
);

// Voice profiles — refresh the real-tweet grounding for post drafting (own top
// posts + per-pillar niche winners).
crons.daily(
  "refresh-voice-profiles",
  { hourUTC: 14, minuteUTC: 30 },
  internal.voiceProfile.refreshInternal,
  {}, // no pillar arg = refresh all three
);

// Weekly review — Claude-written Sunday summary of the week's growth, after
// that day's follower snapshot and metrics pull have landed.
crons.weekly(
  "weekly-review",
  { dayOfWeek: "sunday", hourUTC: 15, minuteUTC: 0 },
  internal.weeklyReview.generateInternal,
);

export default crons;
