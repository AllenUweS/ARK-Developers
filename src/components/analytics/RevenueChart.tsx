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

      if (!monthlyMap.has(yearMonth)) {
        monthlyMap.set(yearMonth, { collected: 0, committed: 0, count: 0 });
      }

      const curr = monthlyMap.get(yearMonth)!;
      curr.collected += Number(booking.advance_paid) || 0;
      curr.committed += Number(booking.total_price) || 0;
      curr.count += 1;
    });

    // Sort chronologically
    const sortedEntries = Array.from(monthlyMap.entries())
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .slice(-8);

    // Compute cumulative running totals for a smooth upward revenue realization curve
    let runningCollected = 0;
    let runningCommitted = 0;

    const result = sortedEntries.map(([key, data]) => {
      const [year, month] = key.split("-");
      const d = new Date(Number(year), Number(month) - 1, 1);

      runningCollected += data.collected;
      runningCommitted += data.committed;

      const collectedLakhs = Math.round((runningCollected / 100000) * 10) / 10;
      const committedLakhs = Math.round((runningCommitted / 100000) * 10) / 10;

      return {
        month: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        collected: collectedLakhs,
        committed: committedLakhs,
        rawCollected: runningCollected,
        rawCommitted: runningCommitted,
        monthCollected: data.collected,
        monthCommitted: data.committed,
        count: data.count,
      };
    });

    return result;
  }, [bookings]);

  const rawTotalCollected = chartData.length > 0 ? chartData[chartData.length - 1].rawCollected : 0;

  const formatHeaderCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} Lakhs`;
    return `₹${val.toLocaleString("en-IN")}`;
  };

  const formatYAxisTick = (val: number) => {
    if (val >= 100) return `₹${(val / 100).toFixed(1)}Cr`;
    return `₹${val}L`;
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs flex flex-col justify-between h-full font-sans">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-terracotta/10 text-terracotta border border-terracotta/20">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">Cumulative Revenue Growth Trend</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cumulative cash collected vs committed deal value growth over time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Total Cash Realized</p>
            <p className="text-lg font-extrabold text-terracotta">{formatHeaderCurrency(rawTotalCollected)}</p>
          </div>
        </div>
      </div>

      <div className="h-72 w-full pt-2">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 15, left: 10, bottom: 0 }}>
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

              <CartesianGrid strokeDasharray="3 3" opacity={0.12} vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
              />
              <YAxis
                width={65}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatYAxisTick}
                tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-border bg-card p-3.5 shadow-lg text-xs space-y-2">
                        <p className="font-bold text-foreground border-b pb-1.5">{label} Revenue Realization</p>
                        <div className="flex items-center justify-between gap-6 text-terracotta">
                          <span className="font-medium">Cumulative Cash Realized:</span>
                          <span className="font-bold">{formatHeaderCurrency(data.rawCollected)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-6 text-amber-600 dark:text-amber-400">
                          <span className="font-medium">Cumulative Committed Value:</span>
                          <span className="font-bold">{formatHeaderCurrency(data.rawCommitted)}</span>
                        </div>
                        <div className="pt-1 border-t text-[10px] text-muted-foreground flex justify-between">
                          <span>Month's Inflow: {formatHeaderCurrency(data.monthCollected)}</span>
                          <span>{data.count} booking(s)</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Area
                type="monotone"
                dataKey="committed"
                name="Committed Value"
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#committedGradient)"
              />
              <Area
                type="monotone"
                dataKey="collected"
                name="Cash Realized"
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

      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-2.5 w-2.5 rounded-sm bg-terracotta inline-block" /> Cumulative Cash Realized
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-500 inline-block" /> Cumulative Committed Value
          </span>
        </div>
        <span className="text-[11px] font-semibold text-terracotta">Growth Telemetry</span>
      </div>
    </div>
  );
}
