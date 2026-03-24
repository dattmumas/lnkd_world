/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as bookmarks from "../bookmarks.js";
import type * as graph from "../graph.js";
import type * as graphLayout from "../graphLayout.js";
import type * as http from "../http.js";
import type * as now from "../now.js";
import type * as posts from "../posts.js";
import type * as projects from "../projects.js";
import type * as readings from "../readings.js";
import type * as resources from "../resources.js";
import type * as seed from "../seed.js";
import type * as stats from "../stats.js";
import type * as users from "../users.js";
import type * as versions from "../versions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bookmarks: typeof bookmarks;
  graph: typeof graph;
  graphLayout: typeof graphLayout;
  http: typeof http;
  now: typeof now;
  posts: typeof posts;
  projects: typeof projects;
  readings: typeof readings;
  resources: typeof resources;
  seed: typeof seed;
  stats: typeof stats;
  users: typeof users;
  versions: typeof versions;
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
