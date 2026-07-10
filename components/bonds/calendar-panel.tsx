"use client";

import { useState, useEffect } from "react";
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
  if (days < 0) return <span className="text-[#5C5C5C] text-[10px]">PAST</span>;

  const color =
    days <= 1 ? "#FF4B4B" : days <= 3 ? "#FFA028" : days <= 7 ? "#62B0FF" : "#D89540";

  return (
    <span className="font-mono text-[11px] tabular-nums font-bold" style={{ color }}>
      {days === 0 ? "TODAY" : `${days}D`}
    </span>
  );
}

const EVENT_COLORS: Record<string, string> = {
  FOMC: "#FF4B4B",
  CPI: "#FFA028",
  NFP: "#62B0FF",
  GDP: "#00D964",
  "Retail Sales": "#62B0FF",
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
      <Panel title="Economic Calendar">
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
    <Panel title="Econ Calendar" note="Upcoming releases that tend to move rates (CPI, jobs, FOMC). Volatility usually clusters around these dates." subtitle="30d">
      <table className="w-full font-mono text-[11px]">
        <thead>
          <tr className="text-left text-[#D89540] border-b border-[#2E2E2E]">
            <th className="py-0.5 font-normal">DATE</th>
            <th className="py-0.5 font-normal">EVENT</th>
            <th className="py-0.5 font-normal text-right">IN</th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 10).map((evt, i) => {
            const eventKey = Object.keys(EVENT_COLORS).find((k) =>
              evt.event?.includes(k)
            );
            const color = eventKey ? EVENT_COLORS[eventKey] : "#E6E6E6";
            const isPast = new Date(evt.date).getTime() < Date.now();

            return (
              <tr key={i} className={`border-b border-[#141414] ${isPast ? "opacity-40" : ""}`}>
                <td className="py-[3px] text-[#8F8F8F] whitespace-nowrap pr-3">
                  {new Date(evt.date)
                    .toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })
                    .toUpperCase()}
                </td>
                <td className="py-[3px] truncate max-w-0 w-full" style={{ color }}>
                  {evt.event}
                </td>
                <td className="py-[3px] text-right">
                  <Countdown targetDate={evt.date} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}
