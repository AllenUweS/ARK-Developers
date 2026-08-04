import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { CheckCircle2, Tag, Layers } from "lucide-react";

interface PlotData {
  status: string;
  project?: { name: string };
  price?: number;
}

interface SalesChartProps {
  plots: PlotData[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dotClass: string }> = {
  sold: { label: "Sold", color: "#10b981", dotClass: "bg-emerald-500" },
  booked: { label: "Booked", color: "#f59e0b", dotClass: "bg-amber-500" },
  reserved: { label: "Reserved", color: "#8b5cf6", dotClass: "bg-violet-500" },
  available: { label: "Available", color: "#0ea5e9", dotClass: "bg-sky-500" },
  pending: { label: "Pending", color: "#6366f1", dotClass: "bg-indigo-500" },
  cancelled: { label: "Cancelled", color: "#f43f5e", dotClass: "bg-rose-500" },
};

export function SalesChart({ plots }: SalesChartProps) {
  const [activeItem, setActiveItem] = useState<{
    name: string;
    statusKey: string;
    value: number;
    percentage: number;
    color: string;
  } | null>(null);

  const chartData = useMemo(() => {
    if (!plots || plots.length === 0) return [];

    const counts: Record<string, number> = {};
    plots.forEach((p) => {
      const st = p.status || "available";
      counts[st] = (counts[st] || 0) + 1;
    });

    const total = plots.length || 1;
    return Object.entries(counts).map(([status, count]) => {
      const cfg = STATUS_CONFIG[status] || { label: status, color: "#6b7280", dotClass: "bg-gray-500" };
      return {
        name: cfg.label,
        statusKey: status,
        value: count,
        percentage: Math.round((count / total) * 100 * 10) / 10,
        color: cfg.color,
      };
    });
  }, [plots]);

  const totalPlots = plots?.length || 0;
  const soldPlots = plots?.filter((p) => p.status === "sold").length || 0;
  const selloutRate = totalPlots > 0 ? Math.round((soldPlots / totalPlots) * 100) : 0;

  return (
    <div className="rounded-2xl border border-border/70 bg-card/75 backdrop-blur-xl p-6 shadow-xs flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-bold tracking-tight text-foreground">Plot Status Distribution</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inventory breakdown across selected projects
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{selloutRate}% Sold</span>
        </div>
      </div>

      {totalPlots === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
          <Layers className="size-8 opacity-40" />
          <p className="text-sm font-medium">No plot inventory recorded for this selection.</p>
        </div>
      ) : (
        <>
          {/* Stacked Progress Visualizer Bar */}
          <div className="w-full h-3 rounded-full overflow-hidden flex bg-muted/40 border border-border/50 my-2">
            {chartData.map((item) => (
              <div
                key={item.statusKey}
                style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                className="h-full transition-all duration-500 hover:opacity-80 cursor-pointer"
                onMouseEnter={() => setActiveItem(item)}
                onMouseLeave={() => setActiveItem(null)}
                title={`${item.name}: ${item.value} (${item.percentage}%)`}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center my-3">
            {/* Donut Chart with Dynamic Center Telemetry */}
            <div className="h-56 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    innerRadius={58}
                    outerRadius={82}
                    paddingAngle={4}
                    dataKey="value"
                    onMouseLeave={() => setActiveItem(null)}
                  >
                    {chartData.map((entry, index) => {
                      const isHovered = activeItem?.statusKey === entry.statusKey;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke={isHovered ? "currentColor" : "transparent"}
                          strokeWidth={isHovered ? 2 : 0}
                          className="cursor-pointer transition-all duration-200"
                          style={{
                            transform: isHovered ? "scale(1.04)" : "scale(1)",
                            transformOrigin: "center center",
                            filter: isHovered ? "drop-shadow(0px 4px 10px rgba(0,0,0,0.15))" : "none",
                          }}
                          onMouseEnter={() => setActiveItem(entry)}
                        />
                      );
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Dynamic Center Text Reader (Replaces overlapping floating tooltip box) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2 transition-all duration-300">
                {activeItem ? (
                  <div className="animate-in fade-in zoom-in-95 duration-200 space-y-0.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: activeItem.color }}>
                      {activeItem.name}
                    </p>
                    <p className="text-2xl font-black text-foreground font-mono leading-none">
                      {activeItem.value} <span className="text-xs font-normal text-muted-foreground">Plots</span>
                    </p>
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {activeItem.percentage}% of total
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <span className="text-3xl font-black tracking-tight text-foreground font-mono leading-none">{totalPlots}</span>
                    <span className="block text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                      Total Plots
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Status Legend Grid */}
            <div className="space-y-2 text-xs">
              {chartData.map((item) => {
                const cfg = STATUS_CONFIG[item.statusKey];
                const isSelected = activeItem?.statusKey === item.statusKey;
                return (
                  <div
                    key={item.statusKey}
                    onMouseEnter={() => setActiveItem(item)}
                    onMouseLeave={() => setActiveItem(null)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-xs scale-[1.02]"
                        : "border-border/40 bg-muted/20 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg?.dotClass ?? "bg-gray-400"}`} />
                      <span className="font-semibold text-foreground">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-foreground">{item.value}</span>
                      <span className="text-[11px] text-muted-foreground">({item.percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>Sold: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{soldPlots}</strong></span>
            <span>Available: <strong className="text-sky-600 dark:text-sky-400 font-bold">{plots.filter((p) => p.status === "available").length}</strong></span>
            <span>Reserved: <strong className="text-violet-600 dark:text-violet-400 font-bold">{plots.filter((p) => p.status === "reserved").length}</strong></span>
          </div>
        </>
      )}
    </div>
  );
}
