import { useMemo } from "react";
import { Building2, TrendingUp, Layers, BadgeCheck } from "lucide-react";
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
  rate_per_sqft?: number;
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
      const totalPlots = pPlots.length;
      const soldPlots = pPlots.filter((plot) => plot.status === "sold" || plot.status === "booked").length;
      const occupancy = totalPlots > 0 ? Math.round((soldPlots / totalPlots) * 100) : 0;

      const pBookings = bookings.filter((b) => b.plot?.project_id === p.id);
      const cashCollected = pBookings.reduce((acc, b) => acc + (Number(b.advance_paid) || 0), 0);
      const totalVal = pBookings.reduce((acc, b) => acc + (Number(b.total_price) || 0), 0);

      // Compute average rate per sqft safely without NaN
      const totalArea = pPlots.reduce((acc, pl) => acc + (Number(pl.area_sqft) || 0), 0);
      const totalPrice = pPlots.reduce((acc, pl) => acc + (Number(pl.price) || 0), 0);
      
      let rawAvgRate = 0;
      if (totalArea > 0 && totalPrice > 0) {
        rawAvgRate = totalPrice / totalArea;
      } else if (pPlots.length > 0 && totalPrice > 0) {
        rawAvgRate = totalPrice / (pPlots.length * 1200);
      } else {
        const explicitRates = pPlots.map(pl => Number(pl.rate_per_sqft) || 0).filter(r => r > 0);
        if (explicitRates.length > 0) {
          rawAvgRate = explicitRates.reduce((a, b) => a + b, 0) / explicitRates.length;
        }
      }

      const avgRate = isNaN(rawAvgRate) || !isFinite(rawAvgRate) || rawAvgRate <= 0 ? 0 : Math.round(rawAvgRate);

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

  const formatLakhs = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} Lakhs`;
    return `₹${val.toLocaleString("en-IN")}`;
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs flex flex-col justify-between h-full font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-terracotta/10 text-terracotta border border-terracotta/20">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold tracking-tight text-foreground">Project Portfolio Heatmap</h3>
            <p className="text-xs text-muted-foreground">Occupancy rates, land pricing valuation & revenue realization</p>
          </div>
        </div>

        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-terracotta/10 text-terracotta border border-terracotta/20">
          {projects.length} Active Developments
        </span>
      </div>

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {heatmapData.map((proj) => {
          const isHighSales = proj.occupancy >= 40;
          const isModerateSales = proj.occupancy >= 15 && proj.occupancy < 40;

          const cardTheme = isHighSales
            ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-emerald-500/5"
            : isModerateSales
            ? "border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-amber-500/5"
            : "border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-card to-indigo-500/5";

          const badgeTheme = isHighSales
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
            : isModerateSales
            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
            : "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30";

          const progressColor = isHighSales
            ? "[&>div]:bg-emerald-500 bg-emerald-500/20"
            : isModerateSales
            ? "[&>div]:bg-amber-500 bg-amber-500/20"
            : "[&>div]:bg-indigo-500 bg-indigo-500/20";

          return (
            <div
              key={proj.id}
              className={`p-4 rounded-xl border transition-all duration-200 hover:shadow-md space-y-3 ${cardTheme}`}
            >
              {/* Title & Code Badge */}
              <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-2.5">
                <div>
                  <h4 className="font-bold text-base text-foreground leading-snug">{proj.name}</h4>
                  <span className="inline-block text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
                    CODE: {proj.code}
                  </span>
                </div>
                <div className={`px-2.5 py-1 rounded-lg border text-xs font-bold shrink-0 ${badgeTheme}`}>
                  {proj.avgRate > 0 ? `₹${proj.avgRate.toLocaleString("en-IN")}` : "Unrated"}
                  <span className="text-[10px] opacity-75 font-normal ml-0.5">/sqft</span>
                </div>
              </div>

              {/* Occupancy Progress */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="font-medium">Occupancy ({proj.soldPlots}/{proj.totalPlots} Plots)</span>
                  <span className="font-bold text-foreground">{proj.occupancy}%</span>
                </div>
                <Progress value={proj.occupancy} className={`h-2 rounded-full ${progressColor}`} />
              </div>

              {/* Cash Realized */}
              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Collections Realized</span>
                <span className="font-bold text-foreground">{formatLakhs(proj.cashCollected)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
