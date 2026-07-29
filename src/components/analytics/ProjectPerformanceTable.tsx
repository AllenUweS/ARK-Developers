import { useMemo } from "react";
import { Building2, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface ProjectData {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface PlotData {
  id: string;
  project_id: string;
  status: string;
  price: number;
}

interface BookingData {
  id: string;
  total_price: number;
  advance_paid: number;
  status: string;
  plot?: {
    project_id: string;
  };
}

interface ProjectPerformanceTableProps {
  projects: ProjectData[];
  plots: PlotData[];
  bookings: BookingData[];
}

export function ProjectPerformanceTable({ projects, plots, bookings }: ProjectPerformanceTableProps) {
  const tableStats = useMemo(() => {
    return projects.map((project) => {
      const projPlots = plots.filter((p) => p.project_id === project.id);
      const totalPlots = projPlots.length;
      const soldPlots = projPlots.filter((p) => p.status === "sold").length;
      const bookedPlots = projPlots.filter((p) => p.status === "booked").length;
      const reservedPlots = projPlots.filter((p) => p.status === "reserved").length;
      const availablePlots = projPlots.filter((p) => p.status === "available").length;

      const projBookings = bookings.filter((b) => b.plot?.project_id === project.id);
      const revenueCollected = projBookings.reduce((sum, b) => sum + (Number(b.advance_paid) || 0), 0);
      const committedValue = projBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);

      const selloutPct = totalPlots > 0 ? Math.round((soldPlots / totalPlots) * 100) : 0;
      const avgPrice = projPlots.length > 0
        ? Math.round(projPlots.reduce((acc, p) => acc + (Number(p.price) || 0), 0) / projPlots.length)
        : 0;

      return {
        id: project.id,
        name: project.name,
        code: project.code,
        status: project.status,
        totalPlots,
        soldPlots,
        bookedPlots,
        reservedPlots,
        availablePlots,
        selloutPct,
        revenueCollected,
        committedValue,
        avgPrice,
      };
    }).sort((a, b) => b.revenueCollected - a.revenueCollected);
  }, [projects, plots, bookings]);

  return (
    <div className="rounded-2xl border border-border/70 bg-card/75 backdrop-blur-xl overflow-hidden shadow-xs flex flex-col justify-between">
      <div className="p-6 border-b border-border/50 flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4.5 w-4.5 text-terracotta" />
            <h3 className="text-lg font-bold tracking-tight text-foreground">Project-Level Performance</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real estate inventory breakdown, sales velocity & collections
          </p>
        </div>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-terracotta/10 text-terracotta border border-terracotta/20">
          {projects.length} Active Projects
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/30 border-b border-border/50 text-left uppercase text-[10px] tracking-wider text-muted-foreground font-semibold">
              <th className="p-4">Project</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">Sold / Total</th>
              <th className="p-4 text-right">Cash Collected</th>
              <th className="p-4 text-right">Committed Value</th>
              <th className="p-4 text-right">Avg Plot Price</th>
              <th className="p-4 text-center">Sellout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {tableStats.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                <td className="p-4">
                  <Link to="/projects/$id" params={{ id: p.id }} className="group inline-flex items-center gap-2">
                    <div>
                      <p className="font-bold text-foreground group-hover:text-terracotta transition-colors flex items-center gap-1">
                        {p.name}
                        <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase">{p.code}</p>
                    </div>
                  </Link>
                </td>
                <td className="p-4 text-center">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border capitalize bg-muted/50 border-border text-foreground">
                    {p.status}
                  </span>
                </td>
                <td className="p-4 text-center font-medium">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{p.soldPlots}</span>
                  <span className="text-muted-foreground"> / {p.totalPlots}</span>
                </td>
                <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{Number(p.revenueCollected).toLocaleString("en-IN")}
                </td>
                <td className="p-4 text-right font-semibold text-foreground">
                  ₹{Number(p.committedValue).toLocaleString("en-IN")}
                </td>
                <td className="p-4 text-right text-muted-foreground font-medium">
                  ₹{Number(p.avgPrice).toLocaleString("en-IN")}
                </td>
                <td className="p-4 text-center min-w-[120px]">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold text-foreground">{p.selloutPct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-terracotta to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${p.selloutPct}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {tableStats.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No projects recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
