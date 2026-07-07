"use client";

import { useState, useMemo, useRef, type ReactElement } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { motion, useReducedMotion } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { QuadraticBezierLine } from "@react-three/drei";
import {
  MathUtils,
  CanvasTexture,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
} from "three";

const NODE_COLORS: Record<string, string> = {
  post: "#1B3A5C",
  reading: "#4A7B6F",
  bookmark: "#8B6B4A",
};

// World-space sphere radii by node type
const NODE_RADII: Record<string, number> = {
  post: 0.14,
  reading: 0.12,
  bookmark: 0.1,
};

// World extents the normalized layout maps into. Shallow z band so depth
// reads as parallax without pulling linked nodes visually apart.
const WORLD_X = 9;
const WORLD_Y = 3.6;
const WORLD_Z = 2.6;

const BG_CREAM = "#FAFAF8";
const EDGE_BASE_COLOR = "#8A8A84";

interface GraphNodeData {
  id: string;
  type: "post" | "reading" | "bookmark";
  title: string;
  slug: string;
  href: string;
  score: number;
  position: [number, number, number];
}

interface GraphEdgeData {
  source: string;
  target: string;
  type: "wikilink" | "tag";
}

function hash01(slug: string): number {
  const h = slug
    .split("")
    .reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  return Math.abs(h % 1000) / 1000;
}

