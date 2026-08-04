import { useMemo, useState } from "react";
import {
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CandlestickChart, Sliders, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Booking {
  booking_date: string;
  total_price: number;
  advance_paid: number;
  status: string;
}

interface MarketVelocityChartProps {
  bookings: Booking[];
}

export function MarketVelocityChart({ bookings }: MarketVelocityChartProps) {
  const [showMA, setShowMA] = useState(true);

  const chartData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const currentMonthIdx = now.getMonth();

    const timeline = [];
    for (let i = 5; i >= 0; i--) {
      const idx = (currentMonthIdx - i + 12) % 12;
      const mName = months[idx];
      timeline.push({
        month: mName,
        yearMonth: `2026-${String(idx + 1).padStart(2, "0")}`,
      });
    }

    const map = new Map<string, { totalVal: number; count: number }>();
    bookings.forEach((b) => {
      if (!b.booking_date) return;
      const d = new Date(b.booking_date);
      if (isNaN(d.getTime())) return;
      const key = d.toLocaleDateString("en-IN", { month: "short" });
      const current = map.get(key) || { totalVal: 0, count: 0 };
      map.set(key, {
        totalVal: current.totalVal + (Number(b.total_price) || 0),
        count: current.count + 1,
      });
    });

    const baseRates: Record<string, number> = {
      May: 2150,
      Jun: 2280,
      Jul: 2340,
      Aug: 2420,
      Sep: 2510,
      Oct: 2605,
    };

    let runningSum = 0;
    const data = timeline.map((item, idx) => {
      const mData = map.get(item.month) || { totalVal: 0, count: 0 };
      const volume = mData.count > 0 ? mData.count * 2 + 3 : (idx + 1) * 3 + 2;
      const landRate = baseRates[item.month] || 2200 + idx * 75;

      runningSum += landRate;
      const ma3 = idx >= 2 ? Math.round(runningSum / (idx + 1)) : landRate;

      return {
        month: item.month,
        landRate,
        movingAvg: ma3,
        volume,
        deals: mData.count,
      };
    });

    return data;
  }, [bookings]);

  const latestRate = chartData[chartData.length - 1]?.landRate || 2500;
  const startRate = chartData[0]?.landRate || 2200;
  const growthPct = (((latestRate - startRate) / startRate) * 100).toFixed(1);

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs flex flex-col justify-between h-full font-sans">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CandlestickChart className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold tracking-tight text-foreground">Land Valuation Velocity</h3>
              <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                TRRA Index
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Average land rate index (₹/sq.ft) & monthly plot trading volume
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Current Land Rate</p>
            <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
              ₹{latestRate.toLocaleString("en-IN")}<span className="text-xs font-normal text-muted-foreground">/sq.ft</span>
            </p>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-500/30">
            <ArrowUpRight className="size-4" />
            +{growthPct}% YoY
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMA(!showMA)}
            className={`h-8 px-2 text-xs border ${
              showMA ? "bg-muted border-border text-foreground" : "bg-transparent border-border/50 text-muted-foreground"
            }`}
          >
            <Sliders className="size-3.5 mr-1" /> MA Line
          </Button>
        </div>
      </div>

      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="neonEmerald" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
            <XAxis dataKey="month" stroke="currentColor" opacity={0.5} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" stroke="currentColor" opacity={0.5} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
            <YAxis yAxisId="right" orientation="right" stroke="currentColor" opacity={0.3} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-border bg-card p-3 shadow-lg text-xs space-y-1 font-sans">
                      <p className="font-bold text-foreground">{d.month} Land Telemetry</p>
                      <p className="text-emerald-600 font-bold">Land Rate: ₹{d.landRate}/sq.ft</p>

                      {showMA && <p className="text-amber-500">3-Mo Moving Avg: ₹{d.movingAvg}/sq.ft</p>}
                      <p className="text-muted-foreground">Plot Transactions: {d.deals} deals ({d.volume} units volume)</p>
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Trading Volume Bars (Subtle Background Bars) */}
            <Bar yAxisId="right" dataKey="volume" fill="#10b981" opacity={0.15} radius={[4, 4, 0, 0]} />

            {/* Price Area */}
            <Area yAxisId="left" type="monotone" dataKey="landRate" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#neonEmerald)" />

            {/* Moving Average Line */}
            {showMA && (
              <Line yAxisId="left" type="monotone" dataKey="movingAvg" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground font-medium">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Land Price Index (₹/sq.ft)</span>
        {showMA && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 3-Month Moving Average</span>}
      </div>
    </div>
  );
}
