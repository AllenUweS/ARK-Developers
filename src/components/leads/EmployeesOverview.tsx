import { ChevronRight, Flame, Trophy } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, tintFor } from "./leadUtils";

export interface EmployeeSummary {
  employeeId: string;
  employeeName: string;
  leadCount: number;
  hotCount: number;
  wonCount: number;
}

export function EmployeesOverview({
  employees,
  totalLeads,
  onSelectEmployee,
  onSelectAll,
}: {
  employees: EmployeeSummary[];
  totalLeads: number;
  onSelectEmployee: (employeeId: string) => void;
  onSelectAll: () => void;
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
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="text-xs font-bold bg-terracotta/20 text-terracotta">
              ALL
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold">View whole team's leads</p>
            <p className="text-xs text-muted-foreground">
              See every lead assigned to anyone in this team
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Executives — tap to view leads
        </p>

        <div className="space-y-3">
          {employees.map((e) => (
            <button
              key={e.employeeId}
              type="button"
              onClick={() => onSelectEmployee(e.employeeId)}
              className="w-full text-left rounded-xl border border-border/60 bg-card hover:border-terracotta/30 hover:shadow-sm transition-all px-5 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className={`text-xs font-bold ${tintFor(e.employeeId)}`}>
                      {initials(e.employeeName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{e.employeeName}</p>
                    <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground mt-0.5">
                      <span>{e.leadCount} leads</span>
                      {e.hotCount > 0 && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <Flame className="h-3 w-3" /> {e.hotCount} hot
                          </span>
                        </>
                      )}
                      {e.wonCount > 0 && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-plot-available">
                            <Trophy className="h-3 w-3" /> {e.wonCount} won
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-terracotta">{share(e.leadCount)}%</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-terracotta to-amber-500 transition-all"
                  style={{ width: `${share(e.leadCount)}%` }}
                />
              </div>
            </button>
          ))}

          {employees.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground bg-card rounded-xl border border-border/50">
              No executives in this team.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