export default function HeroGraph3D(): ReactElement {
  const graphData = useQuery(api.graph.nodes);
  const layoutData = useQuery(api.graph.layout);
  const router = useRouter();
  const reducedMotion = useReducedMotion() ?? false;
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [tappedNode, setTappedNode] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const { nodes, edges } = useMemo(() => {
    if (!graphData || !layoutData)
      return { nodes: [] as GraphNodeData[], edges: [] as GraphEdgeData[] };

    const maxNodes = isMobile ? 10 : 20;
    const posMap = new Map(layoutData.nodes.map((n) => [n.slug, { x: n.x, y: n.y }]));

    // Score-sorted, take top N (featured always included)
    const sorted = [...graphData.nodes].sort((a, b) => b.score - a.score);

    const featured = sorted.filter((n) => n.featured);
    const rest = sorted.filter((n) => !n.featured);
    const selected = [...featured, ...rest].slice(0, maxNodes);
    const selectedSlugs = new Set(selected.map((n) => n.slug));

    // Fallback position for nodes not in layout: place near a connected node or use deterministic hash
    const fallbackPos = (slug: string): { x: number; y: number } => {
      const connected = graphData.edges
        .filter((e) => e.source === slug || e.target === slug)
        .map((e) => (e.source === slug ? e.target : e.source))
        .find((s) => posMap.has(s));
      if (connected) {
        const base = posMap.get(connected);
        if (base) {
          const hash = slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
          const angle = (hash % 360) * (Math.PI / 180);
          return {
            x: Math.max(0.05, Math.min(0.95, base.x + Math.cos(angle) * 0.08)),
            y: Math.max(0.05, Math.min(0.95, base.y + Math.sin(angle) * 0.08)),
          };
        }
      }
      const hash = slug
        .split("")
        .reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
      return {
        x: 0.15 + (Math.abs(hash % 700) / 1000) * 0.7,
        y: 0.15 + (Math.abs((hash >> 8) % 700) / 1000) * 0.7,
      };
    };

    const nodes: GraphNodeData[] = selected.map((n) => {
      const pos = posMap.get(n.slug) ?? fallbackPos(n.slug);
      return {
        id: n.slug,
        type: n.type,
        title: n.title,
        slug: n.slug,
        href: n.href,
        score: n.score,
        position: [
          (pos.x - 0.5) * WORLD_X,
          // Flip y: SVG-space layout is y-down, three.js is y-up
          -(pos.y - 0.5) * WORLD_Y,
          hash01(n.slug) * WORLD_Z - WORLD_Z / 2,
        ],
      };
    });

    const edges: GraphEdgeData[] = graphData.edges.filter(
      (e) => selectedSlugs.has(e.source) && selectedSlugs.has(e.target)
    );

    return { nodes, edges };
  }, [graphData, layoutData, isMobile]);

  if (!graphData || !layoutData || nodes.length === 0) {
    return <GraphFallback />;
  }

  // Nodes connected to the hovered node (including itself)
  const connectedNodes = new Set<string>();
  if (hoveredNode) {
    connectedNodes.add(hoveredNode);
    for (const e of edges) {
      if (e.source === hoveredNode || e.target === hoveredNode) {
        connectedNodes.add(e.source);
        connectedNodes.add(e.target);
      }
    }
  }

  const handleNodeClick = (node: GraphNodeData): void => {
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

  const handleHover = (id: string | null): void => {
    // On mobile, selection is tap-driven (handleNodeClick); pointer events
    // would clear it the moment the touch ends
    if (isMobile) return;
    setHoveredNode(id);
    document.body.style.cursor = id ? "pointer" : "";
  };

  // Most recent node gets a pulse
  const mostRecent = nodes[0]?.id;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const hoveredData = hoveredNode ? nodeMap.get(hoveredNode) : null;

  return (
    <div
      className="w-full relative h-[180px] md:h-[260px]"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 7.5], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <Scene
          nodes={nodes}
          edges={edges}
          hoveredNode={hoveredNode}
          connectedNodes={connectedNodes}
          mostRecent={mostRecent}
          reducedMotion={reducedMotion}
          onHover={handleHover}
          onNodeClick={handleNodeClick}
        />
      </Canvas>

      {/* Tooltip — HTML overlay near cursor (centered above graph on mobile, where there's no cursor) */}
      {hoveredData && (isMobile || mousePos) && (
        <motion.div
          className="absolute pointer-events-none px-2.5 py-1 rounded bg-[var(--color-text)] text-[var(--color-bg)] text-xs font-medium whitespace-nowrap z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.1 }}
          style={
            isMobile
              ? { left: "50%", top: 4, transform: "translateX(-50%)" }
              : { left: (mousePos?.x ?? 0) + 12, top: (mousePos?.y ?? 0) - 8 }
          }
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

interface SceneProps {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  hoveredNode: string | null;
  connectedNodes: Set<string>;
  mostRecent: string | undefined;
  reducedMotion: boolean;
  onHover: (id: string | null) => void;
  onNodeClick: (node: GraphNodeData) => void;
}

function Scene({
  nodes,
  edges,
  hoveredNode,
  connectedNodes,
  mostRecent,
  reducedMotion,
  onHover,
  onNodeClick,
}: SceneProps): ReactElement {
  const groupRef = useRef<Group>(null);

  const glowTexture = useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,0.8)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.25)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new CanvasTexture(canvas);
  }, []);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    if (reducedMotion) {
      g.scale.setScalar(1);
      return;
    }
    const t = state.clock.elapsedTime;
    // Gentle sway (the layout is a wide, shallow slab — full rotation would
    // turn it edge-on) plus mouse parallax
    const targetY = Math.sin(t * 0.15) * 0.1 + state.pointer.x * 0.12;
    const targetX = -state.pointer.y * 0.08;
    const damp = Math.min(1, delta * 2);
    g.rotation.y = MathUtils.lerp(g.rotation.y, targetY, damp);
    g.rotation.x = MathUtils.lerp(g.rotation.x, targetX, damp);
    // Entrance scale
    g.scale.setScalar(MathUtils.lerp(g.scale.x, 1, Math.min(1, delta * 3)));
  });

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <>
      <fog attach="fog" args={[BG_CREAM, 6, 12]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 4, 5]} intensity={0.6} />

      <group ref={groupRef} scale={reducedMotion ? 1 : 0.85}>
        {edges.map((edge) => {
          const s = nodeMap.get(edge.source);
          const t = nodeMap.get(edge.target);
          if (!s || !t) return null;
          return (
            <Edge
              key={`${edge.source}|${edge.target}`}
              start={s.position}
              end={t.position}
              type={edge.type}
              active={
                hoveredNode === edge.source || hoveredNode === edge.target
              }
              dimmed={hoveredNode !== null}
            />
          );
        })}

        {nodes.map((node, i) => (
          <Node
            key={node.id}
            node={node}
            index={i}
            hovered={hoveredNode === node.id}
            dimmed={hoveredNode !== null && !connectedNodes.has(node.id)}
            isMostRecent={node.id === mostRecent}
            reducedMotion={reducedMotion}
            glowTexture={glowTexture}
            onHover={onHover}
            onClick={onNodeClick}
          />
        ))}
      </group>
    </>
  );
}

