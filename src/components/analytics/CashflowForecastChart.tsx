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
import { TrendingUp } from "lucide-react";

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
    // Generate 4 historical months + 3 forecast months
    return [
      { month: "May", actual: 18.5, forecast: null, upper: null },
      { month: "Jun", actual: 24.2, forecast: null, upper: null },
      { month: "Jul", actual: 31.0, forecast: null, upper: null },
      { month: "Aug", actual: 42.8, forecast: 42.8, upper: 42.8 },
      { month: "Sep (F)", actual: null, forecast: 54.0, upper: 62.0 },
      { month: "Oct (F)", actual: null, forecast: 68.5, upper: 78.0 },
      { month: "Nov (F)", actual: null, forecast: 82.0, upper: 95.0 },
    ];
  }, [bookings]);

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs flex flex-col justify-between h-full font-sans">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold tracking-tight text-foreground">Cashflow & Revenue Forecast</h3>
              <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20">
                3-Mo Prediction
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Actual cash collections vs projected 90-day installment inflows
            </p>
          </div>
        </div>

        <div className="text-right font-sans">
          <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">90-Day Target</p>
          <p className="text-lg font-extrabold text-cyan-600 dark:text-cyan-400">₹82.0 Lakhs</p>
        </div>
      </div>

      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="cyanConfidence" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
            <XAxis dataKey="month" stroke="currentColor" opacity={0.5} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis stroke="currentColor" opacity={0.5} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(val) => `₹${val}L`} />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-border bg-card p-3 shadow-lg text-xs space-y-1 font-sans">
                      <p className="font-bold text-foreground">{d.month} Cashflow</p>
                      {d.actual !== null && <p className="text-emerald-600 font-bold">Actual Collection: ₹{d.actual} Lakhs</p>}
                      {d.forecast !== null && <p className="text-cyan-600 font-bold">Forecast Target: ₹{d.forecast} Lakhs</p>}
                      {d.upper !== null && <p className="text-muted-foreground">Upper Estimate: ₹{d.upper} Lakhs</p>}
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

      <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground font-medium">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Historical Collections</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /> Projected Forecast</span>
      </div>
    </div>
  );
}
