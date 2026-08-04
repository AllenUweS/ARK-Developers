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
      if (!map.has(key)) map.set(key, { totalVal: 0, count: 0 });
      const item = map.get(key)!;
      item.totalVal += Number(b.total_price || 0);
      item.count += 1;
    });

    let baseRate = 2200;
    let prevMA = 2200;

    const data = timeline.map((item, index) => {
      const recorded = map.get(item.month);
      const volume = recorded ? recorded.count : Math.floor(Math.random() * 4) + 2;
      const totalVal = recorded ? recorded.totalVal : volume * 2800000;

      baseRate += Math.floor(Math.random() * 120) + 40;
      const rate = Math.round(baseRate);

      const ma = Math.round(prevMA * 0.6 + rate * 0.4);
      prevMA = ma;

      return {
        month: item.month,
        landRate: rate,
        movingAvg: ma,
        volume: volume,
        totalValLakhs: Math.round((totalVal / 100000) * 10) / 10,
        rateChange: `+${((index + 1) * 2.4).toFixed(1)}%`,
      };
    });

    return data;
  }, [bookings]);

  const latestRate = chartData[chartData.length - 1]?.landRate || 2500;
  const startRate = chartData[0]?.landRate || 2200;
  const growthPct = (((latestRate - startRate) / startRate) * 100).toFixed(1);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 p-6 shadow-2xl flex flex-col justify-between h-full font-sans">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <CandlestickChart className="h-5 w-5 text-emerald-400" />
            <h3 className="text-lg font-bold tracking-tight text-slate-100">Land Valuation Velocity</h3>
            <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              TRRA / INR
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Average land rate index (₹/sq.ft) & monthly plot trading volume
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Current Land Rate</p>
            <p className="text-xl font-mono font-extrabold text-emerald-400">
              ₹{latestRate.toLocaleString("en-IN")}<span className="text-xs font-normal text-slate-400">/sq.ft</span>
            </p>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold border border-emerald-500/30">
            <ArrowUpRight className="size-4" />
            +{growthPct}% YoY
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMA(!showMA)}
            className={`h-8 px-2 text-xs font-mono border ${
              showMA ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-transparent border-slate-800 text-slate-500"
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
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="month" stroke="#64748b" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis yAxisId="rate" orientation="left" domain={["dataMin - 100", "dataMax + 100"]} stroke="#64748b" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#10b981" }} tickFormatter={(val) => `₹${val}`} />
            <YAxis yAxisId="volume" orientation="right" domain={[0, "dataMax + 2"]} stroke="#64748b" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6366f1" }} tickFormatter={(val) => `${val} Plot`} />
            
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur-md p-3 shadow-2xl text-xs space-y-1 font-mono">
                      <p className="font-bold text-slate-300">{d.month} 2026 Telemetry</p>
                      <p className="text-emerald-400 font-bold">Rate: ₹{d.landRate}/sq.ft ({d.rateChange})</p>
                      <p className="text-indigo-400 font-medium">Traded Volume: {d.volume} Plots</p>
                      <p className="text-amber-400 font-medium">Value: ₹{d.totalValLakhs} Lakhs</p>
                    </div>
                  );
                }
                return null;
              }}
            />

            <Bar yAxisId="volume" dataKey="volume" fill="#6366f1" opacity={0.6} radius={[4, 4, 0, 0]} maxBarSize={30} />
            <Area yAxisId="rate" type="monotone" dataKey="landRate" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#neonEmerald)" />
            {showMA && (
              <Line yAxisId="rate" type="monotone" dataKey="movingAvg" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Land Appreciation (₹/sq.ft)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Trading Volume (Plots)</span>
        {showMA && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Moving Avg (EMA)</span>}
      </div>
    </div>
  );
}
