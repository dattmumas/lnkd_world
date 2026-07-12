/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTPPasswordReset from "../ResendOTPPasswordReset.js";
import type * as attribution from "../attribution.js";
import type * as auth from "../auth.js";
import type * as beehiiv from "../beehiiv.js";
import type * as bizAccounts from "../bizAccounts.js";
import type * as bizSources from "../bizSources.js";
import type * as bonds from "../bonds.js";
import type * as bookmarks from "../bookmarks.js";
import type * as creators from "../creators.js";
import type * as creators_feed from "../creators_feed.js";
import type * as cronHealth from "../cronHealth.js";
import type * as crons from "../crons.js";
import type * as dealSources from "../dealSources.js";
import type * as deals from "../deals.js";
import type * as dealsBlock from "../dealsBlock.js";
import type * as dealsFeed from "../dealsFeed.js";
import type * as earlyFeed from "../earlyFeed.js";
import type * as feedItems from "../feedItems.js";
import type * as graph from "../graph.js";
import type * as graphLayout from "../graphLayout.js";
import type * as growth from "../growth.js";
import type * as growthSettings from "../growthSettings.js";
import type * as http from "../http.js";
import type * as lib_articleFetch from "../lib/articleFetch.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_cronReport from "../lib/cronReport.js";
import type * as lib_getxapi from "../lib/getxapi.js";
import type * as lib_queueScore from "../lib/queueScore.js";
import type * as lib_rss from "../lib/rss.js";
import type * as lib_telegram from "../lib/telegram.js";
import type * as lib_xfeed from "../lib/xfeed.js";
import type * as lib_xoauth from "../lib/xoauth.js";
import type * as lib_xvoice from "../lib/xvoice.js";
import type * as network from "../network.js";
import type * as newsSources from "../newsSources.js";
import type * as now from "../now.js";
import type * as ownReplies from "../ownReplies.js";
import type * as posts from "../posts.js";
import type * as projects from "../projects.js";
import type * as queue from "../queue.js";
import type * as readings from "../readings.js";
import type * as resources from "../resources.js";
import type * as scienceFeed from "../scienceFeed.js";
import type * as seed from "../seed.js";
import type * as stats from "../stats.js";
import type * as users from "../users.js";
import type * as versions from "../versions.js";
import type * as voiceProfile from "../voiceProfile.js";
import type * as weeklyReview from "../weeklyReview.js";
import type * as xMetrics from "../xMetrics.js";
import type * as xPoster from "../xPoster.js";
import type * as xPosts from "../xPosts.js";
import type * as xTrends from "../xTrends.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTPPasswordReset: typeof ResendOTPPasswordReset;
  attribution: typeof attribution;
  auth: typeof auth;
  beehiiv: typeof beehiiv;
  bizAccounts: typeof bizAccounts;
  bizSources: typeof bizSources;
  bonds: typeof bonds;
  bookmarks: typeof bookmarks;
  creators: typeof creators;
  creators_feed: typeof creators_feed;
  cronHealth: typeof cronHealth;
  crons: typeof crons;
  dealSources: typeof dealSources;
  deals: typeof deals;
  dealsBlock: typeof dealsBlock;
  dealsFeed: typeof dealsFeed;
  earlyFeed: typeof earlyFeed;
  feedItems: typeof feedItems;
  graph: typeof graph;
  graphLayout: typeof graphLayout;
  growth: typeof growth;
  growthSettings: typeof growthSettings;
  http: typeof http;
  "lib/articleFetch": typeof lib_articleFetch;
  "lib/auth": typeof lib_auth;
  "lib/cronReport": typeof lib_cronReport;
  "lib/getxapi": typeof lib_getxapi;
  "lib/queueScore": typeof lib_queueScore;
  "lib/rss": typeof lib_rss;
  "lib/telegram": typeof lib_telegram;
  "lib/xfeed": typeof lib_xfeed;
  "lib/xoauth": typeof lib_xoauth;
  "lib/xvoice": typeof lib_xvoice;
  network: typeof network;
  newsSources: typeof newsSources;
  now: typeof now;
  ownReplies: typeof ownReplies;
  posts: typeof posts;
  projects: typeof projects;
  queue: typeof queue;
  readings: typeof readings;
  resources: typeof resources;
  scienceFeed: typeof scienceFeed;
  seed: typeof seed;
  stats: typeof stats;
  users: typeof users;
  versions: typeof versions;
  voiceProfile: typeof voiceProfile;
  weeklyReview: typeof weeklyReview;
  xMetrics: typeof xMetrics;
  xPoster: typeof xPoster;
  xPosts: typeof xPosts;
  xTrends: typeof xTrends;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
