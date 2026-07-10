"use client";

import { useRef, type JSX, type KeyboardEvent } from "react";

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
 * Bloomberg-style numbered function menu: `1) MACRO 2) CURVE …`, amber items
 * on black, the active function filled amber with black text. Parent owns the
 * active id (and any URL sync). Keyboard: Arrow keys + Home/End.
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
      className="flex gap-0.5 overflow-x-auto border border-[#2E2E2E] bg-[#000000] p-0.5"
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
            className={`shrink-0 px-3 py-1 font-mono text-[12px] font-bold uppercase tracking-[0.08em] ${
              isActive
                ? "bg-[#FFA028] text-[#000000]"
                : "text-[#FFA028] hover:text-[#FFC46B]"
            }`}
          >
            {i + 1}
            {")"}&nbsp;{tab.label}
          </button>
        );
      })}
    </div>
  );
}
