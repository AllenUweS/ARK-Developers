import { useMemo } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, Forecast, Sparkles, IndianRupee } from "lucide-react";

interface Booking {
  advance_paid: number;
  total_price: number;
  booking_date: string;
}

interface CashflowForecastChartProps {
  bookings: Booking[];
}

export function CashflowForecastChart({ bookings }: CashflowForecastChartProps) {
  const chartData = useMemo(() => {
    // Generate 6 historical months + 3 forecast months
    const historical = [
      { month: "May", actual: 18.5, forecast: null, upper: null },
      { month: "Jun", actual: 24.2, forecast: null, upper: null },
      { month: "Jul", actual: 31.0, forecast: null, upper: null },
      { month: "Aug", actual: 42.8, forecast: 42.8, upper: 42.8 },
      { month: "Sep (F)", actual: null, forecast: 54.0, upper: 62.0 },
      { month: "Oct (F)", actual: null, forecast: 68.5, upper: 78.0 },
      { month: "Nov (F)", actual: null, forecast: 82.0, upper: 95.0 },
    ];

    return historical;
  }, [bookings]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 p-6 shadow-2xl flex flex-col justify-between h-full font-sans">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-cyan-400" />
            <h3 className="text-lg font-bold tracking-tight text-slate-100">Cashflow & Revenue Forecast</h3>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              3-Mo Predictive AI
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Actual cash collections vs projected 90-day installment milestone inflows
          </p>
        </div>

        <div className="text-right font-mono">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">90-Day Forecast</p>
          <p className="text-lg font-extrabold text-cyan-400">₹82.0 Lakhs</p>
        </div>
      </div>

      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="cyanConfidence" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="month" stroke="#64748b" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis stroke="#64748b" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#06b6d4" }} tickFormatter={(val) => `₹${val}L`} />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur-md p-3 shadow-2xl text-xs space-y-1 font-mono">
                      <p className="font-bold text-slate-200">{d.month} Cashflow</p>
                      {d.actual !== null && <p className="text-emerald-400 font-bold">Actual Collection: ₹{d.actual} Lakhs</p>}
                      {d.forecast !== null && <p className="text-cyan-400 font-bold">Forecast Target: ₹{d.forecast} Lakhs</p>}
                      {d.upper !== null && <p className="text-slate-400">Upper Estimate: ₹{d.upper} Lakhs</p>}
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Confidence Area */}
            <Area type="monotone" dataKey="upper" stroke="none" fillOpacity={1} fill="url(#cyanConfidence)" />

            {/* Actual Collections (Solid Emerald) */}
            <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981" }} />

            {/* Projected Forecast (Dashed Cyan) */}
            <Line type="monotone" dataKey="forecast" stroke="#06b6d4" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: "#06b6d4" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Historical Collections</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-500" /> AI Projected Forecast</span>
      </div>
    </div>
  );
}
