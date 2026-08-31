import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  Printer,
  Plus,
  RotateCcw,
  CheckCircle2,
  FileCheck,
  Building2,
  User,
  Clock,
  Search,
  Sparkles,
  ArrowRight,
  XCircle,
  ShieldCheck,
  Ban,
  MessageCircle,
  Copy,
  Check,
  Calendar,
  Phone,
  Mail,
  MapPin,
  FileText,
  HelpCircle,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  History,
  Send,
} from "lucide-react";
import { NoticeLetterModal } from "@/components/cancellations/NoticeLetterModal";

export const Route = createFileRoute("/_authenticated/cancellations")({
  component: CancellationsWorkspace,
});

function money(val: any) {
  return `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

function getGraceStatus(sentAtIso: string, graceDays: number) {
  if (!sentAtIso) return null;
  const sentDate = new Date(sentAtIso);
  const deadline = new Date(sentDate.getTime() + graceDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return {
      expired: true,
      label: `Grace Period Expired (${Math.abs(diffDays)}d ago)`,
      deadlineStr: formatDate(deadline.toISOString()),
      daysRemaining: 0,
    };
  }

  return {
    expired: false,
    label: `${diffDays} Day${diffDays > 1 ? "s" : ""} Remaining`,
    deadlineStr: formatDate(deadline.toISOString()),
    daysRemaining: diffDays,
  };
}

function CancellationsWorkspace() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [expandedRemarksId, setExpandedRemarksId] = useState<string | null>(null);

  // Modals state
  const [initiateModalOpen, setInitiateModalOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [cancellationType, setCancellationType] = useState<"customer_requested" | "emi_default">("customer_requested");
  const [reasonNotes, setReasonNotes] = useState("");

  // Action Confirmation Modals state with remarks
  const [confirmNotice2Item, setConfirmNotice2Item] = useState<any>(null);
  const [notice2RemarkInput, setNotice2RemarkInput] = useState("");

  const [confirmNotice3Item, setConfirmNotice3Item] = useState<any>(null);
  const [notice3RemarkInput, setNotice3RemarkInput] = useState("");

  const [confirmRevokeItem, setConfirmRevokeItem] = useState<any>(null);
  const [revokeRemarkInput, setRevokeRemarkInput] = useState("");

  // Notice Letter Modal state
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printCancellation, setPrintCancellation] = useState<any>(null);
  const [printBooking, setPrintBooking] = useState<any>(null);
  const [printStage, setPrintStage] = useState<1 | 2 | 3>(1);

  // Fetch Current User
  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  // Fetch Profiles for Admin Names Mapping
  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles-for-cancellations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email, phone");
      if (error) return [];
      return data || [];
    },
  });

  const profileMap = useMemo(() => {
    return new Map<string, any>(profiles.map((p: any) => [p.id, p]));
  }, [profiles]);

  // Fetch Projects for Filter
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-cancellations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name, code").order("name");
      if (error) return [];
      return data || [];
    },
  });

  // Fetch Active Bookings for Initiation Dropdown
  const { data: activeBookings = [] } = useQuery({
    queryKey: ["active_bookings_for_cancellation"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bookings")
        .select("*, plots(id, plot_number, area_sqft, projects(id, name, code))")
        .in("status", ["pending", "approved", "on_hold"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch Cancellation Workflows
  const { data: cancellations = [], isLoading } = useQuery({
    queryKey: ["booking_cancellations_list"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("booking_cancellations")
        .select(`
          *,
          bookings(*, plots(*, projects(id, name, code, location)))
        `)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Filter Cancellations
  const filteredCancellations = useMemo(() => {
    return cancellations.filter((c: any) => {
      // Tab Filter
      if (activeTab === "notice_1" && (c.notice_stage !== 1 || c.status === "revoked")) return false;
      if (activeTab === "notice_2" && (c.notice_stage !== 2 || c.status === "revoked")) return false;
      if (activeTab === "notice_3" && (c.notice_stage !== 3 || c.status === "revoked")) return false;
      if (activeTab === "revoked" && c.status !== "revoked") return false;

      // Project Filter
      const b = c.bookings || {};
      const prjId = b.plots?.projects?.id || b.plots?.project_id;
      if (selectedProject !== "all" && prjId !== selectedProject) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCustomer = (b.customer_name || "").toLowerCase().includes(q);
        const matchPhone = (b.customer_phone || "").toLowerCase().includes(q);
        const matchPlot = (b.plots?.plot_number || "").toLowerCase().includes(q);
        const matchProject = (b.plots?.projects?.name || "").toLowerCase().includes(q);
        const matchReason = (c.reason || "").toLowerCase().includes(q);
        const matchNotice2 = (c.notice_2_remarks || "").toLowerCase().includes(q);
        const matchNotice3 = (c.notice_3_remarks || "").toLowerCase().includes(q);
        return matchCustomer || matchPhone || matchPlot || matchProject || matchReason || matchNotice2 || matchNotice3;
      }

      return true;
    });
  }, [cancellations, activeTab, selectedProject, searchQuery]);

  // Initiate Notice 1 Mutation
  const initiateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBookingId) throw new Error("Please select a booking");
      const targetBkg = activeBookings.find((b: any) => b.id === selectedBookingId);
      if (!targetBkg) throw new Error("Selected booking not found");

      const { error } = await (supabase as any).from("booking_cancellations").insert({
        booking_id: targetBkg.id,
        plot_id: targetBkg.plot_id,
        cancellation_type: cancellationType,
        notice_stage: 1,
        status: "notice_1_issued",
        reason: reasonNotes,
        notice_1_sent_at: new Date().toISOString(),
        notice_1_sent_by: user?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notice #1 issued successfully!");
      setInitiateModalOpen(false);
      setSelectedBookingId("");
      setReasonNotes("");
      qc.invalidateQueries({ queryKey: ["booking_cancellations_list"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to issue Notice #1"),
  });

  // Advance to Notice 2 Mutation
  const advanceToNotice2Mutation = useMutation({
    mutationFn: async ({ cancId, remarks }: { cancId: string; remarks: string }) => {
      const updatePayload: any = {
        notice_stage: 2,
        status: "notice_2_issued",
        notice_2_sent_at: new Date().toISOString(),
        notice_2_sent_by: user?.id,
        updated_at: new Date().toISOString(),
      };

      if (remarks) {
        updatePayload.notice_2_remarks = remarks;
      }

      const { error } = await (supabase as any)
        .from("booking_cancellations")
        .update(updatePayload)
        .eq("id", cancId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Advanced to Urgent Warning Notice #2!");
      setConfirmNotice2Item(null);
      setNotice2RemarkInput("");
      qc.invalidateQueries({ queryKey: ["booking_cancellations_list"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to advance notice"),
  });

  // Final Notice 3 & Site Release Mutation
  const finalizeNotice3Mutation = useMutation({
    mutationFn: async ({ canc, remarks }: { canc: any; remarks: string }) => {
      const bkgId = canc.booking_id;
      const plotId = canc.plot_id;

      // 1. Update Cancellation Workflow record
      const updatePayload: any = {
        notice_stage: 3,
        status: "notice_3_completed",
        notice_3_sent_at: new Date().toISOString(),
        notice_3_sent_by: user?.id,
        updated_at: new Date().toISOString(),
      };

      if (remarks) {
        updatePayload.notice_3_remarks = remarks;
      }

      const { error: cErr } = await (supabase as any)
        .from("booking_cancellations")
        .update(updatePayload)
        .eq("id", canc.id);

      if (cErr) throw cErr;

      // 2. Update Booking Status -> 'cancelled'
      const { error: bErr } = await supabase
        .from("bookings")
        .update({
          status: "cancelled",
          remarks: `[Notice #3 Finalized] Cancellation process completed on ${formatDate(
            new Date().toISOString()
          )}. Remarks: ${remarks || "Final plot release."}`,
        })
        .eq("id", bkgId);

      if (bErr) throw bErr;

      // 3. Reset Plot Status -> 'available' globally on Site Mapper!
      const { error: pErr } = await supabase
        .from("plots")
        .update({ status: "available", selected_lead_id: null } as any)
        .eq("id", plotId);

      if (pErr) throw pErr;
    },
    onSuccess: () => {
      toast.success(
        "🎉 Notice #3 Issued! Booking cancelled & Plot automatically reset to AVAILABLE globally!"
      );
      setConfirmNotice3Item(null);
      setNotice3RemarkInput("");
      qc.invalidateQueries({ queryKey: ["booking_cancellations_list"] });
      qc.invalidateQueries({ queryKey: ["plots"] });
      qc.invalidateQueries({ queryKey: ["all-plots"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to complete final notice"),
  });

  // Revoke Cancellation & Retain Plot Mutation
  const revokeMutation = useMutation({
    mutationFn: async ({ canc, remarks }: { canc: any; remarks: string }) => {
      const updatePayload: any = {
        notice_stage: 0,
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_by: user?.id,
        updated_at: new Date().toISOString(),
      };

      if (remarks) {
        updatePayload.revocation_remarks = remarks;
      }

      const { error } = await (supabase as any)
        .from("booking_cancellations")
        .update(updatePayload)
        .eq("id", canc.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cancellation process revoked! Plot retained and booking active.");
      setConfirmRevokeItem(null);
      setRevokeRemarkInput("");
      qc.invalidateQueries({ queryKey: ["booking_cancellations_list"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to revoke cancellation"),
  });

  const openNoticeLetter = (cancellation: any, stage: 1 | 2 | 3) => {
    setPrintCancellation(cancellation);
    setPrintBooking(cancellation.bookings);
    setPrintStage(stage);
    setPrintModalOpen(true);
  };

  const handleCopyPhone = (id: string, phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedPhoneId(id);
    toast.success(`Copied phone "${phone}" to clipboard`);
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  const handleSendWhatsAppNotice = (c: any, stage: number) => {
    const bkg = c.bookings || {};
    const plot = bkg.plots || {};
    const project = plot.projects || {};
    const phone = (bkg.customer_phone || "").replace(/[^0-9]/g, "");

    if (!phone) {
      toast.error("No valid phone number for customer");
      return;
    }

    const stageLabel =
      stage === 1
        ? "Notice #1 (Initial Intimation & 15-Day Grace Period)"
        : stage === 2
        ? "Notice #2 (Urgent Warning Notice & Final 7-Day Grace Period)"
        : "Notice #3 (Final Termination & Cancellation Notice)";

    const deadline =
      stage === 1
        ? getGraceStatus(c.notice_1_sent_at, 15)?.deadlineStr
        : stage === 2
        ? getGraceStatus(c.notice_2_sent_at, 7)?.deadlineStr
        : formatDate(new Date().toISOString());

    const message = `*OFFICIAL LEGAL NOTICE — ARK BUILDERS & DEVELOPERS*

