"use client";

import { useRef, type JSX, type KeyboardEvent } from "react";
import { motion } from "framer-motion";

export interface TabBarItem {
  id: string;
  label: string;
}

interface TabBarProps {
  tabs: readonly TabBarItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

/**
 * Controlled segmented control for the bonds dashboard. Parent owns the active
 * id (and any URL sync). Active tab is marked by a framer-motion pill that slides
 * between tabs via a shared layoutId. Keyboard: Arrow keys + Home/End.
 */
export default function TabBar({
  tabs,
  activeId,
  onSelect,
}: TabBarProps): JSX.Element {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKey = (e: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    onSelect(tabs[next].id);
    buttonRefs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Dashboard sections"
      className="flex gap-1 overflow-x-auto rounded-lg border border-[#e6e8ee] bg-[#fafbfc] p-1"
    >
      {tabs.map((tab, i) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              buttonRefs.current[i] = el;
            }}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(e) => handleKey(e, i)}
            className={`relative shrink-0 rounded-md px-3.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
              isActive ? "text-[#0a8f57]" : "text-[#6e7682] hover:text-[#1f2937]"
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="bonds-tab-pill"
                className="absolute inset-0 rounded-md border border-[#e6e8ee] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.08)]"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
