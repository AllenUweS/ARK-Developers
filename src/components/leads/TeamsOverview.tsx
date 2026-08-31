import { ChevronRight, Layers, Flame, Trophy, Users2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, tintFor } from "./leadUtils";

export interface TeamSummary {
  managerId: string;
  managerName: string;
  employeeCount: number;
  leadCount: number;
  hotCount: number;
  wonCount: number;
}

export function TeamsOverview({
  teams,
  unassigned,
  totalLeads,
  onSelectTeam,
  onSelectAll,
  onSelectUnassigned,
}: {
  teams: TeamSummary[];
  unassigned: TeamSummary | null;
  totalLeads: number;
  onSelectTeam: (managerId: string) => void;
  onSelectAll: () => void;
  onSelectUnassigned: () => void;
}) {
  const share = (n: number) => (totalLeads > 0 ? Math.round((n / totalLeads) * 100) : 0);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onSelectAll}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-terracotta/30 bg-terracotta/[0.05] hover:bg-terracotta/10 transition-colors px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-terracotta/15 flex items-center justify-center shrink-0">
            <Layers className="h-4 w-4 text-terracotta" />
          </div>
          <div>
            <p className="text-sm font-semibold">View all leads</p>
            <p className="text-xs text-muted-foreground">
              See every lead across all teams in one view
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Teams — tap to drill down
        </p>

        <div className="space-y-3">
          {teams.map((t) => (
            <button
              key={t.managerId}
              type="button"
              onClick={() => onSelectTeam(t.managerId)}
              className="w-full text-left rounded-xl border border-border/60 bg-card hover:border-terracotta/30 hover:shadow-sm transition-all px-5 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className={`text-xs font-bold ${tintFor(t.managerId)}`}>
                      {initials(t.managerName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{t.managerName}'s Team</p>
                    <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Users2 className="h-3 w-3" /> {t.employeeCount} executive
                        {t.employeeCount === 1 ? "" : "s"}
                      </span>
                      <span>·</span>
                      <span>{t.leadCount} leads</span>
                      {t.hotCount > 0 && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <Flame className="h-3 w-3" /> {t.hotCount} hot
                          </span>
                        </>
                      )}
                      {t.wonCount > 0 && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-plot-available">
                            <Trophy className="h-3 w-3" /> {t.wonCount} won
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-terracotta">{share(t.leadCount)}%</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-terracotta to-amber-500 transition-all"
                  style={{ width: `${share(t.leadCount)}%` }}
                />
              </div>
            </button>
          ))}

          {teams.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground bg-card rounded-xl border border-border/50">
              No sales head teams set up yet.
            </div>
          )}

          {unassigned && unassigned.employeeCount + unassigned.leadCount > 0 && (
            <button
              type="button"
              onClick={onSelectUnassigned}
              className="w-full text-left rounded-xl border border-dashed border-border/60 bg-muted/20 hover:border-terracotta/30 transition-all px-5 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="text-xs font-bold bg-muted text-muted-foreground">
                      ?
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">Unassigned / No team</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {unassigned.employeeCount} executive{unassigned.employeeCount === 1 ? "" : "s"}{" "}
                      without a sales head
                      {unassigned.leadCount > 0 ? ` · ${unassigned.leadCount} leads` : ""}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
