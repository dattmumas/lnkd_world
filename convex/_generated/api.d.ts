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
import type * as auth from "../auth.js";
import type * as bonds from "../bonds.js";
import type * as bookmarks from "../bookmarks.js";
import type * as creators from "../creators.js";
import type * as creators_feed from "../creators_feed.js";
import type * as crons from "../crons.js";
import type * as earlyFeed from "../earlyFeed.js";
import type * as feed from "../feed.js";
import type * as feedPages_contentiousNews from "../feedPages/contentiousNews.js";
import type * as feedPages_replyRadar from "../feedPages/replyRadar.js";
import type * as feedPages_xTrends from "../feedPages/xTrends.js";
import type * as graph from "../graph.js";
import type * as graphLayout from "../graphLayout.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_getxapi from "../lib/getxapi.js";
import type * as lib_xfeed from "../lib/xfeed.js";
import type * as network from "../network.js";
import type * as now from "../now.js";
import type * as posts from "../posts.js";
import type * as projects from "../projects.js";
import type * as readings from "../readings.js";
import type * as resources from "../resources.js";
import type * as seed from "../seed.js";
import type * as stats from "../stats.js";
import type * as users from "../users.js";
import type * as versions from "../versions.js";
import type * as xTrends from "../xTrends.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTPPasswordReset: typeof ResendOTPPasswordReset;
  auth: typeof auth;
  bonds: typeof bonds;
  bookmarks: typeof bookmarks;
  creators: typeof creators;
  creators_feed: typeof creators_feed;
  crons: typeof crons;
  earlyFeed: typeof earlyFeed;
  feed: typeof feed;
  "feedPages/contentiousNews": typeof feedPages_contentiousNews;
  "feedPages/replyRadar": typeof feedPages_replyRadar;
  "feedPages/xTrends": typeof feedPages_xTrends;
  graph: typeof graph;
  graphLayout: typeof graphLayout;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/getxapi": typeof lib_getxapi;
  "lib/xfeed": typeof lib_xfeed;
  network: typeof network;
  now: typeof now;
  posts: typeof posts;
  projects: typeof projects;
  readings: typeof readings;
  resources: typeof resources;
  seed: typeof seed;
  stats: typeof stats;
  users: typeof users;
  versions: typeof versions;
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
