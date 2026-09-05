import { Users, DoorOpen, Flame, Trophy, Ban } from "lucide-react";

export function LeadsStatCards({
  total,
  open,
  hot,
  won,
  dropped = 0,
}: {
  total: number;
  open: number;
  hot: number;
  won: number;
  dropped?: number;
}) {
  const cards = [
    { label: "Total leads", value: total, icon: Users, tone: "text-foreground" },
    { label: "Open", value: open, icon: DoorOpen, tone: "text-terracotta" },
    { label: "Hot leads", value: hot, icon: Flame, tone: "text-amber-600 dark:text-amber-400" },
    { label: "Closed won", value: won, icon: Trophy, tone: "text-emerald-600 dark:text-emerald-400" },
    ...(dropped > 0 ? [{ label: "Dropped / Cancelled", value: dropped, icon: Ban, tone: "text-red-600 dark:text-red-400" }] : []),
  ];

  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${cards.length > 4 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-card border rounded-lg p-6 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-start justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <c.icon className={`h-4 w-4 ${c.tone}`} />
          </div>
          <p className={`text-display text-3xl mt-3 ${c.tone}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