Dear *${bkg.customer_name || "Valued Customer"}*,

This is to notify you regarding *Plot #${plot.plot_number || "Site"}* in *${project.name || "Project"}*.

*Notice Details:*
• Notice Stage: *${stageLabel}*
• Total Agreement Value: *${money(bkg.total_price)}*
• Total Amount Paid: *${money(bkg.advance_paid || bkg.booking_amount)}*
• Outstanding Balance: *${money(Number(bkg.total_price || 0) - Number(bkg.advance_paid || 0))}*
• Grace Period Deadline: *${deadline}*

*Remarks:*
"${c.reason || c.notice_2_remarks || "Please settle overdue payments immediately to avoid cancellation."}"

Please contact our office at your earliest convenience to regularize your account.`;

    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/91${phone.slice(-10)}?text=${encoded}`;
    window.open(waUrl, "_blank");
    toast.success("WhatsApp notice draft prepared!");
  };

  const countNotice1 = cancellations.filter((c: any) => c.notice_stage === 1 && c.status !== "revoked").length;
  const countNotice2 = cancellations.filter((c: any) => c.notice_stage === 2 && c.status !== "revoked").length;
  const countNotice3 = cancellations.filter((c: any) => c.notice_stage === 3 && c.status !== "revoked").length;
  const countRevoked = cancellations.filter((c: any) => c.status === "revoked").length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-display">
                  Cancellations & 3-Notice Escalation Vault
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                  Legal Compliance Engine
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Audit trail of Notice #1, Notice #2, and final Notice #3 cancellation lifecycles with automated Site Mapper release.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => setInitiateModalOpen(true)}
          className="bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer gap-2 h-10 px-4 shrink-0 hover:scale-102 active:scale-98"
        >
          <Plus className="h-4 w-4" /> Initiate Cancellation Notice #1
        </Button>
      </div>

      {/* 4 Executive Metric Summary Command Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Notice #1 */}
        <div
          onClick={() => setActiveTab("notice_1")}
          className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            activeTab === "notice_1"
              ? "ring-2 ring-blue-500/50 border-blue-500 bg-blue-500/5 shadow-sm"
              : "border-border/70 bg-card shadow-2xs"
          }`}
        >
          <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
            <span className="uppercase tracking-wider text-[10px]">Notice #1 (Initial)</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-foreground mt-2">{countNotice1}</p>
          <div className="flex items-center gap-1.5 text-[11px] text-blue-600 font-semibold mt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            15-Day Grace Period Active
          </div>
        </div>

        {/* Notice #2 */}
        <div
          onClick={() => setActiveTab("notice_2")}
          className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            activeTab === "notice_2"
              ? "ring-2 ring-amber-500/50 border-amber-500 bg-amber-500/10 shadow-sm"
              : "border-amber-500/40 bg-amber-500/5 shadow-2xs"
          }`}
        >
          <div className="flex justify-between items-center text-xs font-bold text-amber-700 dark:text-amber-400">
            <span className="uppercase tracking-wider text-[10px]">Notice #2 (Urgent)</span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-amber-700 dark:text-amber-400 mt-2">{countNotice2}</p>
          <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 font-semibold mt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
            Final 7-Day Warning Window
          </div>
        </div>

        {/* Notice #3 */}
        <div
          onClick={() => setActiveTab("notice_3")}
          className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            activeTab === "notice_3"
              ? "ring-2 ring-rose-500/50 border-rose-500 bg-rose-500/10 shadow-sm"
              : "border-rose-500/40 bg-rose-500/5 shadow-2xs"
          }`}
        >
          <div className="flex justify-between items-center text-xs font-bold text-rose-700 dark:text-rose-400">
            <span className="uppercase tracking-wider text-[10px]">Notice #3 (Finalized)</span>
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-600">
              <Ban className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-rose-700 dark:text-rose-400 mt-2">{countNotice3}</p>
          <div className="flex items-center gap-1.5 text-[11px] text-rose-700 dark:text-rose-300 font-semibold mt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Site Automatically Released
          </div>
        </div>

        {/* Revoked */}
        <div
          onClick={() => setActiveTab("revoked")}
          className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            activeTab === "revoked"
              ? "ring-2 ring-emerald-500/50 border-emerald-500 bg-emerald-500/10 shadow-sm"
              : "border-emerald-500/40 bg-emerald-500/5 shadow-2xs"
          }`}
        >
          <div className="flex justify-between items-center text-xs font-bold text-emerald-700 dark:text-emerald-400">
            <span className="uppercase tracking-wider text-[10px]">Revoked & Retained</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400 mt-2">{countRevoked}</p>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold mt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Settled / Booking Restored
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border border-border/50 text-xs overflow-x-auto scrollbar-thin">
          {[
            { id: "all", label: `All Workflows (${cancellations.length})` },
            { id: "notice_1", label: `Notice 1 Active (${countNotice1})` },
            { id: "notice_2", label: `Notice 2 Urgent (${countNotice2})` },
            { id: "notice_3", label: `Final Cancelled (${countNotice3})` },
            { id: "revoked", label: `Revoked (${countRevoked})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === t.id
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Project Filter */}
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="h-9 text-xs w-[170px]">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search customer, plot, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 bg-card"
            />
          </div>
        </div>
      </div>

      {/* Cancellations List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-muted-foreground space-y-2 bg-card rounded-2xl border">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-rose-500 border-t-transparent" />
            <p>Loading cancellation workflows & legal audit trail...</p>
          </div>
        ) : filteredCancellations.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground space-y-3 bg-card rounded-2xl border">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto opacity-80" />
            <div className="space-y-1">
              <p className="font-bold text-foreground text-sm">No Cancellation Records Found</p>
              <p className="max-w-md mx-auto text-muted-foreground">
                {searchQuery || activeTab !== "all" || selectedProject !== "all"
                  ? "No cancellation workflows match your current search and filter settings."
                  : "All customer accounts and EMI agreements are currently in healthy standing."}
              </p>
            </div>
            {(searchQuery || activeTab !== "all" || selectedProject !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setActiveTab("all");
                  setSelectedProject("all");
                }}
                className="text-xs h-8"
              >
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          filteredCancellations.map((c: any) => {
            const bkg = c.bookings || {};
            const plot = bkg.plots || {};
            const project = plot.projects || {};

            const isRevoked = c.status === "revoked";
            const totalPrice = Number(bkg.total_price || 0);
            const paidAmount = Number(bkg.advance_paid || bkg.booking_amount || 0);
            const remainingBalance = Math.max(0, totalPrice - paidAmount);
            const percentPaid = totalPrice > 0 ? Math.min(100, Math.round((paidAmount / totalPrice) * 100)) : 0;

            const notice1Sender = profileMap.get(c.notice_1_sent_by)?.full_name || "Management Admin";
            const notice2Sender = profileMap.get(c.notice_2_sent_by)?.full_name || "Management Admin";
            const notice3Sender = profileMap.get(c.notice_3_sent_by)?.full_name || "Management Admin";
            const revokeSender = profileMap.get(c.revoked_by)?.full_name || "Management Admin";

            const notice1Grace = getGraceStatus(c.notice_1_sent_at, 15);
            const notice2Grace = getGraceStatus(c.notice_2_sent_at, 7);

            const isExpanded = expandedRemarksId === c.id;

            return (
              <div
                key={c.id}
                className={`rounded-2xl border bg-card p-5 shadow-xs transition-all space-y-4 hover:shadow-md ${
                  isRevoked
                    ? "border-emerald-500/30 bg-emerald-500/[0.02]"
                    : c.notice_stage === 3
                    ? "border-rose-500/30 bg-rose-500/[0.02]"
                    : c.notice_stage === 2
                    ? "border-amber-500/30 bg-amber-500/[0.02]"
                    : "border-border/80"
                }`}
              >
                {/* 1. TOP CARD HEADER: Customer KYC, Deal Summary & Current Workflow Badge */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-border/50">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="h-8 w-8 rounded-full bg-terracotta/10 text-terracotta font-bold text-xs flex items-center justify-center shrink-0 border border-terracotta/20">
                        {(bkg.customer_name || "C").slice(0, 2).toUpperCase()}
                      </div>
                      <h3 className="font-extrabold text-lg text-foreground tracking-tight">
                        {bkg.customer_name || "Customer"}
                      </h3>
                      <Badge
                        variant="outline"
                        className="text-xs font-bold bg-terracotta/10 text-terracotta border-terracotta/30"
                      >
                        <Building2 className="h-3 w-3 mr-1" />
                        {project.name || "Project"} · Plot #{plot.plot_number || "Site"}
                        {plot.area_sqft ? ` (${plot.area_sqft} sq.ft)` : ""}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs font-extrabold gap-1 ${
                          c.cancellation_type === "emi_default"
                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                        }`}
                      >
                        {c.cancellation_type === "emi_default" ? (
                          <>
                            <AlertTriangle className="h-3 w-3" /> Overdue EMI Default
                          </>
                        ) : (
                          <>
                            <FileText className="h-3 w-3" /> Customer Voluntary Request
                          </>
                        )}
                      </Badge>
                    </div>

                    {/* Customer Contact & KYC Strip */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap pt-0.5 font-medium">
                      <div
                        onClick={(e) => bkg.customer_phone && handleCopyPhone(`phone-${c.id}`, bkg.customer_phone, e)}
                        className="flex items-center gap-1 cursor-pointer hover:text-foreground font-mono"
                        title="Click to copy phone number"
                      >
                        <Phone className="h-3 w-3 text-muted-foreground/70" />
                        <span>{bkg.customer_phone || "N/A"}</span>
                        {copiedPhoneId === `phone-${c.id}` ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-2.5 w-2.5 opacity-40 hover:opacity-100" />
                        )}
                      </div>
                      {bkg.customer_email && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground/70" />
                            {bkg.customer_email}
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground/70" />
                        Booked: {formatDate(bkg.created_at || bkg.booking_date)}
                      </span>
                    </div>
                  </div>

                  {/* Right Header Status Pill */}
                  <div className="flex items-center gap-3 self-start lg:self-center shrink-0">
                    <div className="text-left lg:text-right">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                        Current Status
                      </span>
                      {isRevoked ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-extrabold text-xs mt-0.5 gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Revoked & Retained
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className={`font-extrabold text-xs mt-0.5 gap-1 ${
                            c.notice_stage === 1
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                              : c.notice_stage === 2
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {c.notice_stage === 1 && <Clock className="h-3 w-3" />}
                          {c.notice_stage === 2 && <AlertTriangle className="h-3 w-3" />}
                          {c.notice_stage === 3 && <Ban className="h-3 w-3" />}
                          Notice #{c.notice_stage} {c.notice_stage === 3 ? "(Site Released)" : "Active"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. MAIN 3-COLUMN STRUCTURED GRID: Financials + 3-Notice Escalation Timeline + Action Hub */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  {/* Column A: Deal Financial Health Box (lg: 3 cols) */}
                  <div className="lg:col-span-3 p-3.5 rounded-xl border border-border/70 bg-muted/20 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground font-semibold">
                      <span>Deal Contract Value</span>
                      <strong className="text-foreground font-bold text-sm">{money(totalPrice)}</strong>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                        <span>Paid to Date ({percentPaid}%)</span>
                        <strong className="text-emerald-600 font-bold">{money(paidAmount)}</strong>
                      </div>
                      <Progress value={percentPaid} className="h-1.5 bg-muted" />
                    </div>

                    <div className="pt-1.5 border-t border-border/50 flex justify-between items-center text-[11px]">
                      <span className="text-muted-foreground font-medium">Unpaid Balance</span>
                      <strong className="text-terracotta font-bold">{money(remainingBalance)}</strong>
                    </div>
                  </div>

                  {/* Column B: Interactive 3-Notice Escalation Timeline & Remarks (lg: 6 cols) */}
                  <div className="lg:col-span-6 p-3.5 rounded-xl border border-border/80 bg-background space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between text-[10px] uppercase font-extrabold tracking-wider text-muted-foreground border-b pb-1.5">
                      <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                        <History className="h-3 w-3" /> Legal Escalation Timeline
                      </span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        3-Stage Statutory Process
                      </span>
                    </div>

                    {/* Stepper Nodes */}
                    <div className="space-y-3">
                      {/* Notice #1 Node */}
                      <div className="relative pl-6 border-l-2 border-blue-500/40 pb-2 space-y-1">
                        <span className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[9px] font-black">
                          1
                        </span>
                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                          <span className="font-bold text-foreground">
                            Notice #1 (Initial Intimation)
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {c.notice_1_sent_at ? formatDateTime(c.notice_1_sent_at) : "Pending"}
                          </span>
                        </div>

                        {c.notice_1_sent_at && (
                          <div className="text-[11px] text-muted-foreground space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-foreground/90 font-medium">
                                Issued by: <strong className="text-foreground">{notice1Sender}</strong>
                              </span>
                              {notice1Grace && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    notice1Grace.expired
                                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                      : "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                                  }`}
                                >
                                  ⏳ {notice1Grace.label} (Cure: {notice1Grace.deadlineStr})
                                </span>
                              )}
                            </div>

                            {c.reason && (
                              <div className="p-2 rounded-lg bg-muted/40 border border-border/50 text-[11px] text-foreground/90 italic">
                                <span className="font-semibold not-italic text-muted-foreground text-[10px] uppercase block">
                                  Notice #1 Remarks / Reason:
                                </span>
                                "{c.reason}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Notice #2 Node */}
                      <div
                        className={`relative pl-6 border-l-2 pb-2 space-y-1 ${
                          c.notice_stage >= 2
                            ? "border-amber-500/60"
                            : "border-border/40 opacity-60"
                        }`}
                      >
                        <span
                          className={`absolute -left-[9px] top-0 h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                            c.notice_stage >= 2
                              ? "bg-amber-500 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          2
                        </span>
                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                          <span
                            className={`font-bold ${
                              c.notice_stage >= 2 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
                            }`}
                          >
                            Notice #2 (Urgent Warning)
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {c.notice_2_sent_at ? formatDateTime(c.notice_2_sent_at) : "Not Issued Yet"}
                          </span>
                        </div>

                        {c.notice_2_sent_at && (
                          <div className="text-[11px] text-muted-foreground space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-foreground/90 font-medium">
                                Issued by: <strong className="text-foreground">{notice2Sender}</strong>
                              </span>
                              {notice2Grace && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    notice2Grace.expired
                                      ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                  }`}
                                >
                                  ⚠️ {notice2Grace.label} (Final Cure: {notice2Grace.deadlineStr})
                                </span>
                              )}
                            </div>

                            {c.notice_2_remarks && (
                              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-900 dark:text-amber-200 italic">
                                <span className="font-semibold not-italic text-amber-700 dark:text-amber-400 text-[10px] uppercase block">
                                  Notice #2 Warning Remarks:
                                </span>
                                "{c.notice_2_remarks}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Notice #3 Node */}
                      <div
                        className={`relative pl-6 border-l-2 pb-1 space-y-1 ${
                          c.notice_stage === 3
                            ? "border-rose-500"
                            : "border-border/40 opacity-60"
                        }`}
                      >
                        <span
                          className={`absolute -left-[9px] top-0 h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                            c.notice_stage === 3
                              ? "bg-rose-500 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          3
                        </span>
                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                          <span
                            className={`font-bold ${
                              c.notice_stage === 3 ? "text-rose-700 dark:text-rose-400" : "text-muted-foreground"
                            }`}
                          >
                            Notice #3 (Final Termination & Automated Site Release)
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {c.notice_3_sent_at ? formatDateTime(c.notice_3_sent_at) : "Not Finalized"}
                          </span>
                        </div>

                        {c.notice_3_sent_at && (
                          <div className="text-[11px] text-rose-700 dark:text-rose-300 space-y-1">
                            <p className="font-semibold">
                              ✓ Finalized by: <strong>{notice3Sender}</strong> · Plot #{plot.plot_number} automatically reset to AVAILABLE.
                            </p>
                            {c.notice_3_remarks && (
                              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] italic">
                                <span className="font-semibold not-italic text-[10px] uppercase block">
                                  Final Cancellation Remarks:
                                </span>
                                "{c.notice_3_remarks}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Revoked Node (if applicable) */}
                      {isRevoked && (
                        <div className="relative pl-6 border-l-2 border-emerald-500 pt-1 space-y-1">
                          <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-black">
                            ✓
                          </span>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              Revocation & Agreement Reinstated
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {formatDateTime(c.revoked_at)}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            <span>Revoked by: <strong className="text-foreground">{revokeSender}</strong></span>
                            {c.revocation_remarks && (
                              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 italic mt-1">
                                <span className="font-semibold not-italic text-[10px] uppercase block text-emerald-700">
                                  Settlement Remarks:
                                </span>
                                "{c.revocation_remarks}"
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Column C: Command Actions Hub (lg: 3 cols) */}
                  <div className="lg:col-span-3 p-3.5 rounded-xl border border-border/80 bg-muted/15 space-y-2.5 text-xs">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-muted-foreground block">
                      Legal Dispatch & Actions
                    </span>

                    {/* 1. Print Letter Button */}
                    {!isRevoked && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openNoticeLetter(c, c.notice_stage as any)}
                        className="w-full h-9 text-xs font-bold gap-2 bg-card hover:bg-muted border-border/90 shadow-2xs cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5 text-amber-600" />
                        Print Notice #{c.notice_stage} Letter (A4)
                      </Button>
                    )}

                    {/* 2. Send WhatsApp Notice Button */}
                    {!isRevoked && bkg.customer_phone && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendWhatsAppNotice(c, c.notice_stage)}
                        className="w-full h-9 text-xs font-bold gap-2 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                        Send Notice #{c.notice_stage} via WhatsApp
                      </Button>
                    )}

                    {/* 3. Advance to Notice #2 Action */}
                    {c.notice_stage === 1 && !isRevoked && (
                      <div className="pt-2 border-t border-border/50 space-y-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setConfirmNotice2Item(c);
                            setNotice2RemarkInput("");
                          }}
                          className="w-full h-9 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs gap-1.5 rounded-xl shadow-xs cursor-pointer"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Escalate to Notice #2 <ArrowRight className="h-3 w-3" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setConfirmRevokeItem(c);
                            setRevokeRemarkInput("");
                          }}
                          className="w-full h-8 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs font-bold gap-1 cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" /> Revoke Cancellation
                        </Button>
                      </div>
                    )}

                    {/* 4. Issue Notice #3 & Site Release Action */}
                    {c.notice_stage === 2 && !isRevoked && (
                      <div className="pt-2 border-t border-border/50 space-y-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setConfirmNotice3Item(c);
                            setNotice3RemarkInput("");
                          }}
                          className="w-full h-9 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs gap-1.5 rounded-xl shadow-md cursor-pointer"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Issue Notice #3 & Cancel Plot
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setConfirmRevokeItem(c);
                            setRevokeRemarkInput("");
                          }}
                          className="w-full h-8 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs font-bold gap-1 cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" /> Revoke Cancellation
                        </Button>
                      </div>
                    )}

                    {/* 5. Already Cancelled or Revoked Status Box */}
                    {(c.notice_stage === 3 || isRevoked) && (
                      <div className="pt-2 border-t border-border/50 text-center text-xs space-y-1">
                        <span className="text-[11px] font-bold text-muted-foreground block">
                          Workflow Completed
                        </span>
                        <Link
                          to="/projects"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-terracotta hover:underline"
                        >
                          <Layers className="h-3 w-3" /> View on Site Mapper
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODALS & DIALOGS                                                          */}
      {/* ========================================================================= */}

      {/* 1. Initiate Cancellation Notice #1 Modal */}
      <Dialog open={initiateModalOpen} onOpenChange={setInitiateModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
              <AlertTriangle className="h-5 w-5 text-rose-600" /> Initiate Cancellation Notice #1
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Start the formal 3-notice legal escalation process with statutory grace periods.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground">Select Active Booking *</Label>
              <Select value={selectedBookingId} onValueChange={setSelectedBookingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer & plot..." />
                </SelectTrigger>
                <SelectContent>
                  {activeBookings.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.customer_name} — Plot #{b.plots?.plot_number} ({b.plots?.projects?.name || "Project"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground">Cancellation Type *</Label>
              <Select value={cancellationType} onValueChange={(val: any) => setCancellationType(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer_requested">📋 Customer Voluntary Cancellation Request</SelectItem>
                  <SelectItem value="emi_default">⚠️ Overdue EMI Non-Payment Default</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground">Notice #1 Reason & Detailed Remarks *</Label>
              <Textarea
                rows={3}
                placeholder="e.g. Consecutive 2-month EMI bounce, customer unreachable on registered mobile..."
                value={reasonNotes}
                onChange={(e) => setReasonNotes(e.target.value)}
              />
            </div>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] space-y-1">
              <span className="font-bold block">Statutory Notice #1 Rules:</span>
              <p>• Grants an official 15-day cure window to regularize overdue obligations.</p>
              <p>• Can be printed in Speed Post A4 format and dispatched via WhatsApp.</p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setInitiateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => initiateMutation.mutate()}
              disabled={initiateMutation.isPending || !selectedBookingId || !reasonNotes.trim()}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {initiateMutation.isPending ? "Issuing Notice..." : "Issue Notice #1"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. CONFIRMATION DIALOG: ADVANCE TO NOTICE #2 */}
      <Dialog open={!!confirmNotice2Item} onOpenChange={(open) => !open && setConfirmNotice2Item(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-amber-600">
              <AlertTriangle className="h-5 w-5" /> Issue Urgent Warning Notice #2?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1.5 leading-relaxed">
              Escalating cancellation for <strong>{confirmNotice2Item?.bookings?.customer_name}</strong> regarding{" "}
              <strong>Plot #{confirmNotice2Item?.bookings?.plots?.plot_number}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground">
                Notice #2 Escalation Reason / Warning Remarks *
              </Label>
              <Textarea
                rows={3}
                placeholder="e.g. Notice #1 15-day cure period expired on 20 Aug with zero payment. Final 7-day warning issued."
                value={notice2RemarkInput}
                onChange={(e) => setNotice2RemarkInput(e.target.value)}
              />
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-800 dark:text-amber-300 font-medium text-[11px] space-y-1">
              <span className="font-bold block">Notice #2 Legal Effect:</span>
              <p>• Grants a final 7-day grace period before automatic cancellation.</p>
              <p>• If unpaid, allows proceeding to Notice #3 for global site release.</p>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmNotice2Item(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() =>
                advanceToNotice2Mutation.mutate({
                  cancId: confirmNotice2Item.id,
                  remarks: notice2RemarkInput,
                })
              }
              disabled={advanceToNotice2Mutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              {advanceToNotice2Mutation.isPending ? "Escalating..." : "Confirm & Issue Notice #2"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. CONFIRMATION DIALOG: ISSUE NOTICE #3 & CANCEL PLOT */}
      <Dialog open={!!confirmNotice3Item} onOpenChange={(open) => !open && setConfirmNotice3Item(null)}>
        <DialogContent className="sm:max-w-[500px] border-rose-500/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-rose-600">
              <Ban className="h-5 w-5" /> ⚠️ Finalize Notice #3 & Cancel Plot?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1.5 leading-relaxed">
              Final termination step for <strong>{confirmNotice3Item?.bookings?.customer_name}</strong> (Plot #
              {confirmNotice3Item?.bookings?.plots?.plot_number}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground">
                Final Notice #3 Cancellation Reason / Summary Remarks
              </Label>
              <Textarea
                rows={3}
                placeholder="e.g. Statutory 7-day cure window expired. Agreement cancelled and plot released for fresh sales."
                value={notice3RemarkInput}
                onChange={(e) => setNotice3RemarkInput(e.target.value)}
              />
            </div>

            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 font-semibold text-[11px] leading-normal space-y-1">
              <span className="font-black text-rose-800 dark:text-rose-200 block">
                🚨 AUTOMATED SITE RELEASE NOTICE:
              </span>
              <p>
                This action will permanently cancel the booking record and{" "}
                <strong>
                  AUTOMATICALLY RESET Plot #{confirmNotice3Item?.bookings?.plots?.plot_number} TO AVAILABLE
                  GLOBALLY
                </strong>{" "}
                on the Interactive Site Mapper for new buyers.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmNotice3Item(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() =>
                finalizeNotice3Mutation.mutate({
                  canc: confirmNotice3Item,
                  remarks: notice3RemarkInput,
                })
              }
              disabled={finalizeNotice3Mutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md"
            >
              {finalizeNotice3Mutation.isPending ? "Cancelling..." : "Confirm Final Cancellation & Release Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. CONFIRMATION DIALOG: REVOKE NOTICE & RETAIN PLOT */}
      <Dialog open={!!confirmRevokeItem} onOpenChange={(open) => !open && setConfirmRevokeItem(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-emerald-600">
              <RotateCcw className="h-5 w-5" /> Revoke Cancellation & Retain Plot?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1.5 leading-relaxed">
              Stop escalation and retain booking for <strong>{confirmRevokeItem?.bookings?.customer_name}</strong> (Plot #
              {confirmRevokeItem?.bookings?.plots?.plot_number}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground">
                Revocation Settlement Reason / Notes *
              </Label>
              <Textarea
                rows={3}
                placeholder="e.g. Customer cleared overdue EMI of ₹1,50,000 via RTGS. Booking restored to active status."
                value={revokeRemarkInput}
                onChange={(e) => setRevokeRemarkInput(e.target.value)}
              />
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-800 dark:text-emerald-300 font-medium text-[11px]">
              ✓ This restores the booking in full good standing and stops any further notice escalation.
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmRevokeItem(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() =>
                revokeMutation.mutate({
                  canc: confirmRevokeItem,
                  remarks: revokeRemarkInput,
                })
              }
              disabled={revokeMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {revokeMutation.isPending ? "Revoking..." : "Confirm Revocation & Retain Plot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Printable Legal Notice Letter Modal */}
      {printModalOpen && printBooking && (
        <NoticeLetterModal
          cancellation={printCancellation}
          booking={printBooking}
          noticeStage={printStage}
          open={printModalOpen}
          onOpenChange={setPrintModalOpen}
        />
      )}
    </div>
  );
}
