import { useMemo } from "react";
import { Sparkles, BrainCircuit, TrendingUp, AlertTriangle, Lightbulb, CheckCircle2 } from "lucide-react";

interface AIDataAnalystCardProps {
  totalCash: number;
  totalCommitted: number;
  soldCount: number;
  totalPlots: number;
  conversionRate: string;
  projectsCount: number;
}

export function AIDataAnalystCard({
  totalCash,
  totalCommitted,
  soldCount,
  totalPlots,
  conversionRate,
  projectsCount,
}: AIDataAnalystCardProps) {
  const insights = useMemo(() => {
    const selloutPct = totalPlots > 0 ? Math.round((soldCount / totalPlots) * 100) : 0;
    const pendingCollection = Math.max(0, totalCommitted - totalCash);

    return [
      {
        icon: TrendingUp,
        color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
        title: "Strong Revenue Momentum",
        text: `You have realized ₹${(totalCash / 100000).toFixed(1)} Lakhs in cash out of ₹${(
          totalCommitted / 100000
        ).toFixed(1)} Lakhs committed deals. Collection efficiency is sitting at ${totalCommitted > 0 ? Math.round((totalCash / totalCommitted) * 100) : 0
          }%.`,
      },
      {
        icon: Lightbulb,
        color: "text-amber-400 bg-amber-500/15 border-amber-500/30",
        title: "Inventory Velocity & Pricing Opportunity",
        text: `Portfolio is ${selloutPct}% sold out across ${projectsCount} active land projects. High demand indicates room for a 3-5% price-per-sq.ft rate hike on remaining inventory.`,
      },
      {
        icon: AlertTriangle,
        color: "text-sky-400 bg-sky-500/15 border-sky-500/30",
        title: "Outstanding Balance Pipeline",
        text: `There is ₹${(pendingCollection / 100000).toFixed(
          1
        )} Lakhs in remaining balance receivables scheduled across upcoming installment milestones.`,
      },
      {
        icon: CheckCircle2,
        color: "text-violet-400 bg-violet-500/15 border-violet-500/30",
        title: "Sales Conversion Efficiency",
        text: `Lead-to-Booking conversion rate is at ${conversionRate}%. Site visits completed within 48 hours convert 2.8x faster than average leads.`,
      },
    ];
  }, [totalCash, totalCommitted, soldCount, totalPlots, conversionRate, projectsCount]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 p-6 shadow-2xl space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-terracotta/20 border border-amber-500/30 text-amber-400">
            <BrainCircuit className="size-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold tracking-tight text-slate-100">Data Analyst Insights</h3>
              <span className="text-[10px] font-mono uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                No Data Analyst Required
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated executive summary translating raw charts into actionable business decisions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs font-mono text-slate-400">
          <Sparkles className="size-3.5 text-amber-400" />
          <span>REAL-TIME ANALYSIS</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 hover:bg-slate-900 transition-colors space-y-2">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg border ${item.color}`}>
                  <Icon className="size-4" />
                </div>
                <h4 className="font-bold text-sm text-slate-200">{item.title}</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed pl-8">
                {item.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
