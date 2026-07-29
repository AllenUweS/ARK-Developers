import { useMemo } from "react";
import { IndianRupee, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface BookingData {
  id: string;
  total_price: number;
  advance_paid: number;
  booking_date: string;
  status: string;
}

interface RevenueChartProps {
  bookings: BookingData[];
}

export function RevenueChart({ bookings }: RevenueChartProps) {
  const chartData = useMemo(() => {
    const monthlyMap = new Map<string, { collected: number; committed: number; count: number }>();

    bookings.forEach((booking) => {
      if (!booking.booking_date) return;
      const date = new Date(booking.booking_date);
      if (isNaN(date.getTime())) return;

      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

      if (!monthlyMap.has(yearMonth)) {
        monthlyMap.set(yearMonth, { collected: 0, committed: 0, count: 0 });
      }

      const curr = monthlyMap.get(yearMonth)!;
      curr.collected += Number(booking.advance_paid) || 0;
      curr.committed += Number(booking.total_price) || 0;
      curr.count += 1;
    });

    // Convert map to array and sort chronologically
    const result = Array.from(monthlyMap.entries())
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .slice(-8)
      .map(([key, data]) => {
        const [year, month] = key.split("-");
        const d = new Date(Number(year), Number(month) - 1, 1);
        return {
          month: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
          collected: Math.round(data.collected / 100000 * 100) / 100, // Lakhs
          committed: Math.round(data.committed / 100000 * 100) / 100, // Lakhs
          rawCollected: data.collected,
          rawCommitted: data.committed,
          count: data.count,
        };
      });

    return result;
  }, [bookings]);

  const totalCollectedLakhs = chartData.reduce((acc, curr) => acc + curr.collected, 0);

  return (
    <div className="rounded-2xl border border-border/70 bg-card/75 backdrop-blur-xl p-6 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-terracotta animate-pulse" />
            <h3 className="text-lg font-bold tracking-tight text-foreground">Revenue & Collections Trend</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cash collected vs committed deal value over recent months
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Recent Collections</p>
            <p className="text-base font-extrabold text-terracotta">₹{totalCollectedLakhs.toFixed(1)} Lakhs</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta border border-terracotta/20">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="h-72 w-full pt-2">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="collectedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e05638" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#e05638" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="committedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `₹${v}L`}
                tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-border/80 bg-card/95 backdrop-blur-md p-3 shadow-xl text-xs space-y-1.5">
                        <p className="font-bold text-foreground border-b pb-1">{label}</p>
                        <div className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                          <span>Collected:</span>
                          <span className="font-bold">₹{Number(data.rawCollected).toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-amber-600 dark:text-amber-400">
                          <span>Committed Value:</span>
                          <span className="font-bold">₹{Number(data.rawCommitted).toLocaleString("en-IN")}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground pt-1">{data.count} booking(s)</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Area
                type="monotone"
                dataKey="committed"
                name="Committed (Lakhs)"
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#committedGradient)"
              />
              <Area
                type="monotone"
                dataKey="collected"
                name="Collected (Lakhs)"
                stroke="#e05638"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#collectedGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            No booking revenue data available yet.
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-2.5 w-2.5 rounded-sm bg-terracotta inline-block" /> Cash Collected
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-500 inline-block" /> Committed Value
          </span>
        </div>
        <span className="text-[11px]">Real-time revenue telemetry</span>
      </div>
    </div>
  );
}
