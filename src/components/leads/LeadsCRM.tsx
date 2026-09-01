import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Loader2, Users, MapPin, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { type LeadRow, type LeadStatus, LEAD_STATUS_LABEL, LEAD_STATUS_ORDER } from "@/components/site-mapper/types";
import { LeadFormDialog, type LeadFormValues } from "@/components/site-mapper/LeadFormDialog";
import { NewLeadDialog, type NewLeadValues } from "./NewLeadDialog";
import { MapLeadToPlotDialog } from "./MapLeadToPlotDialog";
import { LeadsStatCards } from "./LeadsStatCards";
import { TeamsOverview, type TeamSummary } from "./TeamsOverview";
import { EmployeesOverview, type EmployeeSummary } from "./EmployeesOverview";
import { LeadsBoard, type ProjectOption } from "./LeadsBoard";
import { LeadDetailDialog } from "./LeadDetailDialog";
import { isOpen, getTemperature, isAllowedStageTransition } from "./leadUtils";
import type { EmployeeOption } from "./LeadCard";


type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  manager_id: string | null;
};

type View = "teams" | "all" | "team" | "employee";
type LeadTypeFilter = "all" | "plot" | "general";
const UNASSIGNED_KEY = "__unassigned__";

function computeStats(leads: LeadRow[]) {
  return {
    total: leads.length,
    open: leads.filter((l) => isOpen(l.status)).length,
    hot: leads.filter((l) => getTemperature(l) === "hot").length,
    won: leads.filter((l) => l.status === "converted").length,
  };
}

