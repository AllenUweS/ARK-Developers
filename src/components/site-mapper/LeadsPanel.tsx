import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Users,
  Phone,
  Mail,
  Calendar,
  MapPin,
  IndianRupee,
  Pencil,
  Trash2,
  MessageCircle,
  BadgeCheck,
  KeyRound,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_ORDER,
  LEAD_STATUS_PALETTE,
  type LeadRow,
  type LeadStatus,
  type PlotRow,
} from "./types";
import { LeadFormDialog, type LeadFormValues } from "./LeadFormDialog";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function digitsOnly(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

function formatMeeting(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LeadsPanel({
  plot,
  isAdmin,
  userId,
  onBookForLead,
}: {
  plot: PlotRow;
  isAdmin: boolean;
  userId: string;
  onBookForLead: (leadId: string) => void;
}) {
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadRow | null>(null);

  const { data: leads, isLoading } = useQuery({
    queryKey: ["plot-leads", plot.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("plot_leads")
        .select("*")
        .eq("plot_id", plot.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadRow[];
    },
  });

  const createLead = useMutation({
    mutationFn: async (values: LeadFormValues) => {
      const { error } = await (supabase as any).from("plot_leads").insert({
        plot_id: plot.id,
        project_id: plot.project_id,
        created_by: userId,
        ...values,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead added");
      setFormOpen(false);
      qc.invalidateQueries({ queryKey: ["plot-leads", plot.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to add lead"),
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<LeadFormValues> }) => {
      const { error } = await (supabase as any).from("plot_leads").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead updated");
      setFormOpen(false);
      setEditingLead(null);
      qc.invalidateQueries({ queryKey: ["plot-leads", plot.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update lead"),
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("plot_leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead removed");
      qc.invalidateQueries({ queryKey: ["plot-leads", plot.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to remove lead"),
  });

  const reserveForLead = useMutation({
    mutationFn: async (lead: LeadRow) => {
      const { error: plotErr } = await supabase
        .from("plots")
        .update({ status: "reserved", selected_lead_id: lead.id } as any)
        .eq("id", plot.id);
      if (plotErr) throw plotErr;
      const { error: leadErr } = await (supabase as any)
        .from("plot_leads")
        .update({ status: "negotiating" })
        .eq("id", lead.id);
      if (leadErr) throw leadErr;
    },
    onSuccess: (_data, lead) => {
      toast.success(`Plot reserved for ${lead.name}`);
      qc.invalidateQueries({ queryKey: ["plots", plot.project_id] });
      qc.invalidateQueries({ queryKey: ["plot-leads", plot.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to reserve plot"),
  });

  const setLeadStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const { error } = await (supabase as any).from("plot_leads").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plot-leads", plot.id] }),
    onError: (e: any) => toast.error(e.message ?? "Failed to update status"),
  });

  const sorted = useMemo(() => {
    if (!leads) return [];
    // Selected lead first, then anything with an upcoming meeting, then the rest.
    return [...leads].sort((a, b) => {
      if (a.id === plot.selected_lead_id) return -1;
      if (b.id === plot.selected_lead_id) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [leads, plot.selected_lead_id]);

  const canManage = (lead: LeadRow) => isAdmin || lead.created_by === userId;

  function submitForm(values: LeadFormValues) {
    if (editingLead) {
      updateLead.mutate({ id: editingLead.id, values });
    } else {
      createLead.mutate(values);
    }
  }

  return (
    <div className="border rounded-lg bg-background overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-muted/20"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-3.5 w-3.5 text-terracotta" />
          Leads
          {leads && leads.length > 0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-terracotta/10 text-terracotta">
              {leads.length}
            </span>
          )}
        </span>
        {collapsed ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="p-3 space-y-2.5">
          <Button
            size="sm"
            variant="outline"
            className="w-full border-dashed"
            onClick={() => {
              setEditingLead(null);
              setFormOpen(true);
            }}
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add lead
          </Button>

          {isLoading && (
            <p className="text-xs text-muted-foreground text-center py-4">Loading leads…</p>
          )}

          {!isLoading && sorted.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              No leads yet. Add the first interested buyer for this plot.
            </p>
          )}

          <ul className="space-y-2.5">
            {sorted.map((lead) => {
              const palette = LEAD_STATUS_PALETTE[lead.status];
              const isSelected = plot.selected_lead_id === lead.id;
              return (
                <li
                  key={lead.id}
                  className={`group relative flex items-center justify-between p-2 -mx-2 rounded-md border transition-all ${isSelected ? "border-terracotta/40 bg-terracotta/[0.04]" : "border-transparent hover:bg-muted/40"
                    }`}
                  tabIndex={0}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Avatar className={`h-7 w-7 shrink-0 border border-background shadow-sm ${isSelected ? 'ring-1 ring-terracotta ring-offset-1' : ''}`}>
                      <AvatarFallback className="text-[9px] font-semibold bg-muted text-muted-foreground">
                        {initials(lead.name) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 leading-tight">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold truncate text-foreground">{lead.name}</span>
                        {isSelected && (
                          <BadgeCheck className="h-3 w-3 text-terracotta shrink-0" />
                        )}
                        {lead.meeting_date && (
                          <Calendar className="h-3 w-3 text-violet-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground truncate mt-0.5">
                        <span>{lead.phone}</span>
                        {lead.budget != null && (
                          <>
                            <span>·</span>
                            <span>₹{Number(lead.budget).toLocaleString("en-IN")}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions (Hover) */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-md p-1 rounded-lg shadow-sm border border-border/50 z-10">
                    {plot.status === "available" && (
                      <>
                        {isAdmin && (
                          <button
                            className="h-6 px-2.5 text-[10px] font-medium rounded-md border bg-background hover:bg-muted transition-colors flex items-center"
                            onClick={() => reserveForLead.mutate(lead)}
                          >
                            <KeyRound className="h-2.5 w-2.5 mr-1" /> Reserve
                          </button>
                        )}
                        <button
                          className="h-6 px-2.5 text-[10px] font-medium rounded-md bg-terracotta text-accent-foreground hover:bg-terracotta/90 transition-colors"
                          onClick={() => onBookForLead(lead.id)}
                        >
                          Book
                        </button>
                      </>
                    )}
                    {isSelected && plot.status === "reserved" && (
                      <button
                        className="h-6 px-2.5 text-[10px] font-medium rounded-md bg-terracotta text-accent-foreground hover:bg-terracotta/90 transition-colors"
                        onClick={() => onBookForLead(lead.id)}
                      >
                        Convert
                      </button>
                    )}
                    {canManage(lead) && (
                      <button
                        className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors"
                        title="Edit lead"
                        onClick={() => {
                          setEditingLead(lead);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    {canManage(lead) && isAdmin && (
                      <button
                        className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-red-50 hover:text-red-600 text-muted-foreground transition-colors"
                        title="Delete lead"
                        onClick={() => {
                          if (confirm(`Remove lead "${lead.name}"?`)) deleteLead.mutate(lead.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Status Dropdown (Hidden on hover when actions appear) */}
                  <div className="group-hover:opacity-0 focus-within:opacity-0 transition-opacity shrink-0 ml-2">
                    <Select
                      value={lead.status}
                      onValueChange={(v) => setLeadStatus.mutate({ id: lead.id, status: v as LeadStatus })}
                      disabled={!canManage(lead) || lead.status === "converted"}
                    >
                      <SelectTrigger
                        className={`h-6 w-auto gap-1 border-0 px-2 text-[10px] font-medium capitalize rounded-full ${palette.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${palette.dot}`} />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_STATUS_ORDER.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {LEAD_STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <LeadFormDialog
        open={formOpen}
        mode={editingLead ? "edit" : "create"}
        initial={editingLead}
        pending={createLead.isPending || updateLead.isPending}
        onSubmit={submitForm}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditingLead(null);
        }}
      />
    </div>
  );
}
