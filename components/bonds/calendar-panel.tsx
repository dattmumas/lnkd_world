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
  if (days < 0) return <span className="text-[#7C7C7C] text-[10px]">PAST</span>;

  const color =
    days <= 1 ? "#FF433D" : days <= 3 ? "#FB8B1E" : days <= 7 ? "#54A8FF" : "#FB8B1E";

  return (
    <span className="font-mono text-[11px] tabular-nums font-bold" style={{ color }}>
      {days === 0 ? "TODAY" : `${days}D`}
    </span>
  );
}

const EVENT_COLORS: Record<string, string> = {
  FOMC: "#FF433D",
  CPI: "#FB8B1E",
  NFP: "#FB8B1E",
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
        <div className="text-[#FB8B1E] font-mono text-sm text-center py-8">
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
          <tr className="text-left text-[#FB8B1E] border-b border-[#2E2E2E]">
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
            const color = (eventKey && EVENT_COLORS[eventKey]) || "#F6F3E8";
            const isPast = new Date(evt.date).getTime() < Date.now();

            return (
              <tr key={i} className={`border-b border-[#1C1C1C] ${isPast ? "opacity-40" : ""}`}>
                <td className="py-[3px] text-[#A5A095] whitespace-nowrap pr-3">
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