export function LeadsCRM({ userId }: { userId: string }) {
  const qc = useQueryClient();

  const [view, setView] = useState<View>("teams");
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [viewingLeadId, setViewingLeadId] = useState<string | null>(null);
  const [mappingLeadId, setMappingLeadId] = useState<string | null>(null);
  const [contactDialogLeadId, setContactDialogLeadId] = useState<string | null>(null);
  const [leadTypeFilter, setLeadTypeFilter] = useState<LeadTypeFilter>("all");

  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ["role", userId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: userId });
      return (data as string) ?? "employee";
    },
  });

  const isAdmin = role === "admin" || role === "super_admin" || role === "crm";
  const isManager = role === "manager" || role === "management";
  const isPlainEmployee = !!role && !isAdmin && !isManager;

  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["leads_profiles", role, userId],
    enabled: !!role,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, manager_id");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ["leads_user_roles", role],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["all_plot_leads"],
    enabled: !!role,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("plot_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadRow[];
    },
  });

  const viewingLead = useMemo(
    () => (viewingLeadId ? (leads ?? []).find((l) => l.id === viewingLeadId) ?? null : null),
    [leads, viewingLeadId]
  );
  const setViewingLead = (lead: LeadRow | null) => setViewingLeadId(lead ? lead.id : null);

  const editingLead = useMemo(
    () => (editingLeadId ? (leads ?? []).find((l) => l.id === editingLeadId) ?? null : null),
    [leads, editingLeadId]
  );
  const setEditingLead = (lead: LeadRow | null) => setEditingLeadId(lead ? lead.id : null);

  const mappingLead = useMemo(
    () => (mappingLeadId ? (leads ?? []).find((l) => l.id === mappingLeadId) ?? null : null),
    [leads, mappingLeadId]
  );
  const setMappingLead = (lead: LeadRow | null) => setMappingLeadId(lead ? lead.id : null);

  const contactDialogLead = useMemo(
    () => (contactDialogLeadId ? (leads ?? []).find((l) => l.id === contactDialogLeadId) ?? null : null),
    [leads, contactDialogLeadId]
  );
  const setContactDialogLead = (lead: LeadRow | null) => setContactDialogLeadId(lead ? lead.id : null);

  const { data: plots } = useQuery({
    queryKey: ["leads_plots"],
    enabled: !!role,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plots")
        .select("id, plot_number, project_id, projects(name)");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: projectsList } = useQuery({
    queryKey: ["leads_projects"],
    enabled: !!role,
    queryFn: async () => {
      let q = supabase.from("projects").select("id, name").order("name");
      if (!isAdmin) {
        q = q.eq("status", "live");
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProjectOption[];
    },
  });

  const isLoading = roleLoading || profilesLoading || leadsLoading;

  const profileById = useMemo(() => {
    const m = new Map<string, Profile>();
    (profiles ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const roleOf = useMemo(() => {
    const m = new Map<string, string>();
    (userRoles ?? []).forEach((r: any) => {
      // super_admin/admin outrank manager/employee if a user somehow has two rows
      const existing = m.get(r.user_id);
      const rank = (x: string) =>
        (({ super_admin: 0, admin: 1, manager: 2, employee: 3 }) as any)[x] ?? 4;
      if (!existing || rank(r.role) < rank(existing)) m.set(r.user_id, r.role);
    });
    return (id: string) => m.get(id) ?? "employee";
  }, [userRoles]);

  const plotById = useMemo(() => {
    const m = new Map<string, any>();
    (plots ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [plots]);

  const employeeNameOf = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = profileById.get(id);
    return p?.full_name || p?.email || "Unknown";
  };

  const projectById = useMemo(() => {
    const m = new Map<string, ProjectOption>();
    (projectsList ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [projectsList]);

  const projectNameOf = (id: string | null | undefined) =>
    (id && projectById.get(id)?.name) || "Project";

  const plotNumberOf = (lead: LeadRow) =>
    lead.plot_id ? plotById.get(lead.plot_id)?.plot_number as string | undefined : undefined;

  const plotLabelOf = (lead: LeadRow) => {
    // General lead (no plot assigned)
    if (!lead.plot_id && !lead.project_id) {
      return "General Lead — Unmapped";
    }
    const plot = plotById.get(lead.plot_id!);
    if (!plot) {
      // Has project but no plot (shouldn't happen but handle gracefully)
      if (lead.project_id) return projectNameOf(lead.project_id);
      return undefined;
    }
    const projectName = (plot as any).projects?.name;
    return projectName ? `${projectName} · Plot ${plot.plot_number}` : `Plot ${plot.plot_number}`;
  };

  const allLeads = useMemo(() => leads ?? [], [leads]);

  // Separate general leads (no plot/project) from plot leads
  const generalLeads = useMemo(() => allLeads.filter(l => !l.plot_id && !l.project_id), [allLeads]);
  const plotLeads = useMemo(() => allLeads.filter(l => l.plot_id && l.project_id), [allLeads]);

  // Filter leads based on lead type filter
  const filteredLeadsByType = useMemo(() => {
    if (leadTypeFilter === "general") return generalLeads;
    if (leadTypeFilter === "plot") return plotLeads;
    return allLeads;
  }, [leadTypeFilter, generalLeads, plotLeads, allLeads]);

  const orgStats = useMemo(() => computeStats(filteredLeadsByType), [filteredLeadsByType]);

  // ---- Build manager teams (admin only needs the full breakdown) ----
  const teamSummaries: TeamSummary[] = useMemo(() => {
    if (!isAdmin) return [];
    const managers = (profiles ?? []).filter((p) => roleOf(p.id) === "manager");
    return managers
      .map((mgr) => {
        const employeeIds = new Set(
          (profiles ?? []).filter((p) => p.manager_id === mgr.id).map((p) => p.id),
        );
        const scopeIds = new Set([mgr.id, ...employeeIds]);
        const teamLeads = allLeads.filter((l) => l.created_by && scopeIds.has(l.created_by));
        const s = computeStats(teamLeads);
        return {
          managerId: mgr.id,
          managerName: mgr.full_name || mgr.email || "Manager",
          employeeCount: employeeIds.size,
          leadCount: s.total,
          hotCount: s.hot,
          wonCount: s.won,
        };
      })
      .sort((a, b) => b.leadCount - a.leadCount);
  }, [isAdmin, profiles, roleOf, allLeads]);

  const unassignedSummary: TeamSummary | null = useMemo(() => {
    if (!isAdmin) return null;
    const unassignedEmployees = (profiles ?? []).filter(
      (p) => !p.manager_id && roleOf(p.id) === "employee",
    );
    const ids = new Set(unassignedEmployees.map((p) => p.id));
    const teamLeads = allLeads.filter((l) => l.created_by && ids.has(l.created_by));
    return {
      managerId: UNASSIGNED_KEY,
      managerName: "Unassigned",
      employeeCount: unassignedEmployees.length,
      leadCount: teamLeads.length,
      hotCount: 0,
      wonCount: 0,
    };
  }, [isAdmin, profiles, roleOf, allLeads]);

  // ---- Resolve the "active" team (either drilled into, or the manager's own) ----
  const activeManagerId = isManager ? userId : selectedManagerId;

  const activeTeam = useMemo(() => {
    if (!activeManagerId) return null;
    if (activeManagerId === UNASSIGNED_KEY) {
      const unassignedEmployees = (profiles ?? []).filter(
        (p) => !p.manager_id && roleOf(p.id) === "employee",
      );
      return {
        name: "Unassigned",
        employees: unassignedEmployees,
        scopeIds: new Set(unassignedEmployees.map((p) => p.id)),
      };
    }
    const mgr = profileById.get(activeManagerId);
    const employees = (profiles ?? []).filter((p) => p.manager_id === activeManagerId);
    const scopeIds = new Set([activeManagerId, ...employees.map((p) => p.id)]);
    return { name: mgr?.full_name || mgr?.email || "Team", employees, scopeIds };
  }, [activeManagerId, profiles, profileById, roleOf]);

  const teamLeads = useMemo(() => {
    if (!activeTeam) return [];
    const leads = allLeads.filter((l) => l.created_by && activeTeam.scopeIds.has(l.created_by));
    return leads.filter(l => {
      if (leadTypeFilter === "general") return !l.plot_id && !l.project_id;
      if (leadTypeFilter === "plot") return l.plot_id && l.project_id;
      return true;
    });
  }, [activeTeam, allLeads, leadTypeFilter]);

  const scopedLeads = useMemo(() => {
    if (selectedEmployeeId && selectedEmployeeId !== "ALL")
      return teamLeads.filter((l) => l.created_by === selectedEmployeeId);
    return teamLeads;
  }, [teamLeads, selectedEmployeeId]);

  const employeeSummaries: EmployeeSummary[] = useMemo(() => {
    if (!activeTeam) return [];
    return activeTeam.employees
      .map((e) => {
        const eLeads = allLeads.filter((l) => l.created_by === e.id);
        const s = computeStats(eLeads);
        return {
          employeeId: e.id,
          employeeName: e.full_name || e.email || "Employee",
          leadCount: s.total,
          hotCount: s.hot,
          wonCount: s.won,
        };
      })
      .sort((a, b) => b.leadCount - a.leadCount);
  }, [activeTeam, allLeads]);

  const myLeads = useMemo(
    () => {
      const leads = allLeads.filter((l) => l.created_by === userId);
      return leads.filter(l => {
        if (leadTypeFilter === "general") return !l.plot_id && !l.project_id;
        if (leadTypeFilter === "plot") return l.plot_id && l.project_id;
        return true;
      });
    },
    [allLeads, userId, leadTypeFilter],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["all_plot_leads"] });
    qc.invalidateQueries({ queryKey: ["plot-leads"] });
    qc.invalidateQueries({ queryKey: ["plots"] });
    qc.invalidateQueries({ queryKey: ["plot-purchaser"] });
    qc.invalidateQueries({ queryKey: ["project-bookings"] });
    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["installment-bookings"] });
  };

  const createLead = useMutation({
    mutationFn: async (values: NewLeadValues) => {
      const { error } = await (supabase as any).from("plot_leads").insert({
        ...values,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead added");
      setNewLeadOpen(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to add lead"),
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<LeadFormValues> }) => {
      const { error } = await (supabase as any).from("plot_leads").update(values).eq("id", id);
      if (error) throw error;

      const updateData: Record<string, any> = {};
      if (values.name) updateData.customer_name = values.name;
      if (values.phone) updateData.customer_phone = values.phone;
      if (values.email !== undefined) updateData.customer_email = values.email || null;

      if (Object.keys(updateData).length > 0) {
        await (supabase as any).from("bookings").update(updateData).eq("lead_id", id);
      }
    },
    onSuccess: () => {
      toast.success("Lead updated");
      setEditingLead(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update lead"),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status, fromStatus }: { id: string; status: LeadStatus; fromStatus?: string }) => {
      const { error } = await (supabase as any).from("plot_leads").update({ status }).eq("id", id);
      if (error) throw error;

      await (supabase as any).from("lead_activities").insert({
        lead_id: id,
        activity_type: "stage_change",
        from_status: fromStatus ?? null,
        to_status: status,
        performed_by: userId,
      });
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message ?? "Failed to update status"),
  });

  const submitContactInfo = useMutation({
    mutationFn: async ({
      id,
      channel,
      notes,
      budget,
      meetingDate,
      meetingLocation,
      fromStatus,
    }: {
      id: string;
      channel: string;
      notes: string;
      budget?: number;
      meetingDate?: string;
      meetingLocation?: string;
      fromStatus?: string;
    }) => {
      const updatePayload: any = {
        status: "contacted",
        contacted_at: new Date().toISOString(),
        contacted_channel: channel,
        contacted_notes: notes,
      };
      if (budget !== undefined) {
        updatePayload.budget = budget;
      }
      if (meetingDate) {
        updatePayload.meeting_date = new Date(meetingDate).toISOString();
      }
      if (meetingLocation) {
        updatePayload.meeting_location = meetingLocation;
      }

      const { error } = await (supabase as any).from("plot_leads").update(updatePayload).eq("id", id);
      if (error) throw error;

      await (supabase as any).from("lead_activities").insert({
        lead_id: id,
        activity_type: "contacted",
        from_status: fromStatus ?? "new",
        to_status: "contacted",
        channel,
        notes,
        performed_by: userId,
      });
    },
    onSuccess: () => {
      toast.success("Lead moved to Contacted stage");
      invalidate();
      setContactDialogLead(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save contact information"),
  });

  const handleStatusChange = (id: string, newStatus: LeadStatus) => {
    const targetLead = (leads ?? []).find((l) => l.id === id);
    if (!targetLead) return;

    if (!isAllowedStageTransition(targetLead.status, newStatus)) {
      const currentIdx = LEAD_STATUS_ORDER.indexOf(targetLead.status);
      const nextRequired = LEAD_STATUS_ORDER[currentIdx + 1];
      toast.warning(
        `⚠️ Strict Cycle Rule: Cannot skip from ${LEAD_STATUS_LABEL[targetLead.status]} to ${LEAD_STATUS_LABEL[newStatus]}. Please complete ${LEAD_STATUS_LABEL[nextRequired]} stage first!`
      );
      setViewingLead(targetLead);
      return;
    }

    if (newStatus === "negotiating" && !targetLead.plot_id) {
      toast.warning(`⚠️ Site Mapping Required: Lead ${targetLead.name} must be mapped to a plot site before moving to Negotiating stage.`);
      setViewingLead(targetLead);
      return;
    }

    if (newStatus === "converted") {
      if (!targetLead.plot_id) {
        toast.warning(`⚠️ Site Mapping Required: Please map ${targetLead.name} to a site/plot before converting to a booking.`);
        setViewingLead(targetLead);
        return;
      }
      window.location.href = `/plots/${targetLead.plot_id}/book/checkout?leadId=${targetLead.id}`;
      return;
    }

    if ((newStatus === "contacted" || newStatus === "meeting_scheduled" || newStatus === "negotiating") && targetLead) {
      setViewingLead(targetLead);
      toast.info(`Please complete stage details to transition from ${LEAD_STATUS_LABEL[targetLead.status]} → ${LEAD_STATUS_LABEL[newStatus]}`);
      return;
    }
    setStatus.mutate({ id, status: newStatus, fromStatus: targetLead.status });
  };

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any)
        .from("plot_leads")
        .delete()
        .eq("id", id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Unable to delete lead. You may not have permission or the lead was not found.");
      }
    },
    onSuccess: () => {
      toast.success("Lead removed");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to remove lead"),
  });

  const transferLead = useMutation({
    mutationFn: async ({ id, newEmployeeId }: { id: string; newEmployeeId: string }) => {
      const { error } = await (supabase as any)
        .from("plot_leads")
        .update({ created_by: newEmployeeId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead transferred");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to transfer lead"),
  });

  const mapLeadToPlot = useMutation({
    mutationFn: async ({ id, plotId, projectId }: { id: string; plotId: string; projectId: string }) => {
      const { error } = await (supabase as any)
        .from("plot_leads")
        .update({ plot_id: plotId, project_id: projectId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead mapped to plot");
      setMappingLead(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to map lead"),
  });

  const canManageLead = (lead: LeadRow) =>
    isAdmin || lead.created_by === userId || lead.assigned_to === userId;

  const transferOptionsFor = (lead: LeadRow): EmployeeOption[] => {
    if (!isAdmin) return [];
    const pool = activeTeam ? activeTeam.employees : (profiles ?? []);
    return pool
      .filter((p) => p.id !== lead.created_by)
      .map((p) => ({ id: p.id, name: p.full_name || p.email || "Employee" }));
  };

  function goToTeams() {
    setView("teams");
    setSelectedManagerId(null);
    setSelectedEmployeeId(null);
  }
  function goToTeam(managerId: string) {
    setView("team");
    setSelectedManagerId(managerId);
    setSelectedEmployeeId(null);
  }
  function goToEmployee(employeeId: string) {
    setView("employee");
    setSelectedEmployeeId(employeeId);
  }
  function goToAll() {
    setView("all");
    setSelectedManagerId(null);
    setSelectedEmployeeId(null);
  }

  const detailDialog = (
    <LeadDetailDialog
      lead={viewingLead}
      employeeName={employeeNameOf(viewingLead?.created_by ?? null)}
      plotNumber={viewingLead ? plotNumberOf(viewingLead) : undefined}
      projectName={viewingLead ? projectNameOf(viewingLead.project_id) : undefined}
      canManage={viewingLead ? canManageLead(viewingLead) : false}
      userId={userId}
      canCaptureVisit={
        !!viewingLead && (viewingLead.assigned_to ?? viewingLead.created_by) === userId
      }
      canReviewVisits={isAdmin}
      onOpenChange={(o) => !o && setViewingLead(null)}
      onStatusChange={(id, status) => handleStatusChange(id, status)}
      onEdit={(lead) => {
        setViewingLead(null);
        setEditingLead(lead);
      }}
      onMapPlot={(lead) => {
        setViewingLead(null);
        setMappingLead(lead);
      }}
    />
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading leads…
      </div>
    );
  }

  const addLeadButton = (
    <Button
      className="rounded-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white border-transparent shadow-md hover:shadow-lg transition-all duration-300"
      onClick={() => setNewLeadOpen(true)}
    >
      <Plus className="h-4 w-4 mr-2" /> Add lead
    </Button>
  );

  // ---------------- Plain employee: just their own leads ----------------
  if (isPlainEmployee) {
    const stats = computeStats(myLeads);
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-display text-3xl">My leads</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {stats.total} lead{stats.total === 1 ? "" : "s"} you've added
            </p>
          </div>
          {addLeadButton}
        </div>

        <LeadsStatCards {...stats} />

        {/* Lead Type Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
            <Filter className="h-3 w-3" /> Filter:
          </span>
          <button
            onClick={() => setLeadTypeFilter("all")}
            className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              leadTypeFilter === "all"
                ? "bg-terracotta text-white border-terracotta shadow-sm"
                : "bg-card border-border/60 text-muted-foreground hover:border-terracotta/40"
            }`}
          >
            All Leads
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${leadTypeFilter === "all" ? "bg-white/20" : "bg-muted"}`}>
              {allLeads.length}
            </span>
          </button>
          <button
            onClick={() => setLeadTypeFilter("plot")}
            className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              leadTypeFilter === "plot"
                ? "bg-terracotta text-white border-terracotta shadow-sm"
                : "bg-card border-border/60 text-muted-foreground hover:border-terracotta/40"
            }`}
          >
            <MapPin className="h-3 w-3" /> Plot Leads
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${leadTypeFilter === "plot" ? "bg-white/20" : "bg-muted"}`}>
              {plotLeads.length}
            </span>
          </button>
          <button
            onClick={() => setLeadTypeFilter("general")}
            className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              leadTypeFilter === "general"
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : generalLeads.length > 0
                  ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  : "bg-card border-border/60 text-muted-foreground hover:border-terracotta/40"
            }`}
          >
            <Users className="h-3 w-3" /> General Leads
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${leadTypeFilter === "general" ? "bg-white/20" : generalLeads.length > 0 ? "bg-blue-200" : "bg-muted"}`}>
              {generalLeads.length}
            </span>
          </button>
          {generalLeads.length > 0 && leadTypeFilter !== "general" && (
            <span className="text-[10px] text-blue-600 font-medium animate-pulse shrink-0">
              {generalLeads.length} unmapped lead{generalLeads.length > 1 ? "s" : ""} need mapping
            </span>
          )}
        </div>

        <LeadsBoard
          leads={myLeads}
          employeeNameOf={employeeNameOf}
          plotLabelOf={plotLabelOf}
          canManageLead={canManageLead}
          projects={projectsList}
          onOpenDetail={setViewingLead}
          onStatusChange={(id, status) => handleStatusChange(id, status)}
          onEdit={setEditingLead}
          onMapToPlot={setMappingLead}
        />

        <NewLeadDialog
          open={newLeadOpen}
          pending={createLead.isPending}
          onOpenChange={setNewLeadOpen}
          onSubmit={(v) => createLead.mutate(v)}
        />
        <LeadFormDialog
          open={!!editingLead}
          mode="edit"
          initial={editingLead}
          pending={updateLead.isPending}
          onSubmit={(values) => editingLead && updateLead.mutate({ id: editingLead.id, values })}
          onOpenChange={(o) => !o && setEditingLead(null)}
        />
        <MapLeadToPlotDialog
          open={!!mappingLead}
          lead={mappingLead}
          pending={mapLeadToPlot.isPending}
          onOpenChange={(o) => !o && setMappingLead(null)}
          onSubmit={(plotId, projectId) => mappingLead && mapLeadToPlot.mutate({ id: mappingLead.id, plotId, projectId })}
        />
        {detailDialog}
      </div>
    );
  }

  // ---------------- Manager: land straight on their own team ----------------
  if (isManager) {
    const isShowingEmployee = view === "employee" && selectedEmployeeId;
    const stats = isShowingEmployee ? computeStats(scopedLeads) : computeStats(teamLeads);

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-display text-3xl">My team's leads</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {stats.total} leads{" "}
              {isShowingEmployee
                ? "for this selection"
                : `across ${employeeSummaries.length} executive${employeeSummaries.length === 1 ? "" : "s"}`}
            </p>
          </div>
          {addLeadButton}
        </div>

        {isShowingEmployee && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
            <button
              onClick={() => {
                setView("teams");
                setSelectedEmployeeId(null);
              }}
              className="inline-flex items-center gap-1.5 hover:text-terracotta"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Team overview
            </button>
            <span>/</span>
            <span className="font-medium text-foreground">
              {selectedEmployeeId === "ALL" ? "Whole team" : employeeNameOf(selectedEmployeeId)}
            </span>
          </div>
        )}

        <LeadsStatCards {...stats} />

        {/* Lead Type Filter Chips */}
        {isShowingEmployee && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
              <Filter className="h-3 w-3" /> Filter:
            </span>
            <button
              onClick={() => setLeadTypeFilter("all")}
              className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                leadTypeFilter === "all"
                  ? "bg-terracotta text-white border-terracotta shadow-sm"
                  : "bg-card border-border/60 text-muted-foreground hover:border-terracotta/40"
              }`}
            >
              All Leads
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${leadTypeFilter === "all" ? "bg-white/20" : "bg-muted"}`}>
                {allLeads.length}
              </span>
            </button>
            <button
              onClick={() => setLeadTypeFilter("plot")}
              className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                leadTypeFilter === "plot"
                  ? "bg-terracotta text-white border-terracotta shadow-sm"
                  : "bg-card border-border/60 text-muted-foreground hover:border-terracotta/40"
              }`}
            >
              <MapPin className="h-3 w-3" /> Plot Leads
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${leadTypeFilter === "plot" ? "bg-white/20" : "bg-muted"}`}>
                {plotLeads.length}
              </span>
            </button>
            <button
              onClick={() => setLeadTypeFilter("general")}
              className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                leadTypeFilter === "general"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : generalLeads.length > 0
                    ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    : "bg-card border-border/60 text-muted-foreground hover:border-terracotta/40"
              }`}
            >
              <Users className="h-3 w-3" /> General Leads
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${leadTypeFilter === "general" ? "bg-white/20" : generalLeads.length > 0 ? "bg-blue-200" : "bg-muted"}`}>
                {generalLeads.length}
              </span>
            </button>
            {generalLeads.length > 0 && leadTypeFilter !== "general" && (
              <span className="text-[10px] text-blue-600 font-medium animate-pulse shrink-0">
                {generalLeads.length} unmapped lead{generalLeads.length > 1 ? "s" : ""} need mapping
              </span>
            )}
          </div>
        )}

        {!isShowingEmployee ? (
          <EmployeesOverview
            employees={employeeSummaries}
            totalLeads={teamLeads.length}
            onSelectEmployee={goToEmployee}
            onSelectAll={() => goToEmployee("ALL")}
          />
        ) : (
          <LeadsBoard
            leads={scopedLeads}
            employeeNameOf={employeeNameOf}
            plotLabelOf={plotLabelOf}
            canManageLead={canManageLead}
            projects={projectsList}
            onOpenDetail={setViewingLead}
            onStatusChange={(id, status) => handleStatusChange(id, status)}
            onEdit={setEditingLead}
            onMapToPlot={setMappingLead}
          />
        )}

        <NewLeadDialog
          open={newLeadOpen}
          pending={createLead.isPending}
          onOpenChange={setNewLeadOpen}
          onSubmit={(v) => createLead.mutate(v)}
        />
        <LeadFormDialog
          open={!!editingLead}
          mode="edit"
          initial={editingLead}
          pending={updateLead.isPending}
          onSubmit={(values) => editingLead && updateLead.mutate({ id: editingLead.id, values })}
          onOpenChange={(o) => !o && setEditingLead(null)}
        />
        <MapLeadToPlotDialog
          open={!!mappingLead}
          lead={mappingLead}
          pending={mapLeadToPlot.isPending}
          onOpenChange={(o) => !o && setMappingLead(null)}
          onSubmit={(plotId, projectId) => mappingLead && mapLeadToPlot.mutate({ id: mappingLead.id, plotId, projectId })}
        />
        {detailDialog}
      </div>
    );
  }

  // ---------------- Admin / super admin: full Teams CRM ----------------
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-display text-3xl">Leads CRM</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {orgStats.total} leads across your team
          </p>
        </div>
        {addLeadButton}
      </div>

      {view === "teams" && (
        <>
          <LeadsStatCards {...orgStats} />
          <TeamsOverview
            teams={teamSummaries}
            unassigned={unassignedSummary}
            totalLeads={orgStats.total}
            onSelectTeam={goToTeam}
            onSelectAll={goToAll}
            onSelectUnassigned={() => goToTeam(UNASSIGNED_KEY)}
          />
        </>
      )}

      {view === "all" && (
        <div className="space-y-4">
          <LeadsStatCards {...orgStats} />
          <button
            onClick={goToTeams}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-terracotta"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to teams
          </button>

          {/* Lead Type Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
              <Filter className="h-3 w-3" /> Filter:
            </span>
            <button
              onClick={() => setLeadTypeFilter("all")}
              className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                leadTypeFilter === "all"
                  ? "bg-terracotta text-white border-terracotta shadow-sm"
                  : "bg-card border-border/60 text-muted-foreground hover:border-terracotta/40"
              }`}
            >
              All Leads
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${leadTypeFilter === "all" ? "bg-white/20" : "bg-muted"}`}>
                {allLeads.length}
              </span>
            </button>
            <button
              onClick={() => setLeadTypeFilter("plot")}
              className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                leadTypeFilter === "plot"
                  ? "bg-terracotta text-white border-terracotta shadow-sm"
                  : "bg-card border-border/60 text-muted-foreground hover:border-terracotta/40"
              }`}
            >
              <MapPin className="h-3 w-3" /> Plot Leads
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${leadTypeFilter === "plot" ? "bg-white/20" : "bg-muted"}`}>
                {plotLeads.length}
              </span>
            </button>
            <button
              onClick={() => setLeadTypeFilter("general")}
              className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                leadTypeFilter === "general"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : generalLeads.length > 0
                    ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    : "bg-card border-border/60 text-muted-foreground hover:border-terracotta/40"
              }`}
            >
              <Users className="h-3 w-3" /> General Leads
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${leadTypeFilter === "general" ? "bg-white/20" : generalLeads.length > 0 ? "bg-blue-200" : "bg-muted"}`}>
                {generalLeads.length}
              </span>
            </button>
            {generalLeads.length > 0 && leadTypeFilter !== "general" && (
              <span className="text-[10px] text-blue-600 font-medium animate-pulse shrink-0">
                {generalLeads.length} unmapped lead{generalLeads.length > 1 ? "s" : ""} need mapping
              </span>
            )}
          </div>

          <LeadsBoard
            leads={filteredLeadsByType}
            employeeNameOf={employeeNameOf}
            plotLabelOf={plotLabelOf}
            canManageLead={canManageLead}
            transferOptionsFor={transferOptionsFor}
            projects={projectsList}
            onOpenDetail={setViewingLead}
            onStatusChange={(id, status) => handleStatusChange(id, status)}
            onTransfer={(id, newEmployeeId) => transferLead.mutate({ id, newEmployeeId })}
            onEdit={setEditingLead}
            onDelete={(id) => deleteLead.mutate(id)}
            onMapToPlot={setMappingLead}
          />
        </div>
      )}

      {view === "team" && activeTeam && (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
            <button
              onClick={goToTeams}
              className="inline-flex items-center gap-1.5 hover:text-terracotta"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Teams
            </button>
            <span>/</span>
            <span className="font-medium text-foreground">{activeTeam.name}'s Team</span>
          </div>

          <LeadsStatCards {...computeStats(teamLeads)} />

          <EmployeesOverview
            employees={employeeSummaries}
            totalLeads={teamLeads.length}
            onSelectEmployee={goToEmployee}
            onSelectAll={() => goToEmployee("ALL")}
          />
        </div>
      )}

      {view === "employee" && activeTeam && selectedEmployeeId && (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
            <button
              onClick={goToTeams}
              className="inline-flex items-center gap-1.5 hover:text-terracotta"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Teams
            </button>
            <span>/</span>
            <button
              onClick={() => goToTeam(activeManagerId!)}
              className="inline-flex items-center gap-1.5 hover:text-terracotta"
            >
              {activeTeam.name}'s Team
            </button>
            <span>/</span>
            <span className="font-medium text-foreground">
              {selectedEmployeeId === "ALL" ? "Whole team" : employeeNameOf(selectedEmployeeId)}
            </span>
          </div>

          <LeadsStatCards {...computeStats(scopedLeads)} />

          {/* Lead Type Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
              <Filter className="h-3 w-3" /> Filter:
            </span>
            <button
              onClick={() => setLeadTypeFilter("all")}
              className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                leadTypeFilter === "all"
                  ? "bg-terracotta text-white border-terracotta shadow-sm"
                  : "bg-card border-border/60 text-muted-foreground hover:border-terracotta/40"
              }`}
            >
              All Leads
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${leadTypeFilter === "all" ? "bg-white/20" : "bg-muted"}`}>
                {allLeads.length}
              </span>
            </button>
            <button
              onClick={() => setLeadTypeFilter("plot")}
              className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                leadTypeFilter === "plot"
                  ? "bg-terracotta text-white border-terracotta shadow-sm"
                  : "bg-card border-border/60 text-muted-foreground hover:border-terracotta/40"
              }`}
            >
              <MapPin className="h-3 w-3" /> Plot Leads
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${leadTypeFilter === "plot" ? "bg-white/20" : "bg-muted"}`}>
                {plotLeads.length}
              </span>
            </button>
            <button
              onClick={() => setLeadTypeFilter("general")}
              className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                leadTypeFilter === "general"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : generalLeads.length > 0
                    ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    : "bg-card border-border/60 text-muted-foreground hover:border-terracotta/40"
              }`}
            >
              <Users className="h-3 w-3" /> General Leads
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${leadTypeFilter === "general" ? "bg-white/20" : generalLeads.length > 0 ? "bg-blue-200" : "bg-muted"}`}>
                {generalLeads.length}
              </span>
            </button>
            {generalLeads.length > 0 && leadTypeFilter !== "general" && (
              <span className="text-[10px] text-blue-600 font-medium animate-pulse shrink-0">
                {generalLeads.length} unmapped lead{generalLeads.length > 1 ? "s" : ""} need mapping
              </span>
            )}
          </div>

          <LeadsBoard
            leads={scopedLeads}
            employeeNameOf={employeeNameOf}
            plotLabelOf={plotLabelOf}
            canManageLead={canManageLead}
            transferOptionsFor={transferOptionsFor}
            projects={projectsList}
            onOpenDetail={setViewingLead}
            onStatusChange={(id, status) => handleStatusChange(id, status)}
            onTransfer={(id, newEmployeeId) => transferLead.mutate({ id, newEmployeeId })}
            onEdit={setEditingLead}
            onDelete={(id) => deleteLead.mutate(id)}
            onMapToPlot={setMappingLead}
          />
        </div>
      )}

      <NewLeadDialog
        open={newLeadOpen}
        pending={createLead.isPending}
        onOpenChange={setNewLeadOpen}
        onSubmit={(v) => createLead.mutate(v)}
      />
      <LeadFormDialog
        open={!!editingLead}
        mode="edit"
        initial={editingLead}
        pending={updateLead.isPending}
        onSubmit={(values) => editingLead && updateLead.mutate({ id: editingLead.id, values })}
        onOpenChange={(o) => !o && setEditingLead(null)}
      />
      <MapLeadToPlotDialog
        open={!!mappingLead}
        lead={mappingLead}
        pending={mapLeadToPlot.isPending}
        onOpenChange={(o) => !o && setMappingLead(null)}
        onSubmit={(plotId, projectId) => mappingLead && mapLeadToPlot.mutate({ id: mappingLead.id, plotId, projectId })}
      />
      {detailDialog}
    </div>
  );
}
