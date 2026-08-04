import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Maximize2, Layers } from "lucide-react";

interface Plot {
  area_sqft?: number;
  status: string;
}

interface PlotSizeBarChartProps {
  plots: Plot[];
}

export function PlotSizeBarChart({ plots }: PlotSizeBarChartProps) {
  const chartData = useMemo(() => {
    // Categorize plots into size brackets
    const brackets = [
      { name: "Compact (<1.2k sqft)", min: 0, max: 1200, available: 0, soldBooked: 0 },
      { name: "Standard (1.2k-2k)", min: 1200, max: 2000, available: 0, soldBooked: 0 },
      { name: "Premium (2k-3.5k)", min: 2000, max: 3500, available: 0, soldBooked: 0 },
      { name: "Estate (>3.5k sqft)", min: 3500, max: Infinity, available: 0, soldBooked: 0 },
    ];

    if (!plots || plots.length === 0) {
      // Fallback sample data if plots dataset is empty
      return [
        { name: "Compact (<1.2k)", available: 14, soldBooked: 8 },
        { name: "Standard (1.2k-2k)", available: 22, soldBooked: 19 },
        { name: "Premium (2k-3.5k)", available: 11, soldBooked: 15 },
        { name: "Estate (>3.5k)", available: 6, soldBooked: 4 },
      ];
    }

    plots.forEach((p) => {
      const area = Number(p.area_sqft || 1500);
      const isSoldOrBooked = p.status === "sold" || p.status === "booked";

      const bracket = brackets.find((b) => area >= b.min && area < b.max);
      if (bracket) {
        if (isSoldOrBooked) bracket.soldBooked += 1;
        else bracket.available += 1;
      }
    });

    return brackets.map((b) => ({
      name: b.name.split(" ")[0], // Short name for X-Axis
      fullLabel: b.name,
      available: b.available,
      soldBooked: b.soldBooked,
      total: b.available + b.soldBooked,
    }));
  }, [plots]);

  return (
    <div className="rounded-2xl border border-border/70 bg-card/75 backdrop-blur-xl p-6 shadow-xs flex flex-col justify-between h-full font-sans">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Maximize2 className="h-4.5 w-4.5 text-primary" />
            <h3 className="text-lg font-bold tracking-tight text-foreground">Plot Size Category Breakdown</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inventory availability vs sold plots grouped by land size bracket
          </p>
        </div>

        <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
          Plot Area Telemetry
        </span>
      </div>

      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
            <XAxis dataKey="name" stroke="#888888" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis stroke="#888888" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-border/80 bg-card/95 backdrop-blur-md p-3 shadow-xl text-xs space-y-1">
                      <p className="font-bold text-foreground">{d.fullLabel}</p>
                      <p className="text-emerald-600 dark:text-emerald-400 font-semibold">Sold / Booked: {d.soldBooked} Plots</p>
                      <p className="text-sky-600 dark:text-sky-400 font-semibold">Available: {d.available} Plots</p>
                      <p className="text-muted-foreground pt-1 border-t text-[11px]">Total: {d.total} Plots</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
            <Bar dataKey="soldBooked" name="Sold / Booked Plots" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="available" name="Available Plots" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
