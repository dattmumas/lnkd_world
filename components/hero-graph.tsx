"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";

const NODE_COLORS: Record<string, string> = {
  post: "#1B3A5C",
  reading: "#4A7B6F",
  bookmark: "#8B6B4A",
};

const NODE_RADII: Record<string, number> = {
  post: 6,
  reading: 5,
  bookmark: 4,
};

const NODE_RADII_MOBILE: Record<string, number> = {
  post: 10,
  reading: 8,
  bookmark: 7,
};

interface GraphNodeData {
  id: string;
  type: "post" | "reading" | "bookmark";
  title: string;
  slug: string;
  href: string;
  score: number;
  x: number;
  y: number;
}

interface GraphEdgeData {
  source: string;
  target: string;
}

export default function HeroGraph() {
  const graphData = useQuery(api.graph.nodes);
  const layoutData = useQuery(api.graph.layout);
  const router = useRouter();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [tappedNode, setTappedNode] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const { nodes, edges, svgWidth, svgHeight } = useMemo(() => {
    if (!graphData || !layoutData) return { nodes: [], edges: [], svgWidth: 0, svgHeight: 0 };

    const maxNodes = isMobile ? 10 : 20;
    const posMap = new Map(layoutData.nodes.map((n) => [n.slug, { x: n.x, y: n.y }]));

    // Score-sorted, take top N (featured always included)
    const sorted = [...graphData.nodes]
      .filter((n) => posMap.has(n.slug))
      .sort((a, b) => b.score - a.score);

    const featured = sorted.filter((n) => n.featured);
    const rest = sorted.filter((n) => !n.featured);
    const selected = [...featured, ...rest].slice(0, maxNodes);
    const selectedSlugs = new Set(selected.map((n) => n.slug));

    const width = isMobile ? 350 : 700;
    const height = isMobile ? 200 : 350;
    const radii = isMobile ? NODE_RADII_MOBILE : NODE_RADII;

    const nodes: GraphNodeData[] = selected.map((n) => {
      const pos = posMap.get(n.slug)!;
      return {
        id: n.slug,
        type: n.type,
        title: n.title,
        slug: n.slug,
        href: n.href,
        score: n.score,
        x: pos.x * width,
        y: pos.y * height,
      };
    });

    const edges: GraphEdgeData[] = graphData.edges.filter(
      (e) => selectedSlugs.has(e.source) && selectedSlugs.has(e.target)
    );

    return { nodes, edges, svgWidth: width, svgHeight: height };
  }, [graphData, layoutData, isMobile]);

  if (!graphData || !layoutData || nodes.length === 0) {
    return <GraphFallback />;
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Edges connected to hovered node
  const activeEdges = hoveredNode
    ? edges.filter((e) => e.source === hoveredNode || e.target === hoveredNode)
    : [];
  const activeEdgeSet = new Set(activeEdges.map((e) => `${e.source}|${e.target}`));

  // Connected nodes
  const connectedNodes = new Set<string>();
  if (hoveredNode) {
    connectedNodes.add(hoveredNode);
    for (const e of activeEdges) {
      connectedNodes.add(e.source);
      connectedNodes.add(e.target);
    }
  }

  const handleNodeClick = (node: GraphNodeData) => {
    if (isMobile) {
      if (tappedNode === node.id) {
        router.push(node.href);
      } else {
        setTappedNode(node.id);
        setHoveredNode(node.id);
      }
    } else {
      router.push(node.href);
    }
  };

  // Most recent node gets a pulse
  const mostRecent = nodes[0]?.id;

  const hoveredData = hoveredNode ? nodeMap.get(hoveredNode) : null;

  return (
    <div
      className="w-full overflow-hidden relative"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
    >
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full"
        style={{ maxHeight: isMobile ? 200 : 350 }}
      >
        {/* Edges — only shown on hover */}
        <AnimatePresence>
          {activeEdges.map((edge) => {
            const s = nodeMap.get(edge.source);
            const t = nodeMap.get(edge.target);
            if (!s || !t) return null;

            // Curved bezier
            const mx = (s.x + t.x) / 2;
            const my = (s.y + t.y) / 2;
            const dx = t.x - s.x;
            const dy = t.y - s.y;
            const offset = Math.sqrt(dx * dx + dy * dy) * 0.15;
            const cx = mx - dy * offset / Math.sqrt(dx * dx + dy * dy + 1);
            const cy = my + dx * offset / Math.sqrt(dx * dx + dy * dy + 1);

            return (
              <motion.path
                key={`${edge.source}|${edge.target}`}
                d={`M ${s.x} ${s.y} Q ${cx} ${cy} ${t.x} ${t.y}`}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={1}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.3 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              />
            );
          })}
        </AnimatePresence>

        {/* Nodes */}
        {nodes.map((node, i) => {
          const r = (isMobile ? NODE_RADII_MOBILE : NODE_RADII)[node.type];
          const isHovered = hoveredNode === node.id;
          const isConnected = connectedNodes.has(node.id);
          const dimmed = hoveredNode && !isConnected;
          const hitR = Math.max(r * 2.5, 16); // generous hit area

          return (
            <g
              key={node.id}
              onMouseEnter={() => !isMobile && setHoveredNode(node.id)}
              onMouseLeave={() => !isMobile && setHoveredNode(null)}
              onClick={() => handleNodeClick(node)}
              className="cursor-pointer"
            >
              {/* Invisible hit area — stable, no animation */}
              <circle
                cx={node.x}
                cy={node.y}
                r={hitR}
                fill="transparent"
              />

              {/* Pulse ring for most recent */}
              {node.id === mostRecent && !isHovered && (
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r={r}
                  fill="none"
                  stroke={NODE_COLORS[node.type]}
                  strokeWidth={1}
                  animate={{
                    r: [r, r * 2.5],
                    opacity: [0.4, 0],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />
              )}

              {/* Visible node circle — radius animates on hover */}
              <motion.circle
                cx={node.x}
                cy={node.y}
                fill={NODE_COLORS[node.type]}
                initial={{ r: 0, opacity: 0 }}
                animate={{
                  r: isHovered ? r * 1.4 : r,
                  opacity: dimmed ? 0.2 : 0.85,
                }}
                transition={{
                  r: { type: "spring", stiffness: 400, damping: 25 },
                  opacity: { duration: 0.2 },
                  delay: i * 0.03,
                }}
              />

              {/* Tooltip rendered as HTML overlay below */}
            </g>
          );
        })}
      </svg>

      {/* Tooltip — HTML overlay near cursor */}
      {hoveredData && mousePos && (
        <motion.div
          className="absolute pointer-events-none px-2.5 py-1 rounded bg-[var(--color-text)] text-[var(--color-bg)] text-xs font-medium whitespace-nowrap z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.1 }}
          style={{
            left: mousePos.x + 12,
            top: mousePos.y - 8,
          }}
        >
          {hoveredData.title}
        </motion.div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-[var(--color-text-secondary)]">
        {[
          { type: "post", label: "Posts" },
          { type: "reading", label: "Readings" },
          { type: "bookmark", label: "Bookmarks" },
        ].map(({ type, label }) => (
          <div key={type} className="flex items-center gap-1.5">
            <div
              className="rounded-full"
              style={{
                width: 8,
                height: 8,
                backgroundColor: NODE_COLORS[type],
                opacity: 0.85,
              }}
            />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GraphFallback() {
  return (
    <div className="w-full flex items-center justify-center" style={{ height: 200 }}>
      <div className="flex gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-full bg-[var(--color-border)] animate-pulse"
            style={{
              width: 8 + i * 2,
              height: 8 + i * 2,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
