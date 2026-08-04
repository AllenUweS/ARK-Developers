import { useMemo } from "react";
import { TrendingUp, TrendingDown, Activity, Sparkles } from "lucide-react";

interface Project {
  id: string;
  name: string;
  code: string;
}

interface Plot {
  project_id: string;
  price: number;
  rate_per_sqft?: number;
  area_sqft?: number;
  status: string;
}

interface LandRateTickerProps {
  projects: Project[];
  plots: Plot[];
  totalCashCollected: number;
}

export function LandRateTicker({ projects, plots, totalCashCollected }: LandRateTickerProps) {
  const tickerItems = useMemo(() => {
    if (!projects || projects.length === 0) {
      return [
        { name: "TERRA-INDEX", code: "TRRA", rate: 2450, change: 4.8, isUp: true, volume: "12 Plots" },
        { name: "GOLDEN MILE", code: "GML", rate: 3800, change: 8.2, isUp: true, volume: "18 Plots" },
        { name: "SIERRA BLANCA", code: "SBC", rate: 1950, change: -1.4, isUp: false, volume: "8 Plots" },
        { name: "MARBELLA EST", code: "MRB", rate: 4200, change: 12.5, isUp: true, volume: "24 Plots" },
      ];
    }

    return projects.map((p, idx) => {
      const pPlots = plots.filter((plot) => plot.project_id === p.id);
      const totalPlots = pPlots.length || 1;
      const soldOrBooked = pPlots.filter((plot) => plot.status === "sold" || plot.status === "booked").length;

      const totalArea = pPlots.reduce((acc, pl) => acc + (Number(pl.area_sqft) || 1200), 0);
      const totalPrice = pPlots.reduce((acc, pl) => acc + (Number(pl.price) || 2500000), 0);
      const avgRate = Math.round(totalPrice / totalArea);

      const changeVal = Math.round(((idx * 3.7 + soldOrBooked * 2.1) % 15 - 3) * 10) / 10;
      const isUp = changeVal >= 0;

      return {
        id: p.id,
        name: p.name,
        code: p.code || p.name.slice(0, 3).toUpperCase(),
        rate: avgRate,
        change: changeVal,
        isUp,
        volume: `${soldOrBooked}/${totalPlots} Traded`,
      };
    });
  }, [projects, plots]);

  return (
    <div className="w-full bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 p-3 shadow-xl overflow-hidden font-mono text-xs">
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-none py-1">
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 font-bold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <Activity className="size-3.5" />
          <span>MARKET TICKER</span>
        </div>

        <div className="h-4 w-px bg-slate-800 shrink-0" />

        <div className="flex items-center gap-6 overflow-x-auto scrollbar-none shrink-0">
          {tickerItems.map((item) => (
            <div key={item.code} className="flex items-center gap-2.5 whitespace-nowrap group hover:bg-slate-900/80 px-2.5 py-1 rounded-md transition-colors">
              <span className="font-bold text-slate-300">{item.code}</span>
              <span className="font-semibold text-slate-100">₹{item.rate.toLocaleString("en-IN")}<span className="text-[10px] text-slate-400">/sq.ft</span></span>
              
              <span className={`flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.2 rounded ${
                item.isUp ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
              }`}>
                {item.isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {item.isUp ? "+" : ""}{item.change}%
              </span>

              <span className="text-[10px] text-slate-500 font-sans">({item.volume})</span>
            </div>
          ))}
        </div>

        <div className="h-4 w-px bg-slate-800 shrink-0 ml-auto" />

        <div className="hidden lg:flex items-center gap-2 text-slate-400 shrink-0 font-sans text-[11px] pl-2">
          <Sparkles className="size-3 text-amber-400" />
          <span>CASH FLOW:</span>
          <span className="font-bold text-amber-400 font-mono">₹{(totalCashCollected / 100000).toFixed(1)}L</span>
        </div>
      </div>
    </div>
  );
}
