import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Building2, CheckCircle2, Clock, ShieldAlert, Sparkles, Tag } from "lucide-react";

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
  const chartData = useMemo(() => {
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

  const totalPlots = plots.length;
  const soldPlots = plots.filter((p) => p.status === "sold").length;
  const selloutRate = totalPlots > 0 ? Math.round((soldPlots / totalPlots) * 100) : 0;

  return (
    <div className="rounded-2xl border border-border/70 bg-card/75 backdrop-blur-xl p-6 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-terracotta" />
            <h3 className="text-lg font-bold tracking-tight text-foreground">Plot Status Distribution</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inventory composition across all projects
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{selloutRate}% Sold</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center my-2">
        {/* Donut Chart */}
        <div className="h-56 w-full relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                innerRadius={60}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-border/80 bg-card/95 backdrop-blur-md p-2.5 shadow-xl text-xs space-y-1">
                        <p className="font-bold capitalize" style={{ color: data.color }}>
                          {data.name}
                        </p>
                        <p className="text-foreground font-semibold">
                          {data.value} Plot{data.value !== 1 ? "s" : ""} ({data.percentage}%)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center text overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-black text-foreground">{totalPlots}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Plots
            </span>
          </div>
        </div>

        {/* Status Legend & Counts */}
        <div className="space-y-2.5 text-xs">
          {chartData.map((item) => {
            const cfg = STATUS_CONFIG[item.statusKey];
            return (
              <div
                key={item.statusKey}
                className="flex items-center justify-between p-2 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${cfg?.dotClass ?? "bg-gray-400"}`} />
                  <span className="font-medium text-foreground">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{item.value}</span>
                  <span className="text-[11px] text-muted-foreground font-medium">({item.percentage}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
        <span>Sold: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{soldPlots}</strong></span>
        <span>Available: <strong className="text-sky-600 dark:text-sky-400 font-bold">{plots.filter(p => p.status === 'available').length}</strong></span>
        <span>Reserved: <strong className="text-violet-600 dark:text-violet-400 font-bold">{plots.filter(p => p.status === 'reserved').length}</strong></span>
      </div>
    </div>
  );
}
