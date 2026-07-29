import { useMemo } from "react";
import { Award, Sparkles, UserCheck } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

interface IncentiveData {
  id: string;
  amount: number;
  granted_at: string;
  employee?: { full_name?: string } | null;
}

interface IncentivesChartProps {
  incentives: IncentiveData[];
}

export function IncentivesChart({ incentives }: IncentivesChartProps) {
  const leaderData = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();

    incentives.forEach((item) => {
      const name = item.employee?.full_name || "Sales Executive";
      if (!map.has(name)) {
        map.set(name, { total: 0, count: 0 });
      }
      const curr = map.get(name)!;
      curr.total += Number(item.amount) || 0;
      curr.count += 1;
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        amount: Math.round(data.total),
        amountThousands: Math.round(data.total / 1000),
        count: data.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [incentives]);

  const totalIncentivesValue = useMemo(
    () => incentives.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [incentives]
  );

  return (
    <div className="rounded-2xl border border-border/70 bg-card/75 backdrop-blur-xl p-6 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Award className="h-4.5 w-4.5 text-amber-500" />
            <h3 className="text-lg font-bold tracking-tight text-foreground">Incentives Paid</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Leaderboard of incentive disbursements to team members
          </p>
        </div>

        <div className="text-right">
          <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Total Paid Out</p>
          <p className="text-base font-black text-amber-600 dark:text-amber-400">
            ₹{totalIncentivesValue.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div className="h-60 w-full pt-2">
        {leaderData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={leaderData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={110}
                tick={{ fontSize: 11, fill: "currentColor" }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-border/80 bg-card/95 backdrop-blur-md p-2.5 shadow-xl text-xs space-y-1">
                        <p className="font-bold text-foreground">{data.name}</p>
                        <p className="text-amber-600 dark:text-amber-400 font-bold">
                          ₹{Number(data.amount).toLocaleString("en-IN")}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{data.count} grant(s)</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="amount" radius={[0, 8, 8, 0]}>
                {leaderData.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === 0 ? "#f59e0b" : index === 1 ? "#e05638" : "#8b5cf6"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            No incentive payouts recorded yet.
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
        <span>Grants: <strong className="text-foreground">{incentives.length}</strong></span>
        <span>Top Earner: <strong className="text-amber-600 dark:text-amber-400">{leaderData[0]?.name ?? "None"}</strong></span>
      </div>
    </div>
  );
}
