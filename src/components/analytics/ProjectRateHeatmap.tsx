import { useMemo } from "react";
import { Building2, ArrowUpRight, CheckCircle2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Project {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface Plot {
  project_id: string;
  status: string;
  price: number;
  area_sqft?: number;
}

interface Booking {
  advance_paid: number;
  total_price: number;
  plot?: { project_id: string };
}

interface ProjectRateHeatmapProps {
  projects: Project[];
  plots: Plot[];
  bookings: Booking[];
}

export function ProjectRateHeatmap({ projects, plots, bookings }: ProjectRateHeatmapProps) {
  const heatmapData = useMemo(() => {
    return projects.map((p) => {
      const pPlots = plots.filter((plot) => plot.project_id === p.id);
      const totalPlots = pPlots.length || 1;
      const soldPlots = pPlots.filter((plot) => plot.status === "sold" || plot.status === "booked").length;
      const occupancy = Math.round((soldPlots / totalPlots) * 100);

      const pBookings = bookings.filter((b) => b.plot?.project_id === p.id);
      const cashCollected = pBookings.reduce((acc, b) => acc + (Number(b.advance_paid) || 0), 0);
      const totalVal = pBookings.reduce((acc, b) => acc + (Number(b.total_price) || 0), 0);

      const totalArea = pPlots.reduce((acc, pl) => acc + (Number(pl.area_sqft) || 1200), 0);
      const avgRate = Math.round((pPlots.reduce((acc, pl) => acc + (Number(pl.price) || 2500000), 0)) / totalArea);

      return {
        id: p.id,
        name: p.name,
        code: p.code || p.name.slice(0, 3).toUpperCase(),
        totalPlots,
        soldPlots,
        occupancy,
        cashCollected,
        totalVal,
        avgRate,
      };
    });
  }, [projects, plots, bookings]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 p-6 shadow-2xl space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-amber-400" />
          <h3 className="text-lg font-bold tracking-tight text-slate-100">Project Portfolio Heatmap</h3>
        </div>

        <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
          {projects.length} Real Estate Projects
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
        {heatmapData.map((proj) => {
          const isHighMargin = proj.occupancy >= 50;
          return (
            <div
              key={proj.id}
              className={`p-4 rounded-xl border transition-all hover:scale-[1.02] space-y-3 ${
                isHighMargin
                  ? "border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 to-slate-900/80"
                  : "border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-slate-900/80"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-100 font-sans">{proj.name}</h4>
                  <span className="text-[10px] text-slate-400">CODE: {proj.code}</span>
                </div>
                <span className="text-xs font-bold text-emerald-400">₹{proj.avgRate}<span className="text-[10px] text-slate-400">/sqft</span></span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Occupancy: {proj.soldPlots}/{proj.totalPlots} Plots</span>
                  <span className="text-slate-200 font-bold">{proj.occupancy}%</span>
                </div>
                <Progress value={proj.occupancy} className="h-1.5 bg-slate-800" />
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>Collections:</span>
                <span className="font-bold text-emerald-400">₹{(proj.cashCollected / 100000).toFixed(1)} Lakhs</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
