import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Building2, Tag } from "lucide-react";

interface Project {
  id: string;
  name: string;
  code: string;
}

interface Plot {
  project_id: string;
  price: number;
  area_sqft?: number;
}

interface ProjectRateBarChartProps {
  projects: Project[];
  plots: Plot[];
}

export function ProjectRateBarChart({ projects, plots }: ProjectRateBarChartProps) {
  const chartData = useMemo(() => {
    if (!projects || projects.length === 0) {
      return [
        { name: "Golden Valley", code: "GML", rate: 3800 },
        { name: "Marbella Heights", code: "MRB", rate: 4200 },
        { name: "Sierra Blanca", code: "SBC", rate: 1950 },
        { name: "Terra Alpha", code: "TRRA", rate: 2450 },
      ];
    }

    return projects.map((p) => {
      const pPlots = plots.filter((pl) => pl.project_id === p.id);
      const totalArea = pPlots.reduce((sum, pl) => sum + (Number(pl.area_sqft) || 1200), 0);
      const totalPrice = pPlots.reduce((sum, pl) => sum + (Number(pl.price) || 2500000), 0);
      const avgRate = totalArea > 0 ? Math.round(totalPrice / totalArea) : 2400;

      return {
        id: p.id,
        name: p.name,
        code: p.code || p.name.slice(0, 4).toUpperCase(),
        rate: avgRate,
      };
    }).sort((a, b) => b.rate - a.rate);
  }, [projects, plots]);

  const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#e11d48", "#06b6d4"];

  return (
    <div className="rounded-2xl border border-border/70 bg-card/75 backdrop-blur-xl p-6 shadow-xs flex flex-col justify-between h-full font-sans">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="h-4.5 w-4.5 text-primary" />
            <h3 className="text-lg font-bold tracking-tight text-foreground">Project Rate Comparison (₹/sq.ft)</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Average price per square foot across active land development projects
          </p>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
          Land Pricing Matrix
        </span>
      </div>

      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} horizontal={false} />
            <XAxis type="number" stroke="#888888" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
            <YAxis type="category" dataKey="name" stroke="#888888" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={110} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-border/80 bg-card/95 backdrop-blur-md p-3 shadow-xl text-xs space-y-1">
                      <p className="font-bold text-foreground">{d.name} ({d.code})</p>
                      <p className="text-primary font-bold">Avg Rate: ₹{d.rate.toLocaleString("en-IN")}/sq.ft</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="rate" name="Rate (₹/sq.ft)" radius={[0, 6, 6, 0]} maxBarSize={28}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
