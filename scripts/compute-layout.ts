/**
 * Compute deterministic graph layout using d3-force and store in Convex.
 *
 * Usage:
 *   npx tsx scripts/compute-layout.ts [--prod]
 *
 * Fetches graph data from Convex, runs d3-force simulation with seeded RNG,
 * normalizes positions to [0,1], and stores the result.
 */
import { config } from "dotenv";
import { createHash } from "crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import seedrandom from "seedrandom";

config({ path: ".env.local" });

const IS_PROD = process.argv.includes("--prod");
const CONVEX_URL = IS_PROD
  ? process.env.CONVEX_URL_PROD
  : (process.env.CONVEX_URL_DEV ?? process.env.NEXT_PUBLIC_CONVEX_URL);
if (!CONVEX_URL) {
  console.error(`Missing ${IS_PROD ? "CONVEX_URL_PROD" : "CONVEX_URL_DEV"} in .env.local`);
  process.exit(1);
}

const SYNC_SECRET = process.env.SYNC_SECRET;
if (!SYNC_SECRET) {
  console.error("Missing SYNC_SECRET");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

interface GraphNode extends SimulationNodeDatum {
  id: string;
  slug: string;
  type: "post" | "reading" | "bookmark";
}

interface GraphEdge extends SimulationLinkDatum<GraphNode> {
  source: string;
  target: string;
}

async function main() {
  console.log("Fetching graph data...");
  const data = await client.query(api.graph.nodes, {});

  if (data.nodes.length === 0) {
    console.log("No nodes to layout.");
    return;
  }

  // Check if layout already exists for this node+edge set
  const slugs = data.nodes.map((n) => n.slug).sort();
  const edgeKeys = data.edges.map((e) => `${e.source}→${e.target}`).sort();
  const layoutHash = createHash("sha256")
    .update(slugs.join("|") + "||" + edgeKeys.join("|"))
    .digest("hex")
    .slice(0, 32);

  const existingLayout = await client.query(api.graph.layout, {});
  if (existingLayout && existingLayout.layoutHash === layoutHash) {
    console.log("Layout is up to date (slug set unchanged). Skipping.");
    return;
  }

  console.log(`Computing layout for ${data.nodes.length} nodes, ${data.edges.length} edges...`);

  // Create seeded RNG for deterministic initial positions
  const rng = seedrandom("lnkd-graph-layout-v1");

  // Build simulation nodes with seeded random initial positions
  const simNodes: GraphNode[] = data.nodes.map((n) => ({
    id: n.slug,
    slug: n.slug,
    type: n.type,
    x: (rng() - 0.5) * 150,
    y: (rng() - 0.5) * 150,
  }));

  const nodeById = new Map(simNodes.map((n) => [n.id, n]));

  // Build simulation edges (only for edges where both nodes exist)
  const simEdges: GraphEdge[] = data.edges.filter(
    (e) => nodeById.has(e.source) && nodeById.has(e.target)
  );

  // Run force simulation
  const sim = forceSimulation<GraphNode>(simNodes)
    .force(
      "link",
      forceLink<GraphNode, GraphEdge>(simEdges)
        .id((d) => d.id)
        .distance(60)
    )
    .force("charge", forceManyBody().strength(-40))
    .force("center", forceCenter(0, 0).strength(0.15))
    .force("collide", forceCollide<GraphNode>().radius(15))
    .stop();

  // Run synchronously for 300 ticks
  for (let i = 0; i < 300; i++) {
    sim.tick();
  }

  // Normalize positions to [0, 1]
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of simNodes) {
    minX = Math.min(minX, n.x!);
    maxX = Math.max(maxX, n.x!);
    minY = Math.min(minY, n.y!);
    maxY = Math.max(maxY, n.y!);
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const padding = 0.05; // 5% padding on each side

  const layoutNodes = simNodes.map((n) => ({
    slug: n.slug,
    x: padding + ((n.x! - minX) / rangeX) * (1 - 2 * padding),
    y: padding + ((n.y! - minY) / rangeY) * (1 - 2 * padding),
  }));

  // Store in Convex
  console.log("Storing layout...");
  await client.mutation(api.graphLayout.store, {
    secret: SYNC_SECRET!,
    layoutHash,
    nodes: layoutNodes,
    createdAt: new Date().toISOString(),
  });

  console.log(`Layout stored (hash: ${layoutHash.slice(0, 8)}..., ${layoutNodes.length} nodes)`);
}

main();
