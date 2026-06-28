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

export default crons;
