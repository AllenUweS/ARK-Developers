import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  subText?: string;
  delta?: number;
  deltaLabel?: string;
  icon: LucideIcon;
  gradient?: string;
  iconBg?: string;
}

export function StatCard({
  title,
  value,
  subText,
  delta,
  deltaLabel = "vs last month",
  icon: Icon,
  gradient = "from-terracotta/20 to-amber-500/10",
  iconBg = "bg-terracotta/15 text-terracotta border-terracotta/30",
}: StatCardProps) {
  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/75 backdrop-blur-xl p-5 shadow-xs hover:shadow-md hover:border-terracotta/40 transition-all duration-300">
      {/* Background ambient gradient glow */}
      <div className={`pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gradient-to-br ${gradient} blur-2xl opacity-60 group-hover:opacity-100 transition-opacity`} />

      <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
            <h3 className="text-3xl font-extrabold tracking-tight text-foreground">{value}</h3>
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-2xs ${iconBg} group-hover:scale-105 transition-transform`}>
            <Icon className="h-5.5 w-5.5" />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
          {delta !== undefined ? (
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center font-bold px-1.5 py-0.5 rounded-full text-[11px]",
                  isPositive && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                  isNegative && "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20",
                  delta === 0 && "bg-muted text-muted-foreground"
                )}
              >
                {isPositive ? "+" : ""}{delta.toFixed(1)}%
              </span>
              <span className="text-muted-foreground text-[11px] font-medium">{deltaLabel}</span>
            </div>
          ) : (
            <span className="text-[11px] font-medium text-muted-foreground">{subText ?? "Active metric"}</span>
          )}
        </div>
      </div>
    </div>
  );
}
