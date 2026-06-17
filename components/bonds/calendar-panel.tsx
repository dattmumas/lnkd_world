"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Panel from "./panel";

function Countdown({ targetDate }: { targetDate: string }) {
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(targetDate).getTime();
    const now = Date.now();
    const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    setDays(diff);
  }, [targetDate]);

  if (days === null) return null;
  if (days < 0) return <span className="text-[#6e7682] text-xs">PAST</span>;

  const color =
    days <= 1 ? "#d23b3b" : days <= 3 ? "#a86e15" : days <= 7 ? "#2563eb" : "#6e7682";

  return (
    <span className="font-mono text-sm tabular-nums font-medium" style={{ color }}>
      {days === 0 ? "TODAY" : days === 1 ? "1D" : `${days}D`}
    </span>
  );
}

const EVENT_ICONS: Record<string, string> = {
  FOMC: "\u2691",
  CPI: "\u25CF",
  NFP: "\u25A0",
  GDP: "\u25B2",
  "Retail Sales": "\u25C6",
  PMI: "\u25CB",
  "Consumer Sentiment": "\u2605",
};

const EVENT_COLORS: Record<string, string> = {
  FOMC: "#d23b3b",
  CPI: "#a86e15",
  NFP: "#2563eb",
  GDP: "#0a8f57",
  "Retail Sales": "#0e9384",
  PMI: "#e3700f",
  "Consumer Sentiment": "#d6307e",
};

export default function CalendarPanel({
  calendar,
}: {
  calendar?: {
    events: {
      event: string;
      date: string;
      impact?: string;
      actual?: number;
      estimate?: number;
    }[];
    as_of: string;
  };
}) {
  if (!calendar?.events || calendar.events.length === 0) {
    return (
      <Panel title="Economic Calendar" accent="#d6307e">
        <div className="text-[#6e7682] font-mono text-sm text-center py-8">
          No upcoming events
        </div>
      </Panel>
    );
  }

  // Sort by date, future first
  const sorted = [...calendar.events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <Panel title="Econ Calendar" note="Upcoming releases that tend to move rates (CPI, jobs, FOMC). Volatility usually clusters around these dates." subtitle="30d" accent="#d6307e">
      <div className="space-y-1.5">
        {sorted.slice(0, 10).map((evt, i) => {
          const eventKey = Object.keys(EVENT_COLORS).find((k) =>
            evt.event?.includes(k)
          );
          const color = eventKey ? EVENT_COLORS[eventKey] : "#6e7682";
          const icon = eventKey ? EVENT_ICONS[eventKey] : "\u25CB";
          const isPast = new Date(evt.date).getTime() < Date.now();

          return (
            <motion.div
              key={i}
              className={`flex items-center gap-3 bg-[#f6f7f9] rounded px-4 py-2.5 ${
                isPast ? "opacity-50" : ""
              }`}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: isPast ? 0.5 : 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <span className="text-base" style={{ color }}>
                {icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm text-[#1f2937] truncate">
                  {evt.event}
                </div>
                <div className="font-mono text-xs text-[#6e7682]">
                  {new Date(evt.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
              <Countdown targetDate={evt.date} />
            </motion.div>
          );
        })}
      </div>
    </Panel>
  );
}
