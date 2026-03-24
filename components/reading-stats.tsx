"use client";

interface ReadingStatsData {
  total: number;
  byType: Record<string, number>;
  byRating: Record<number, number>;
  avgRating: number;
  tags: Record<string, number>;
}

export default function ReadingStats({ stats }: { stats: ReadingStatsData }) {
  if (stats.total === 0) return null;

  const topTags = Object.entries(stats.tags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxRating = Math.max(...Object.values(stats.byRating), 1);

  return (
    <div className="space-y-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        Reading Stats
      </h3>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-xl font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
            {stats.total}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
            Total
          </div>
        </div>
        <div>
          <div className="text-xl font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
            {stats.avgRating > 0 ? `${stats.avgRating}` : "—"}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
            Avg ★
          </div>
        </div>
        <div>
          <div className="text-xl font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
            {stats.byType["book"] ?? 0}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
            Books
          </div>
        </div>
      </div>

      {/* Rating distribution */}
      {Object.keys(stats.byRating).length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
            Ratings
          </p>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = stats.byRating[rating] ?? 0;
              const width = maxRating > 0 ? (count / maxRating) * 100 : 0;
              return (
                <div key={rating} className="flex items-center gap-2">
                  <span className="text-[10px] w-6 text-right text-[var(--color-text-secondary)] shrink-0">
                    {rating}★
                  </span>
                  <div className="flex-1 h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${width}%`,
                        backgroundColor: "var(--color-accent)",
                        opacity: 0.4 + (rating / 5) * 0.6,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--color-text-secondary)] w-4">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* By type */}
      {Object.keys(stats.byType).length > 1 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
            By Type
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <span
                  key={type}
                  className="text-xs px-2 py-0.5 rounded bg-[var(--color-border)] text-[var(--color-text-secondary)]"
                >
                  {type} ({count})
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Top tags */}
      {topTags.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
            Top Topics
          </p>
          <div className="flex flex-wrap gap-1.5">
            {topTags.map(([tag, count]) => (
              <span
                key={tag}
                className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)]"
              >
                {tag}
                <span className="ml-1 opacity-50">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
