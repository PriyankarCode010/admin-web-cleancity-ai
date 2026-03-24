import { dbg } from "../lib/debugLog";

type DayPoint = { label: string; count: number };
type BarPoint = { zone: string; score: number };

/**
 * Server-rendered charts (no extra deps). SVG uses viewBox coordinates 0–100.
 */
export function DashboardCharts({
  dayCounts,
  bars,
}: {
  dayCounts: DayPoint[];
  bars: BarPoint[];
}) {
  dbg("DashboardCharts", "render", {
    dayPoints: dayCounts.length,
    barPoints: bars.length,
    dayTotals: dayCounts.map((d) => d.count),
    barScores: bars.map((b) => b.score),
  });

  const maxLine = Math.max(1, ...dayCounts.map((d) => d.count));
  const nSeg = Math.max(1, dayCounts.length - 1);

  const linePointPairs = dayCounts.map((d, i) => {
    const x = (i / nSeg) * 100;
    const y = 82 - (d.count / maxLine) * 68;
    return `${x},${y}`;
  });
  const linePoints = linePointPairs.join(" ");
  const areaPoints = `0,92 ${linePointPairs.join(" ")} 100,92`;

  const maxBar = Math.max(1, ...bars.map((b) => b.score));

  return (
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900">Reports over time</h2>
          <span className="text-xs text-slate-500">Last 7 days (UTC)</span>
        </div>

        <div className="h-56 w-full">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-full w-full block"
            role="img"
            aria-label="Line chart of reports per day"
          >
            <defs>
              <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[92, 70, 48, 26].map((y) => (
              <line
                key={y}
                x1="0"
                x2="100"
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="0.4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <polygon fill="url(#lineFill)" points={areaPoints} />
            <polyline
              fill="none"
              stroke="#4F46E5"
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
              points={linePoints}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {linePointPairs.map((pair, i) => {
              const [x, y] = pair.split(",").map(Number);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={1.8}
                  fill="white"
                  stroke="#4F46E5"
                  strokeWidth="0.8"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
        </div>
        <div className="flex justify-between gap-1 mt-2 px-0.5">
          {dayCounts.map((d) => (
            <div key={d.label} className="flex-1 text-center min-w-0">
              <p className="text-[10px] sm:text-xs text-slate-500 truncate">{d.label}</p>
              <p className="text-xs font-semibold text-slate-800 tabular-nums">{d.count}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900">Severity mix</h2>
          <span className="text-xs text-slate-500">Last 30 days</span>
        </div>

        <div className="h-56 flex items-end gap-3 sm:gap-4 pt-2">
          {bars.map((b) => {
            const color =
              b.zone === "high"
                ? "bg-red-600"
                : b.zone === "medium"
                  ? "bg-amber-500"
                  : "bg-indigo-600";
            const pct = maxBar > 0 ? Math.max((b.score / maxBar) * 100, b.score > 0 ? 8 : 4) : 4;
            return (
              <div key={b.zone} className="flex-1 flex flex-col items-center gap-2 min-w-0 h-full justify-end">
                <div className="w-full flex-1 min-h-[120px] max-h-[180px] rounded-lg bg-slate-100 flex flex-col justify-end overflow-hidden">
                  <div
                    className={`w-full rounded-t-md ${color} transition-all min-h-[6px]`}
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-600 capitalize truncate w-full text-center">
                  {b.zone}
                </p>
                <p className="text-xs font-semibold text-slate-800 tabular-nums">{b.score}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
