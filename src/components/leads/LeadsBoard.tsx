import { useMemo, useState } from "react";
import { LayoutGrid, Table as TableIcon, Search, Layers, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_ORDER,
  LEAD_STATUS_PALETTE,
  type LeadRow,
  type LeadStatus,
} from "@/components/site-mapper/types";
import { LeadCard, type EmployeeOption } from "./LeadCard";
import { formatShortDate, getTemperature, initials, tintFor, isAllowedStageTransition } from "./leadUtils";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export interface ProjectOption {
  id: string;
  name: string;
}

export function LeadsBoard({
  leads,
  employeeNameOf,
  plotLabelOf,
  canManageLead,
  transferOptionsFor,
  onStatusChange,
  onTransfer,
  onEdit,
  onDelete,
  onOpenDetail,
  onMapToPlot,
  projects,
}: {
  leads: LeadRow[];
  employeeNameOf: (id: string | null) => string;
  plotLabelOf?: (lead: LeadRow) => string | undefined;
  canManageLead: (lead: LeadRow) => boolean;
  transferOptionsFor?: (lead: LeadRow) => EmployeeOption[];
  onStatusChange: (id: string, status: LeadStatus) => void;
  onTransfer?: (id: string, newEmployeeId: string) => void;
  onEdit?: (lead: LeadRow) => void;
  onDelete?: (id: string) => void;
  onOpenDetail?: (lead: LeadRow) => void;
  onMapToPlot?: (lead: LeadRow) => void;
  projects?: ProjectOption[];
}) {
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [projectFilter, setProjectFilter] = useState<string | "all">("all");

  const projectLeadCounts = useMemo(() => {
    const m = new Map<string, number>();
    leads.forEach((l) => {
      if (!l.project_id) return;
      m.set(l.project_id, (m.get(l.project_id) ?? 0) + 1);
    });
    return m;
  }, [leads]);

  const projectsWithLeads = useMemo(
    () => (projects ?? []).filter((p) => (projectLeadCounts.get(p.id) ?? 0) > 0),
    [projects, projectLeadCounts],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      const matchesSearch =
        !q ||
        l.name.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        employeeNameOf(l.created_by).toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || l.status === statusFilter;
      const matchesProject = projectFilter === "all" || l.project_id === projectFilter;
      return matchesSearch && matchesStatus && matchesProject;
    });
  }, [leads, search, statusFilter, projectFilter, employeeNameOf]);

  const columns = useMemo(() => {
    return LEAD_STATUS_ORDER.map((status) => ({
      status,
      leads: filtered
        .filter((l) => l.status === status)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Clean toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:flex-none lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              className="pl-10 h-10 bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-10 w-40 bg-card">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {LEAD_STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>{LEAD_STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border bg-card p-1">
            <Button
              size="sm"
              variant={view === "kanban" ? "default" : "ghost"}
              className={`h-8 px-3 ${view === "kanban" ? "bg-terracotta text-white" : ""}`}
              onClick={() => setView("kanban")}
            >
              <LayoutGrid className="h-4 w-4 mr-2" /> Kanban
            </Button>
            <Button
              size="sm"
              variant={view === "table" ? "default" : "ghost"}
              className={`h-8 px-3 ${view === "table" ? "bg-terracotta text-white" : ""}`}
              onClick={() => setView("table")}
            >
              <TableIcon className="h-4 w-4 mr-2" /> Table
            </Button>
          </div>
        </div>
      </div>

      {/* Project filter - cleaner design */}
      {projectsWithLeads.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <button
            onClick={() => setProjectFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              projectFilter === "all"
                ? "bg-terracotta text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All Projects <span className="ml-1.5 opacity-70">({leads.length})</span>
          </button>
          {projectsWithLeads.map((p) => (
            <button
              key={p.id}
              onClick={() => setProjectFilter(p.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                projectFilter === p.id
                  ? "bg-terracotta text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {p.name} <span className="ml-1.5 opacity-70">({projectLeadCounts.get(p.id) ?? 0})</span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">No leads found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      )}

      {filtered.length > 0 && view === "kanban" && (
        <div className="flex gap-4 items-start overflow-x-auto pb-6 -mx-4 px-4 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
          {columns.map((col) => {
            const palette = LEAD_STATUS_PALETTE[col.status];
            const hasLeads = col.leads.length > 0;

            return (
              <div
                key={col.status}
                className="flex flex-col min-w-[280px] w-full max-w-[320px] flex-1"
              >
                {/* Sticky Column header */}
                <div className="sticky top-0 z-10 bg-card/90 backdrop-blur-md py-2.5 px-3 mb-3 rounded-xl border flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${palette.dot}`} />
                    <h3 className="font-bold text-sm text-foreground">{LEAD_STATUS_LABEL[col.status]}</h3>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full border border-border/50">
                    {col.leads.length}
                  </span>
                </div>

                {/* Cards container - natural page scrolling flow */}
                <div className="space-y-3 pb-2">
                  {!hasLeads && (
                    <div className="text-center py-10 text-xs text-muted-foreground border-2 border-dashed rounded-xl bg-card/40">
                      No leads in {LEAD_STATUS_LABEL[col.status]}
                    </div>
                  )}
                  {col.leads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      employeeId={lead.created_by}
                      employeeName={employeeNameOf(lead.created_by)}
                      plotLabel={plotLabelOf?.(lead)}
                      canManage={canManageLead(lead)}
                      transferOptions={transferOptionsFor?.(lead)}
                      onStatusChange={onStatusChange}
                      onTransfer={onTransfer}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onOpenDetail={onOpenDetail}
                      onMapToPlot={onMapToPlot}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && view === "table" && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Phone</TableHead>
                <TableHead className="font-semibold">Added by</TableHead>
                <TableHead className="font-semibold">Plot</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((lead) => {
                  const palette = LEAD_STATUS_PALETTE[lead.status];
                  const temp = getTemperature(lead);
                  const empName = employeeNameOf(lead.created_by);
                  return (
                    <TableRow
                      key={lead.id}
                      className={onOpenDetail ? "cursor-pointer hover:bg-muted/30" : ""}
                      onClick={() => onOpenDetail?.(lead)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {lead.name}
                          {temp === "hot" && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                              Hot
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{lead.phone}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback
                              className={`text-[10px] font-semibold ${tintFor(lead.created_by)}`}
                            >
                              {initials(empName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{empName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {plotLabelOf?.(lead) ?? "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-md border ${palette.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${palette.dot}`} />
                            {LEAD_STATUS_LABEL[lead.status]}
                          </span>

                          {canManageLead(lead) && lead.status !== "converted" && lead.status !== "dropped" && (() => {
                            const currentIdx = LEAD_STATUS_ORDER.indexOf(lead.status);
                            const nextStatus = LEAD_STATUS_ORDER[currentIdx + 1];
                            if (!nextStatus) return null;
                            return (
                              <Button
                                size="sm"
                                onClick={() => onStatusChange(lead.id, nextStatus)}
                                className="h-6 text-[10px] font-bold bg-terracotta hover:bg-terracotta/90 text-white gap-1 px-2 cursor-pointer rounded-md shadow-2xs"
                              >
                                <span>Advance to {LEAD_STATUS_LABEL[nextStatus]}</span>
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatShortDate(lead.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