interface EdgeProps {
  start: [number, number, number];
  end: [number, number, number];
  type: "wikilink" | "tag";
  active: boolean;
  dimmed: boolean;
}

function Edge({ start, end, type, active, dimmed }: EdgeProps): ReactElement {
  const mid = useMemo((): [number, number, number] => {
    const [sx, sy, sz] = start;
    const [tx, ty, tz] = end;
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy + 0.01);
    const curveAmt = dist * 0.12;
    return [
      mx - (dy / dist) * curveAmt,
      my + (dx / dist) * curveAmt,
      (sz + tz) / 2 + 0.15,
    ];
  }, [start, end]);

  const baseOpacity = type === "wikilink" ? 0.25 : 0.12;
  const opacity = active
    ? 0.6
    : dimmed
      ? baseOpacity * 0.3
      : baseOpacity;

  return (
    <QuadraticBezierLine
      start={start}
      end={end}
      mid={mid}
      color={active ? NODE_COLORS.post : EDGE_BASE_COLOR}
      lineWidth={active ? 1.5 : 1}
      transparent
      opacity={opacity}
    />
  );
}

interface NodeProps {
  node: GraphNodeData;
  index: number;
  hovered: boolean;
  dimmed: boolean;
  isMostRecent: boolean;
  reducedMotion: boolean;
  glowTexture: CanvasTexture | null;
  onHover: (id: string | null) => void;
  onClick: (node: GraphNodeData) => void;
}

function Node({
  node,
  index,
  hovered,
  dimmed,
  isMostRecent,
  reducedMotion,
  glowTexture,
  onHover,
  onClick,
}: NodeProps): ReactElement {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const pulseRef = useRef<Mesh>(null);
  const scaleRef = useRef(reducedMotion ? 1 : 0);
  const r = NODE_RADII[node.type];
  const color = NODE_COLORS[node.type];
  const bobPhase = index * 1.7;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const target = hovered ? 1.4 : 1;

    if (reducedMotion) {
      scaleRef.current = target;
    } else {
      // Staggered entrance, then spring-ish lerp toward hover target
      const appear = Math.min(1, Math.max(0, (t - index * 0.03) / 0.4));
      scaleRef.current = MathUtils.lerp(
        scaleRef.current,
        target * appear,
        Math.min(1, delta * 10)
      );
    }
    if (meshRef.current) {
      meshRef.current.scale.setScalar(r * Math.max(scaleRef.current, 0.001));
    }

    // Subtle float
    if (groupRef.current) {
      groupRef.current.position.y =
        node.position[1] +
        (reducedMotion ? 0 : Math.sin(t * 0.8 + bobPhase) * 0.05);
    }

    // Pulse ring on the most recent node
    if (pulseRef.current) {
      const show = isMostRecent && !hovered && !reducedMotion;
      pulseRef.current.visible = show;
      if (show) {
        const p = (t % 2.5) / 2.5;
        pulseRef.current.scale.setScalar(r * (1 + p * 1.5));
        (pulseRef.current.material as MeshBasicMaterial).opacity =
          0.35 * (1 - p);
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={node.position}
    >
      {/* Soft glow halo */}
      {glowTexture && (
        <sprite scale={r * 6}>
          <spriteMaterial
            map={glowTexture}
            color={color}
            transparent
            opacity={dimmed ? 0.08 : hovered ? 0.5 : 0.25}
            depthWrite={false}
          />
        </sprite>
      )}

      {/* Visible sphere */}
      <mesh ref={meshRef} scale={0.001}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.15}
          roughness={0.35}
          transparent
          opacity={dimmed ? 0.2 : 0.9}
        />
      </mesh>

      {/* Pulse ring for most recent */}
      {isMostRecent && (
        <mesh ref={pulseRef} visible={false}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* Invisible raycast target — generous hit area */}
      <mesh
        scale={Math.max(r * 2.5, 0.3)}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(node.id);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onHover(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(node);
        }}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function GraphFallback(): ReactElement {
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
