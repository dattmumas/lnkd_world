"use client";

import { useMemo } from "react";

interface ActivityDate {
  date: string;
  type: "post" | "reading" | "bookmark";
  words: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["", "Mon", "", "Wed", "", "Fri", ""];

function getIntensity(words: number): string {
  if (words === 0) return "var(--color-border)";
  if (words < 100) return "rgba(27, 58, 92, 0.20)";
  if (words < 300) return "rgba(27, 58, 92, 0.40)";
  if (words < 600) return "rgba(27, 58, 92, 0.60)";
  if (words < 1000) return "rgba(27, 58, 92, 0.80)";
  return "rgba(27, 58, 92, 1)";
}

export default function ActivityHeatmap({ dates }: { dates: ActivityDate[] }) {
  const { weeks, monthLabels, totalWords } = useMemo(() => {
    const today = new Date();
    // Show ~22 weeks (5 months) to fit sidebar width
    const start = new Date(today);
    start.setDate(start.getDate() - 154 - start.getDay());

    // Build a word count map per day
    const wordMap = new Map<string, number>();
    let totalWords = 0;
    for (const d of dates) {
      wordMap.set(d.date, (wordMap.get(d.date) ?? 0) + d.words);
      totalWords += d.words;
    }

    const weeks: { date: Date; words: number }[][] = [];
    const monthLabels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    let currentWeek: { date: Date; words: number }[] = [];

    const cursor = new Date(start);
    while (cursor <= today) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const words = wordMap.get(dateStr) ?? 0;

      if (cursor.getDay() === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      if (cursor.getMonth() !== lastMonth) {
        monthLabels.push({ label: MONTHS[cursor.getMonth()], col: weeks.length });
        lastMonth = cursor.getMonth();
      }

      currentWeek.push({ date: new Date(cursor), words });
      cursor.setDate(cursor.getDate() + 1);
    }

    if (currentWeek.length > 0) weeks.push(currentWeek);

    return { weeks, monthLabels, totalWords };
  }, [dates]);

  const totalActivity = dates.length;
  const formattedWords = totalWords >= 1000
    ? `${(totalWords / 1000).toFixed(1)}k`
    : `${totalWords}`;
  const cellSize = 9;
  const cellGap = 2;
  const labelWidth = 24;
  const topPad = 14;
  const svgWidth = labelWidth + weeks.length * (cellSize + cellGap);
  const svgHeight = topPad + 7 * (cellSize + cellGap);

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Activity
        </h3>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {formattedWords} words
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg
          width={svgWidth}
          height={svgHeight}
          className="block"
          role="img"
          aria-label="Publishing activity heatmap"
        >
          {/* Month labels */}
          {monthLabels.map((m, i) => (
            <text
              key={i}
              x={labelWidth + m.col * (cellSize + cellGap)}
              y={9}
              className="fill-[var(--color-text-secondary)]"
              fontSize={8}
              fontFamily="var(--font-lora), Georgia, serif"
            >
              {m.label}
            </text>
          ))}

          {/* Day labels */}
          {DAYS.map((d, i) => (
            <text
              key={i}
              x={0}
              y={topPad + i * (cellSize + cellGap) + cellSize - 1}
              className="fill-[var(--color-text-secondary)]"
              fontSize={8}
              fontFamily="var(--font-lora), Georgia, serif"
            >
              {d}
            </text>
          ))}

          {/* Cells */}
          {weeks.map((week, wi) =>
            week.map((day, di) => (
              <rect
                key={`${wi}-${di}`}
                x={labelWidth + wi * (cellSize + cellGap)}
                y={topPad + day.date.getDay() * (cellSize + cellGap)}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={getIntensity(day.words)}
              >
                <title>
                  {day.date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  : {day.words.toLocaleString()} words
                </title>
              </rect>
            ))
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 mt-2 justify-end">
        <span className="text-[8px] text-[var(--color-text-secondary)]">Less</span>
        {[0, 1, 2, 3, 5].map((n) => (
          <div
            key={n}
            className="rounded-sm"
            style={{
              width: 8,
              height: 8,
              backgroundColor: getIntensity(n),
            }}
          />
        ))}
        <span className="text-[8px] text-[var(--color-text-secondary)]">More</span>
      </div>
    </div>
  );
}
