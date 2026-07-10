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
  if (days < 0) return <span className="text-[#D89540] text-xs">PAST</span>;

  const color =
    days <= 1 ? "#FF4B4B" : days <= 3 ? "#FFA028" : days <= 7 ? "#62B0FF" : "#D89540";

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
  FOMC: "#FF4B4B",
  CPI: "#FFA028",
  NFP: "#62B0FF",
  GDP: "#00D964",
  "Retail Sales": "#00C8FF",
  PMI: "#FFA028",
  "Consumer Sentiment": "#FF3EB5",
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
      <Panel title="Economic Calendar" accent="#FF3EB5">
        <div className="text-[#D89540] font-mono text-sm text-center py-8">
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
    <Panel title="Econ Calendar" note="Upcoming releases that tend to move rates (CPI, jobs, FOMC). Volatility usually clusters around these dates." subtitle="30d" accent="#FF3EB5">
      <div className="space-y-1.5">
        {sorted.slice(0, 10).map((evt, i) => {
          const eventKey = Object.keys(EVENT_COLORS).find((k) =>
            evt.event?.includes(k)
          );
          const color = eventKey ? EVENT_COLORS[eventKey] : "#D89540";
          const icon = eventKey ? EVENT_ICONS[eventKey] : "\u25CB";
          const isPast = new Date(evt.date).getTime() < Date.now();

          return (
            <motion.div
              key={i}
              className={`flex items-center gap-3 bg-[#141414] rounded px-4 py-2.5 ${
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
                <div className="font-mono text-sm text-[#E6E6E6] truncate">
                  {evt.event}
                </div>
                <div className="font-mono text-xs text-[#D89540]">
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
