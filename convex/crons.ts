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

// "Early Engagement" — poll the watchlist for fresh posts often, so replies are early.
crons.interval(
  "refresh-early",
  { minutes: 20 },
  internal.earlyFeed.refreshInternal,
);

// Growth tracking — daily snapshot of the tracked account's followers.
crons.daily(
  "growth-snapshot",
  { hourUTC: 12, minuteUTC: 0 },
  internal.growth.snapshotInternal,
);

// Content teardown — refresh top-performing posts daily (offset from the others).
crons.daily(
  "refresh-teardown",
  { hourUTC: 14, minuteUTC: 0 },
  internal.teardown.refreshInternal,
);

// Science News — comb the RSS sources daily for stories worth sharing.
crons.daily(
  "refresh-science",
  { hourUTC: 11, minuteUTC: 30 },
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

export default crons;
