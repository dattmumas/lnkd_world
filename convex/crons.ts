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

export default crons;
