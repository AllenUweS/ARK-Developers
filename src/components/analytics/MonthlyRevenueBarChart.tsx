import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { IndianRupee, TrendingUp } from "lucide-react";

interface Booking {
  booking_date: string;
  advance_paid: number;
  total_price: number;
}

interface MonthlyRevenueBarChartProps {
  bookings: Booking[];
}

export function MonthlyRevenueBarChart({ bookings }: MonthlyRevenueBarChartProps) {
  const chartData = useMemo(() => {
    const map = new Map<string, { collected: number; pending: number; count: number }>();

    bookings.forEach((b) => {
      if (!b.booking_date) return;
      const d = new Date(b.booking_date);
      if (isNaN(d.getTime())) return;
      const key = d.toLocaleDateString("en-IN", { month: "short" });

      if (!map.has(key)) map.set(key, { collected: 0, pending: 0, count: 0 });
      const item = map.get(key)!;

      const advance = Number(b.advance_paid) || 0;
      const total = Number(b.total_price) || 0;
      item.collected += advance;
      item.pending += Math.max(0, total - advance);
      item.count += 1;
    });

    if (map.size === 0) {
      // Fallback sample timeline
      return [
        { month: "May", collected: 18.5, pending: 22.0, count: 4 },
        { month: "Jun", collected: 24.2, pending: 30.5, count: 6 },
        { month: "Jul", collected: 31.0, pending: 38.0, count: 8 },
        { month: "Aug", collected: 42.8, pending: 48.2, count: 11 },
      ];
    }

    return Array.from(map.entries()).map(([month, data]) => ({
      month,
      collected: Math.round((data.collected / 100000) * 10) / 10, // In Lakhs
      pending: Math.round((data.pending / 100000) * 10) / 10, // In Lakhs
      count: data.count,
    }));
  }, [bookings]);

  return (
    <div className="rounded-2xl border border-border/70 bg-card/75 backdrop-blur-xl p-6 shadow-xs flex flex-col justify-between h-full font-sans">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <IndianRupee className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-lg font-bold tracking-tight text-foreground">Monthly Cash vs Pending Balance Bar Chart</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Advance collected vs remaining pending deal balance (in ₹ Lakhs)
          </p>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          Financial Realization
        </span>
      </div>

      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
            <XAxis dataKey="month" stroke="#888888" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis stroke="#888888" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}L`} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-border/80 bg-card/95 backdrop-blur-md p-3 shadow-xl text-xs space-y-1">
                      <p className="font-bold text-foreground">{d.month} Financials</p>
                      <p className="text-emerald-600 dark:text-emerald-400 font-semibold">Advance Realized: ₹{d.collected} Lakhs</p>
                      <p className="text-amber-600 dark:text-amber-400 font-semibold">Pending Receivables: ₹{d.pending} Lakhs</p>
                      <p className="text-muted-foreground text-[11px] pt-1 border-t">Bookings: {d.count}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
            <Bar dataKey="collected" name="Advance Cash Collected (₹L)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="pending" name="Pending Balance (₹L)" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
