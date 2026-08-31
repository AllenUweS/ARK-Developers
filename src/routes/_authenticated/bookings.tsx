import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Search,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  TrendingUp,
  IndianRupee,
  ExternalLink,
  Ban,
  FileSpreadsheet,
  Layers,
  Trash2,
  Lock,
  ArrowUpDown,
  RefreshCw,
  Database,
  MessageCircle,
  MoreHorizontal,
  Eye,
  Copy,
  Check,
  Phone,
  Mail,
  User,
  Calendar,
  MapPin,
  ShieldCheck,
  FileText,
  ChevronRight,
  LayoutGrid,
  LayoutList,
  Sparkles,
  Filter,
  Download,
  ArrowUpRight,
  Wallet,
  Landmark,
  ChevronDown,
  Activity,
  Zap,
  Radio,
  Share2,
  SlidersHorizontal,
  FileCheck,
  Printer,
} from "lucide-react";
import { syncBookingToTally, syncPaymentToTally, syncCustomerLedgerUnified } from "@/lib/tallySync";
import { sendBookingConfirmationWhatsApp } from "@/lib/whatsappService";
import { CustomerTallyLedgerModal } from "@/components/analytics/CustomerTallyLedgerModal";
import { BookingPrintForm } from "@/components/bookings/BookingPrintForm";

export const Route = createFileRoute("/_authenticated/bookings")({
  component: BookingsPage,
});

const statusConfig: Record<
  string,
  {
    label: string;
    bg: string;
    text: string;
    border: string;
    glow: string;
    dot: string;
    icon: any;
  }
> = {
  pending: {
    label: "Pending Review",
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/30",
    glow: "shadow-amber-500/10",
    dot: "bg-amber-500",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/30",
    glow: "shadow-emerald-500/10",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    bg: "bg-rose-500/10 dark:bg-rose-500/20",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-500/30",
    glow: "shadow-rose-500/10",
    dot: "bg-rose-500",
    icon: XCircle,
  },
  cancelled: {
    label: "Cancelled",
    bg: "bg-slate-500/10 dark:bg-slate-500/20",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-500/30",
    glow: "shadow-slate-500/10",
    dot: "bg-slate-400",
    icon: Ban,
  },
  on_hold: {
    label: "On Hold",
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/30",
    glow: "shadow-purple-500/10",
    dot: "bg-purple-500",
    icon: AlertCircle,
  },
};

function BookingsPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  const [syncingTallyId, setSyncingTallyId] = useState<string | null>(null);
  const [sendingWhatsAppId, setSendingWhatsAppId] = useState<string | null>(null);

  // Modal & Drawer States
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [selectedTallyModalBooking, setSelectedTallyModalBooking] = useState<any | null>(null);
  const [drawerBooking, setDrawerBooking] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [printBooking, setPrintBooking] = useState<any | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  const handleCopyPhone = (id: string, phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedPhoneId(id);
    toast.success(`Copied ${phone} to clipboard`);
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  const { data: role } = useQuery({
    queryKey: ["role", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: user.id });
      return (data as string) ?? "employee";
    },
  });

  const isAdmin = role === "admin" || role === "super_admin" || role === "manager";

  const { data: bookings = [], isLoading, isRefetching } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, plots(id, plot_number, area_sqft, project_id, projects(id, name, code, location))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      plotId,
      status,
    }: {
      id: string;
      plotId?: string;
      status: "approved" | "rejected" | "cancelled" | "on_hold" | "pending";
    }) => {
      const { error } = await supabase
        .from("bookings")
        .update({
          status,
          approved_by: user.id,
          approved_at: status === "approved" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;

      if (plotId) {
        if (status === "approved") {
          await supabase.from("plots").update({ status: "booked" }).eq("id", plotId);
        } else if (status === "cancelled" || status === "rejected") {
          await supabase
            .from("plots")
            .update({ status: "available", selected_lead_id: null } as any)
            .eq("id", plotId);
        }
      }
    },
    onSuccess: () => {
      toast.success("Booking status updated successfully");
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteBooking = useMutation({
    mutationFn: async (bookingToDelete: any) => {
      if (!bookingToDelete?.id) throw new Error("No booking selected for deletion");

      const st = String(bookingToDelete.status || "").toLowerCase();
      const isDeletable = st === "cancelled" || st === "cancel" || st === "rejected";

      if (!isDeletable) {
        throw new Error("This booking cannot be deleted. Bookings must be Cancelled or Rejected before deletion.");
      }

      // Delete related schedules and payments first
      try {
        await (supabase as any).from("installment_payments").delete().eq("booking_id", bookingToDelete.id);
        await (supabase as any).from("booking_installment_schedules").delete().eq("booking_id", bookingToDelete.id);
      } catch (err) {
        console.warn("Notice: Sub-record cleanup warning:", err);
      }

      // Delete the main booking record
      const { error: deleteErr } = await supabase.from("bookings").delete().eq("id", bookingToDelete.id);
      if (deleteErr) throw deleteErr;

      // Reset plot status to available if attached
      if (bookingToDelete.plot_id) {
        await (supabase as any)
          .from("plots")
          .update({ status: "available", selected_lead_id: null })
          .eq("id", bookingToDelete.plot_id);
      }
    },
    onSuccess: () => {
      toast.success("Booking agreement deleted successfully!");
      setDrawerOpen(false);
      setDrawerBooking(null);
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["plots"] });
      qc.invalidateQueries({ queryKey: ["all-plots"] });
    },
    onError: (err: any) => toast.error(err.message || "Could not delete booking"),
  });

  async function handleSyncToTally(b: any, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setSyncingTallyId(b.id);
    const plotNo = String(b.plots?.plot_number || "101");

    try {
      // Fetch recorded payments for this booking to enable incremental sync
      let paymentsData: any[] = [];
      try {
        const { data } = await (supabase as any)
          .from("installment_payments")
          .select("*")
          .eq("booking_id", b.id)
          .order("paid_on", { ascending: true });
        if (data) paymentsData = data;
      } catch (pErr) {
        console.warn("Could not fetch installment payments for Tally sync:", pErr);
      }

      const res = await syncCustomerLedgerUnified({
        booking: b,
        payments: paymentsData,
      });

      if (res.success) {
        if (res.alreadyUpToDate) {
          toast.info(`Tally Prime is already up to date for Plot #${plotNo}! (0 new transactions to sync)`);
        } else if (res.syncedSales && res.syncedPaymentsCount > 0) {
          toast.success(`Successfully synced Sales Voucher & ${res.syncedPaymentsCount} payment(s) for Plot #${plotNo} to Tally Prime!`);
        } else if (res.syncedSales) {
          toast.success(`Successfully synced Sales Voucher for Plot #${plotNo} to Tally Prime!`);
        } else if (res.syncedPaymentsCount > 0) {
          toast.success(`Successfully synced ${res.syncedPaymentsCount} new payment(s) for Plot #${plotNo} to Tally Prime!`);
        }
      } else {
        toast.error(`Tally Sync Error: ${res.error || "Failed to reach Tally Prime on port 9000"}`);
      }
    } catch (err: any) {
      toast.error(`Tally sync error: ${err.message || "Failed to reach Tally on port 9000"}`);
    } finally {
      setSyncingTallyId(null);
    }
  }

  const handleSendWhatsApp = async (b: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSendingWhatsAppId(b.id);
    const toastId = toast.loading(`Dispatching WhatsApp confirmation to ${b.customer_name}...`);
    try {
      const res = await sendBookingConfirmationWhatsApp({
        customerName: b.customer_name || "Customer",
        customerPhone: b.customer_phone || "",
        projectName: b.plots?.projects?.name || "Project",
        plotNumber: String(b.plots?.plot_number || "Mapped"),
        totalPrice: Number(b.total_price || 0),
        bookingAmountPaid: Number(b.advance_paid || 0),
        bookingDate: b.booking_date,
      });

      toast.dismiss(toastId);
      if (res.success) {
        toast.success(res.message);
      } else if (res.mode === "deeplink" && res.deepLink) {
        toast.info(`📱 WhatsApp API credentials not configured. Open WhatsApp Web to send:`, {
          action: {
            label: "Open WhatsApp",
            onClick: () => window.open(res.deepLink, "_blank"),
          },
        });
      } else {
        toast.error(`WhatsApp Meta API Error: ${res.message || "Failed to dispatch WhatsApp message"}`, {
          duration: 8000,
        });
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "Failed to send WhatsApp message");
    } finally {
      setSendingWhatsAppId(null);
    }
  };

  // Projects list for dropdown filter
  const projectsList = useMemo(() => {
    const unique = new Map<string, { id: string; name: string; code: string }>();
    bookings.forEach((b: any) => {
      const proj = b.plots?.projects;
      if (proj?.id && proj?.name) {
        unique.set(proj.id, { id: proj.id, name: proj.name, code: proj.code || "PRJ" });
      }
    });
    return Array.from(unique.values());
  }, [bookings]);

  // Statistics calculation
  const stats = useMemo(() => {
    let totalCollected = 0;
    let totalDealValue = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let onHoldCount = 0;

    bookings.forEach((b: any) => {
      totalCollected += Number(b.advance_paid || 0);
      totalDealValue += Number(b.total_price || 0);
      if (b.status === "pending") pendingCount++;
      if (b.status === "approved") approvedCount++;
      if (b.status === "on_hold") onHoldCount++;
    });

    const collectionRate =
      totalDealValue > 0 ? Math.round((totalCollected / totalDealValue) * 100) : 0;
    const avgDeal =
      bookings.length > 0 ? Math.round(totalDealValue / bookings.length) : 0;

    return {
      totalBookings: bookings.length,
      totalCollected,
      totalDealValue,
      pendingCount,
      approvedCount,
      onHoldCount,
      collectionRate,
      avgDeal,
    };
  }, [bookings]);

  // Filtered and sorted bookings
  const filteredBookings = useMemo(() => {
    return bookings
      .filter((b: any) => {
        // Status Filter
        if (selectedStatus !== "all" && b.status !== selectedStatus) {
          return false;
        }

        // Project Filter
        if (selectedProject !== "all" && b.plots?.projects?.id !== selectedProject) {
          return false;
        }

        // Search Query
        if (searchQuery.trim() !== "") {
          const q = searchQuery.toLowerCase();
          const matchCustomer = b.customer_name?.toLowerCase().includes(q);
          const matchPhone = b.customer_phone?.toLowerCase().includes(q);
          const matchPlot = String(b.plots?.plot_number ?? "").toLowerCase().includes(q);
          const matchProject = b.plots?.projects?.name?.toLowerCase().includes(q);
          const matchCode = b.plots?.projects?.code?.toLowerCase().includes(q);
          return matchCustomer || matchPhone || matchPlot || matchProject || matchCode;
        }

        return true;
      })
      .sort((a: any, b: any) => {
        if (sortBy === "newest") {
          return (
            new Date(b.created_at || b.booking_date).getTime() -
            new Date(a.created_at || a.booking_date).getTime()
          );
        }
        if (sortBy === "oldest") {
          return (
            new Date(a.created_at || a.booking_date).getTime() -
            new Date(b.created_at || b.booking_date).getTime()
          );
        }
        if (sortBy === "amount_high") {
          return Number(b.total_price || 0) - Number(a.total_price || 0);
        }
        if (sortBy === "amount_low") {
          return Number(a.total_price || 0) - Number(b.total_price || 0);
        }
        if (sortBy === "name_asc") {
          return (a.customer_name || "").localeCompare(b.customer_name || "");
        }
        return 0;
      });
  }, [bookings, selectedStatus, selectedProject, searchQuery, sortBy]);

  // Export to CSV
  const exportToCSV = () => {
    if (filteredBookings.length === 0) {
      toast.error("No bookings to export");
      return;
    }
    const headers = [
      "Booking ID",
      "Project",
      "Project Code",
      "Plot Number",
      "Customer Name",
      "Customer Phone",
      "Customer Email",
      "Total Price (INR)",
      "Advance Paid (INR)",
      "Govt Value (INR)",
      "Company Value (INR)",
      "Booking Date",
      "Status",
    ];
    const rows = filteredBookings.map((b: any) => [
      b.id,
      `"${b.plots?.projects?.name || ""}"`,
      b.plots?.projects?.code || "",
      b.plots?.plot_number || "",
      `"${b.customer_name || ""}"`,
      `"${b.customer_phone || ""}"`,
      `"${b.customer_email || ""}"`,
      b.total_price || 0,
      b.advance_paid || 0,
      b.govt_amount || "",
      b.company_amount || "",
      b.booking_date ? new Date(b.booking_date).toLocaleDateString("en-IN") : "",
      b.status || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `bookings_agreements_export_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Bookings CSV exported successfully");
  };

  const getInitials = (name: string) => {
    if (!name) return "CU";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const openDrawerForBooking = (b: any) => {
    setDrawerBooking(b);
    setDrawerOpen(true);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 pb-16 max-w-[1600px] mx-auto">
        {/* ========================================================================= */}
        {/* HERO COMMAND COCKPIT                                                      */}
        {/* ========================================================================= */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card to-terracotta/[0.04] border border-border/80 p-6 sm:p-8 shadow-sm">
          {/* Ambient Lighting Accents */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-terracotta/10 via-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              {/* Live Status Pill & System Pulse */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-terracotta/10 text-terracotta border border-terracotta/20 shadow-2xs">
                  <Sparkles className="size-3 text-terracotta animate-spin" />
                  Sales & Agreement Engine
                </span>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  Tally Prime Port 9000 Bridge
                </span>

                {isRefetching && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/80 px-2.5 py-0.5 rounded-full font-medium">
                    <RefreshCw className="size-3 animate-spin text-terracotta" />
                    Syncing...
                  </span>
                )}
              </div>

              {/* Title with Luxury Typography */}
              <div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground font-display">
                  Bookings & Agreements
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">
                  Real-time pipeline orchestration, customer ledger progression, manager approvals, automated WhatsApp dispatch, and live accounting synchronization.
                </p>
              </div>
            </div>

            {/* Quick Action Button Group */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                className="h-10 px-4 text-xs font-bold gap-2 rounded-xl border-border/90 hover:bg-muted/80 shadow-2xs"
              >
                <Download className="size-3.5 text-muted-foreground" />
                Export CSV
              </Button>
              <Link to="/approvals">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 px-4 text-xs font-extrabold gap-2 rounded-xl border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-2xs"
                >
                  <FileCheck className="size-3.5" />
                  Approvals Center
                </Button>
              </Link>
              <Link to="/projects">
                <Button
                  size="sm"
                  className="h-10 px-5 text-xs font-extrabold gap-2 rounded-xl bg-gradient-to-r from-terracotta to-terracotta/90 hover:opacity-95 text-white shadow-md transition-all hover:scale-102 active:scale-98"
                >
                  <Layers className="size-4" />
                  Interactive Site Mapper
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4 ELEVATED INTERACTIVE KPI COMMAND CARDS                                  */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Bookings */}
          <div
            onClick={() => setSelectedStatus("all")}
            className={`group cursor-pointer transition-all duration-300 rounded-2xl p-5 border bg-card/90 backdrop-blur-md hover:-translate-y-1 hover:shadow-lg ${
              selectedStatus === "all"
                ? "ring-2 ring-terracotta/40 border-terracotta/60 shadow-md"
                : "border-border/80"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Total Bookings
              </span>
              <div className="p-2.5 rounded-xl bg-terracotta/10 text-terracotta group-hover:scale-110 transition-transform">
                <Building2 className="size-4" />
              </div>
            </div>
            <div className="mt-3.5">
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                {stats.totalBookings}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs">
                <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  <CheckCircle2 className="size-3" />
                  {stats.approvedCount} approved
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                  {stats.pendingCount} pending
                </span>
              </div>
            </div>
          </div>

          {/* 2. Advance Collected */}
          <div className="group rounded-2xl p-5 border border-border/80 bg-card/90 backdrop-blur-md hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Advance Received
              </span>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                <IndianRupee className="size-4" />
              </div>
            </div>
            <div className="mt-3.5">
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                ₹{stats.totalCollected.toLocaleString("en-IN")}
              </div>
              <div className="mt-2.5 space-y-1.5">
                <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                  <span>Downpayment realization</span>
                  <span className="font-bold text-foreground">{stats.collectionRate}%</span>
                </div>
                <Progress value={stats.collectionRate} className="h-1.5 bg-muted" />
              </div>
            </div>
          </div>

          {/* 3. Gross Deal Pipeline */}
          <div className="group rounded-2xl p-5 border border-border/80 bg-card/90 backdrop-blur-md hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Total Deal Pipeline
              </span>
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                <TrendingUp className="size-4" />
              </div>
            </div>
            <div className="mt-3.5">
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                ₹{stats.totalDealValue.toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-muted-foreground mt-2 font-medium">
                Avg. deal: <span className="font-bold text-foreground font-mono">₹{stats.avgDeal.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* 4. Action Required (Pending Approvals) */}
          <div
            onClick={() => setSelectedStatus("pending")}
            className={`group cursor-pointer transition-all duration-300 rounded-2xl p-5 border bg-card/90 backdrop-blur-md hover:-translate-y-1 hover:shadow-lg ${
              selectedStatus === "pending"
                ? "ring-2 ring-amber-500/50 border-amber-500 bg-amber-500/5 shadow-md"
                : stats.pendingCount > 0
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-border/80"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Action Required
              </span>
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse">
                <Clock className="size-4" />
              </div>
            </div>
            <div className="mt-3.5">
              <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
                {stats.pendingCount}
              </div>
              <div className="text-xs text-amber-700/90 dark:text-amber-300/90 font-semibold mt-2 flex items-center justify-between">
                <span>Awaiting manager approval</span>
                <span className="text-[11px] underline font-bold">Review →</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SEARCH, FILTER TOOLBAR & STATUS SEGMENT STRIP                              */}
        {/* ========================================================================= */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search customer, plot #, phone, project code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 text-xs bg-background/50 border-border/80 focus:ring-terracotta rounded-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Controls Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Project Filter */}
              {projectsList.length > 0 && (
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-[180px] h-10 text-xs bg-background/50 font-bold rounded-xl">
                    <Building2 className="size-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="text-xs font-semibold">
                      All Projects ({projectsList.length})
                    </SelectItem>
                    {projectsList.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        <span className="font-bold mr-1.5">[{p.code}]</span> {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Sort Filter */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[170px] h-10 text-xs bg-background/50 font-bold rounded-xl">
                  <ArrowUpDown className="size-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="newest" className="text-xs font-medium">Newest Date First</SelectItem>
                  <SelectItem value="oldest" className="text-xs font-medium">Oldest Date First</SelectItem>
                  <SelectItem value="amount_high" className="text-xs font-medium">Amount: High to Low</SelectItem>
                  <SelectItem value="amount_low" className="text-xs font-medium">Amount: Low to High</SelectItem>
                  <SelectItem value="name_asc" className="text-xs font-medium">Customer Name (A-Z)</SelectItem>
                </SelectContent>
              </Select>

              {/* View Switcher: Table vs Cards */}
              <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/60">
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === "table"
                      ? "bg-card text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Table View"
                >
                  <LayoutList className="size-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === "grid"
                      ? "bg-card text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Card Grid View"
                >
                  <LayoutGrid className="size-4" />
                </button>
              </div>

              {(searchQuery || selectedStatus !== "all" || selectedProject !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedStatus("all");
                    setSelectedProject("all");
                  }}
                  className="text-xs h-10 px-3 text-muted-foreground hover:text-terracotta hover:bg-terracotta/10 rounded-xl"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Status Tabs Pill Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-border/60 scrollbar-none">
            {[
              { id: "all", label: "All Bookings", count: bookings.length },
              {
                id: "pending",
                label: "Pending Review",
                count: bookings.filter((b: any) => b.status === "pending").length,
                badgeColor: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
              },
              {
                id: "approved",
                label: "Approved",
                count: bookings.filter((b: any) => b.status === "approved").length,
                badgeColor: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
              },
              {
                id: "on_hold",
                label: "On Hold",
                count: bookings.filter((b: any) => b.status === "on_hold").length,
                badgeColor: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
              },
              {
                id: "rejected",
                label: "Rejected",
                count: bookings.filter((b: any) => b.status === "rejected").length,
                badgeColor: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
              },
              {
                id: "cancelled",
                label: "Cancelled",
                count: bookings.filter((b: any) => b.status === "cancelled").length,
                badgeColor: "bg-slate-500/20 text-slate-700 dark:text-slate-300",
              },
            ].map((tab) => {
              const isSelected = selectedStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedStatus(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                    isSelected
                      ? "bg-foreground text-background shadow-xs"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold transition-colors ${
                      isSelected
                        ? "bg-background text-foreground"
                        : tab.badgeColor || "bg-muted-foreground/15 text-muted-foreground"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CONTENT BODY: TABLE OR LUXURY CARD GRID                                   */}
        {/* ========================================================================= */}
        {isLoading ? (
          <div className="bg-card border border-border/80 rounded-3xl p-16 text-center text-muted-foreground space-y-4 shadow-sm">
            <RefreshCw className="size-8 animate-spin mx-auto text-terracotta" />
            <div className="space-y-1">
              <p className="font-bold text-foreground text-base">Loading Bookings & Agreements</p>
              <p className="text-xs text-muted-foreground">Fetching records from Supabase database...</p>
            </div>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-card border border-border/80 rounded-3xl p-16 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
              <Building2 className="size-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-lg text-foreground">No Matching Bookings Found</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {searchQuery || selectedStatus !== "all" || selectedProject !== "all"
                  ? "No booking records match your filter criteria. Try resetting or adjusting your search parameters."
                  : "No plot bookings or agreement records have been registered yet."}
              </p>
            </div>
            {(searchQuery || selectedStatus !== "all" || selectedProject !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedStatus("all");
                  setSelectedProject("all");
                }}
                className="text-xs mt-2 rounded-xl font-bold"
              >
                Clear All Filters
              </Button>
            )}
          </div>
        ) : viewMode === "table" ? (
          /* ========================================================================= */
          /* LUXURY DATA TABLE VIEW                                                    */
          /* ========================================================================= */
          <div className="bg-card border border-border/80 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/80 text-left text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground select-none">
                    <th className="py-4 px-4 w-[16%]">Project & Plot</th>
                    <th className="py-4 px-4 w-[15%]">Customer Profile</th>
                    <th className="py-4 px-4 w-[33%]">Financial Progress</th>
                    <th className="py-4 px-3 w-[10%] whitespace-nowrap">Booked Date</th>
                    <th className="py-4 px-3 text-center w-[10%]">Status</th>
                    <th className="py-4 px-4 text-right font-extrabold text-foreground w-[16%] whitespace-nowrap">
                      Actions & Accounting
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredBookings.map((b: any) => {
                    const statusObj = statusConfig[b.status] || statusConfig.pending;
                    const StatusIcon = statusObj.icon;
                    const advance = Number(b.advance_paid || 0);
                    const total = Number(b.total_price || 1);
                    const percentPaid = Math.min(100, Math.round((advance / total) * 100));

                    return (
                      <tr
                        key={b.id}
                        onClick={() => openDrawerForBooking(b)}
                        className="group hover:bg-muted/30 transition-all duration-150 cursor-pointer"
                      >
                        {/* 1. PROJECT & PLOT */}
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-foreground text-sm group-hover:text-terracotta transition-colors">
                                {b.plots?.projects?.name || "Unassigned Project"}
                              </span>
                              {b.plots?.projects?.id && (
                                <Link
                                  to="/projects/$id"
                                  params={{ id: b.plots.projects.id }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-muted-foreground/60 hover:text-terracotta transition-colors p-0.5 rounded"
                                  title="Open Project Mapper"
                                >
                                  <ExternalLink className="size-3.5" />
                                </Link>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              {b.plots?.projects?.code && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-extrabold px-1.5 py-0 bg-muted/60 text-muted-foreground border-border/80"
                                >
                                  {b.plots.projects.code}
                                </Badge>
                              )}
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-extrabold bg-terracotta/10 text-terracotta border border-terracotta/20">
                                Plot #{b.plots?.plot_number ?? "N/A"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. CUSTOMER DETAILS */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="size-9 rounded-full bg-gradient-to-br from-terracotta/20 via-amber-500/20 to-terracotta/10 text-terracotta font-extrabold text-xs flex items-center justify-center shrink-0 border border-terracotta/30 shadow-2xs">
                              {getInitials(b.customer_name)}
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <div className="font-extrabold text-foreground text-sm truncate">
                                {b.customer_name}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                                <span>{b.customer_phone}</span>
                                {b.customer_phone && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleCopyPhone(b.id, b.customer_phone, e)}
                                    className="text-muted-foreground/60 hover:text-foreground p-0.5 rounded transition-colors"
                                    title="Copy phone"
                                  >
                                    {copiedPhoneId === b.id ? (
                                      <Check className="size-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="size-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. FINANCIAL PROGRESS & BIFURCATION (EXPANDED & SIDE-BY-SIDE) */}
                        <td className="py-4 px-4">
                          <div className="space-y-2 max-w-lg">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="font-extrabold text-foreground text-sm tracking-tight font-mono">
                                ₹{total.toLocaleString("en-IN")}
                              </span>
                              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                                  ₹{advance.toLocaleString("en-IN")}
                                </span>{" "}
                                paid ({percentPaid}%)
                              </span>
                            </div>

                            {/* Two-tone Expanded Progress Bar */}
                            <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 rounded-full transition-all duration-300 shadow-xs"
                                style={{ width: `${percentPaid}%` }}
                              />
                            </div>

                            {/* Govt Guideline Chip */}
                            {b.govt_amount && (
                              <div className="flex items-center gap-2 pt-0.5 whitespace-nowrap flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold text-[10px] border border-blue-500/20 shadow-2xs">
                                  🏛️ Govt: ₹{Number(b.govt_amount).toLocaleString("en-IN")}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 4. DATE BOOKED */}
                        <td className="py-4 px-3 whitespace-nowrap text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Calendar className="size-3.5 text-muted-foreground/60" />
                            {b.booking_date
                              ? new Date(b.booking_date).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "N/A"}
                          </div>
                        </td>

                        {/* 5. STATUS PILL (WITH FAST INLINE SWITCH FOR ADMIN) */}
                        <td className="py-4 px-3 text-center">
                          {isAdmin ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                asChild
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-extrabold shadow-2xs hover:scale-105 active:scale-95 transition-all ${statusObj.bg} ${statusObj.text} ${statusObj.border}`}
                                >
                                  <StatusIcon className="size-3.5 shrink-0" />
                                  <span>{statusObj.label}</span>
                                  <ChevronDown className="size-3 opacity-60 ml-0.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="center" className="w-44 text-xs rounded-xl shadow-lg">
                                <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider font-extrabold">
                                  Update Status
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    update.mutate({ id: b.id, plotId: b.plot_id, status: "pending" });
                                  }}
                                  className="gap-2 cursor-pointer font-bold text-amber-600"
                                >
                                  <Clock className="size-3.5" />
                                  Pending Review
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    update.mutate({ id: b.id, plotId: b.plot_id, status: "approved" });
                                  }}
                                  className="gap-2 cursor-pointer font-bold text-emerald-600"
                                >
                                  <CheckCircle2 className="size-3.5" />
                                  Approved
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    update.mutate({ id: b.id, plotId: b.plot_id, status: "on_hold" });
                                  }}
                                  className="gap-2 cursor-pointer font-bold text-purple-600"
                                >
                                  <AlertCircle className="size-3.5" />
                                  On Hold
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    update.mutate({ id: b.id, plotId: b.plot_id, status: "rejected" });
                                  }}
                                  className="gap-2 cursor-pointer font-bold text-rose-600"
                                >
                                  <XCircle className="size-3.5" />
                                  Rejected
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    update.mutate({ id: b.id, plotId: b.plot_id, status: "cancelled" });
                                  }}
                                  className="gap-2 cursor-pointer font-bold text-slate-600"
                                >
                                  <Ban className="size-3.5" />
                                  Cancelled
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-bold ${statusObj.bg} ${statusObj.text} ${statusObj.border}`}
                            >
                              <StatusIcon className="size-3.5 shrink-0" />
                              {statusObj.label}
                            </span>
                          )}
                        </td>

                        {/* 6. SYMMETRICAL 2-ROW ACTION CAPSULE */}
                        <td className="py-3 px-4 text-right">
                          <div
                            className="inline-flex flex-col gap-1.5 bg-background/95 p-1.5 rounded-2xl border border-border/80 shadow-2xs backdrop-blur-xs w-[215px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Top Row: Exactly 2 Equal Half-Width Buttons (WhatsApp & Sync Tally) */}
                            <div className="grid grid-cols-2 gap-1.5 w-full">
                              {/* WhatsApp Button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={sendingWhatsAppId === b.id}
                                    onClick={(e) => handleSendWhatsApp(b, e)}
                                    className="w-full h-8 px-2 text-[11px] font-extrabold gap-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 transition-all hover:scale-102 active:scale-95 shadow-2xs justify-center"
                                  >
                                    <MessageCircle className={`size-3.5 ${sendingWhatsAppId === b.id ? "animate-spin" : "text-emerald-600"}`} />
                                    <span>WhatsApp</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Send automated WhatsApp booking confirmation</p>
                                </TooltipContent>
                              </Tooltip>

                              {/* Sync Tally Button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={syncingTallyId === b.id}
                                    onClick={(e) => handleSyncToTally(b, e)}
                                    className="w-full h-8 px-2 text-[11px] font-extrabold gap-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 transition-all hover:scale-102 active:scale-95 shadow-2xs justify-center"
                                  >
                                    <Database className={`size-3.5 ${syncingTallyId === b.id ? "animate-spin text-blue-600" : "text-blue-600"}`} />
                                    <span>
                                      {syncingTallyId === b.id ? "Syncing..." : "Sync Tally"}
                                    </span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Post Sales Voucher to Tally Prime Port 9000</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>

                            {/* Bottom Row: Statement Button (Full Width Spanning Entire Capsule) */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTallyModalBooking(b);
                                    setLedgerModalOpen(true);
                                  }}
                                  className="w-full h-8 px-2 text-[11px] font-extrabold gap-1.5 rounded-xl bg-terracotta/10 hover:bg-terracotta/20 text-terracotta border border-terracotta/30 transition-all hover:scale-101 active:scale-95 shadow-2xs justify-center"
                                >
                                  <FileSpreadsheet className="size-3.5 text-terracotta" />
                                  <span>Statement & Ledger Breakdown</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View full Customer Tally Ledger & accounting breakdown</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* LUXURY CARD GRID VIEW (ALTERNATIVE MODERN VISUAL LAYOUT)                  */
          /* ========================================================================= */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBookings.map((b: any) => {
              const statusObj = statusConfig[b.status] || statusConfig.pending;
              const StatusIcon = statusObj.icon;
              const advance = Number(b.advance_paid || 0);
              const total = Number(b.total_price || 1);
              const percentPaid = Math.min(100, Math.round((advance / total) * 100));

              return (
                <div
                  key={b.id}
                  onClick={() => openDrawerForBooking(b)}
                  className="group bg-card border border-border/80 hover:border-terracotta/50 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer space-y-4 flex flex-col justify-between hover:-translate-y-1"
                >
                  {/* Top: Project, Plot & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-foreground group-hover:text-terracotta transition-colors text-base">
                          {b.plots?.projects?.name || "Project"}
                        </span>
                        {b.plots?.projects?.code && (
                          <Badge variant="outline" className="text-[10px] font-extrabold px-1.5 py-0">
                            {b.plots.projects.code}
                          </Badge>
                        )}
                      </div>
                      <div className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-terracotta/10 text-terracotta border border-terracotta/20 shadow-2xs">
                        Plot #{b.plots?.plot_number ?? "N/A"}
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-extrabold shadow-2xs ${statusObj.bg} ${statusObj.text} ${statusObj.border}`}
                    >
                      <StatusIcon className="size-3 shrink-0" />
                      {statusObj.label}
                    </span>
                  </div>

                  {/* Customer Identity */}
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/60">
                    <div className="size-10 rounded-full bg-gradient-to-br from-terracotta/20 via-amber-500/20 to-terracotta/10 text-terracotta font-extrabold text-xs flex items-center justify-center shrink-0 border border-terracotta/30 shadow-2xs">
                      {getInitials(b.customer_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-foreground text-sm truncate">{b.customer_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{b.customer_phone}</div>
                    </div>
                  </div>

                  {/* Financials & Progress */}
                  <div className="space-y-2.5 pt-1">
                    <div className="flex justify-between text-xs items-baseline">
                      <span className="font-extrabold text-foreground text-lg font-mono">
                        ₹{total.toLocaleString("en-IN")}
                      </span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        ₹{advance.toLocaleString("en-IN")} paid ({percentPaid}%)
                      </span>
                    </div>

                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 rounded-full"
                        style={{ width: `${percentPaid}%` }}
                      />
                    </div>

                    {/* Govt Guideline Badge */}
                    {b.govt_amount && (
                      <div className="flex items-center gap-1.5 text-[10px] flex-wrap pt-1">
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold border border-blue-500/20 shadow-2xs">
                          🏛️ Govt: ₹{Number(b.govt_amount).toLocaleString("en-IN")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Action Hub Footer */}
                  <div
                    className="pt-3 border-t border-border/60 flex items-center justify-between gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                      <Calendar className="size-3 text-muted-foreground/60" />
                      {b.booking_date
                        ? new Date(b.booking_date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })
                        : "N/A"}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={sendingWhatsAppId === b.id}
                        onClick={(e) => handleSendWhatsApp(b, e)}
                        className="h-8 px-2.5 text-xs font-extrabold gap-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-2xs"
                      >
                        <MessageCircle className="size-3.5 text-emerald-600" />
                        WhatsApp
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={syncingTallyId === b.id}
                        onClick={(e) => handleSyncToTally(b, e)}
                        className="h-8 px-2.5 text-xs font-extrabold gap-1 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 shadow-2xs"
                      >
                        <Database className="size-3.5 text-blue-600" />
                        Tally
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTallyModalBooking(b);
                          setLedgerModalOpen(true);
                        }}
                        className="h-8 px-2.5 text-xs font-extrabold gap-1 rounded-xl bg-terracotta/10 hover:bg-terracotta/20 text-terracotta border border-terracotta/30 shadow-2xs"
                      >
                        <FileSpreadsheet className="size-3.5 text-terracotta" />
                        Ledger
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 360° BOOKING DOSSIER SLIDE-OVER DRAWER                                    */}
        {/* ========================================================================= */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="right" className="sm:max-w-lg overflow-y-auto p-6 space-y-6">
            {drawerBooking && (
              <>
                <SheetHeader className="space-y-2 border-b pb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-terracotta bg-terracotta/10 px-3 py-1 rounded-full border border-terracotta/20 shadow-2xs">
                      Plot #{drawerBooking.plots?.plot_number}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full border font-extrabold shadow-2xs ${
                        statusConfig[drawerBooking.status]?.bg || ""
                      } ${statusConfig[drawerBooking.status]?.text || ""} ${
                        statusConfig[drawerBooking.status]?.border || ""
                      }`}
                    >
                      {statusConfig[drawerBooking.status]?.label || drawerBooking.status}
                    </span>
                  </div>
                  <SheetTitle className="text-2xl font-extrabold text-foreground font-display">
                    {drawerBooking.plots?.projects?.name || "Project Agreement"}
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground font-medium">
                    Agreement registered on{" "}
                    {drawerBooking.booking_date
                      ? new Date(drawerBooking.booking_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "N/A"}
                  </SheetDescription>
                </SheetHeader>

                {/* Customer Details Card */}
                <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    <span>Customer Identity</span>
                    <User className="size-4 text-terracotta" />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="text-base font-extrabold text-foreground">{drawerBooking.customer_name}</div>
                    <div className="flex items-center gap-2 text-muted-foreground font-mono">
                      <Phone className="size-3.5 text-muted-foreground/80" />
                      <span>{drawerBooking.customer_phone || "Not recorded"}</span>
                    </div>
                    {drawerBooking.customer_email && (
                      <div className="flex items-center gap-2 text-muted-foreground font-mono">
                        <Mail className="size-3.5 text-muted-foreground/80" />
                        <span>{drawerBooking.customer_email}</span>
                      </div>
                    )}
                    {drawerBooking.customer_address && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="size-3.5 text-muted-foreground/80" />
                        <span>{drawerBooking.customer_address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    <span>Agreement Financials</span>
                    <IndianRupee className="size-4 text-emerald-600" />
                  </div>

                  <div className="grid grid-cols-2 gap-3 py-2 border-y text-xs">
                    <div>
                      <div className="text-muted-foreground font-semibold">Total Deal Value</div>
                      <div className="text-base font-extrabold text-foreground mt-0.5 font-mono">
                        ₹{Number(drawerBooking.total_price || 0).toLocaleString("en-IN")}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground font-semibold">Advance Received</div>
                      <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                        ₹{Number(drawerBooking.advance_paid || 0).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>

                  {/* Govt Valuation if present */}
                  {drawerBooking.govt_amount && (
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-blue-700 dark:text-blue-300 font-bold">
                        🏛️ Govt Valuation
                      </span>
                      <span className="text-sm font-extrabold text-foreground font-mono">
                        ₹{Number(drawerBooking.govt_amount).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick Actions inside Drawer */}
                <div className="space-y-2.5 pt-2">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    Direct Actions
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSendWhatsApp(drawerBooking)}
                      disabled={sendingWhatsAppId === drawerBooking.id}
                      className="h-10 text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
                    >
                      <MessageCircle className="size-4" />
                      Send WhatsApp
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleSyncToTally(drawerBooking)}
                      disabled={syncingTallyId === drawerBooking.id}
                      className="h-10 text-xs font-bold gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                    >
                      <Database className="size-4" />
                      Sync to Tally
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedTallyModalBooking(drawerBooking);
                      setLedgerModalOpen(true);
                    }}
                    className="w-full h-10 text-xs font-bold gap-2 border-terracotta/40 text-terracotta hover:bg-terracotta/10 rounded-xl"
                  >
                    <FileSpreadsheet className="size-4" />
                    Open Full Customer Tally Ledger Sheet
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPrintBooking(drawerBooking);
                      setPrintDialogOpen(true);
                    }}
                    className="w-full h-10 text-xs font-bold gap-2 border-border text-foreground hover:bg-muted/80 rounded-xl"
                  >
                    <Printer className="size-4 text-muted-foreground" />
                    Print Official Booking Form
                  </Button>
                </div>

                {/* Admin Status Controls & Booking Management inside Drawer */}
                {isAdmin && (
                  <div className="space-y-4 pt-1">
                    <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-2.5 shadow-2xs">
                      <div className="text-xs font-extrabold text-foreground">Update Agreement Status</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        <Button
                          size="sm"
                          variant={drawerBooking.status === "approved" ? "default" : "outline"}
                          onClick={() => {
                            update.mutate({
                              id: drawerBooking.id,
                              plotId: drawerBooking.plot_id,
                              status: "approved",
                            });
                            setDrawerBooking({ ...drawerBooking, status: "approved" });
                          }}
                          className="text-xs h-9 font-bold text-emerald-600 border-emerald-500/30 rounded-xl px-2"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant={drawerBooking.status === "on_hold" ? "default" : "outline"}
                          onClick={() => {
                            update.mutate({
                              id: drawerBooking.id,
                              plotId: drawerBooking.plot_id,
                              status: "on_hold",
                            });
                            setDrawerBooking({ ...drawerBooking, status: "on_hold" });
                          }}
                          className="text-xs h-9 font-bold text-purple-600 border-purple-500/30 rounded-xl px-2"
                        >
                          On Hold
                        </Button>
                        <Button
                          size="sm"
                          variant={drawerBooking.status === "rejected" ? "default" : "outline"}
                          onClick={() => {
                            update.mutate({
                              id: drawerBooking.id,
                              plotId: drawerBooking.plot_id,
                              status: "rejected",
                            });
                            setDrawerBooking({ ...drawerBooking, status: "rejected" });
                          }}
                          className="text-xs h-9 font-bold text-rose-600 border-rose-500/30 rounded-xl px-2"
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant={drawerBooking.status === "cancelled" || drawerBooking.status === "cancel" ? "default" : "outline"}
                          onClick={() => {
                            update.mutate({
                              id: drawerBooking.id,
                              plotId: drawerBooking.plot_id,
                              status: "cancelled",
                            });
                            setDrawerBooking({ ...drawerBooking, status: "cancelled" });
                          }}
                          className="text-xs h-9 font-bold text-amber-600 border-amber-500/30 rounded-xl px-2"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>

                    {/* Delete Booking Option with Pre-condition Validation */}
                    {(() => {
                      const st = String(drawerBooking.status || "").toLowerCase();
                      const isDeletable = st === "cancelled" || st === "cancel" || st === "rejected";

                      return (
                        <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-3 shadow-2xs">
                          <div className="flex items-center justify-between text-xs font-extrabold text-rose-700 dark:text-rose-300">
                            <span className="flex items-center gap-1.5">
                              <Trash2 className="size-4 text-rose-600" /> Permanent Booking Removal
                            </span>
                            {isDeletable ? (
                              <Badge variant="outline" className="text-[10px] font-extrabold bg-rose-500/10 text-rose-600 border-rose-500/30">
                                Deletable ({statusConfig[drawerBooking.status]?.label || drawerBooking.status})
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] font-extrabold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                                Locked
                              </Badge>
                            )}
                          </div>

                          {isDeletable ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={deleteBooking.isPending}
                                  className="w-full h-10 text-xs font-extrabold gap-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-all hover:scale-101 active:scale-95"
                                >
                                  <Trash2 className="size-4" />
                                  Delete Booking Record
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-3xl max-w-md">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-lg font-extrabold text-foreground font-display flex items-center gap-2">
                                    <Trash2 className="size-5 text-rose-600" /> Delete Booking Agreement?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed pt-2 space-y-2">
                                    <p>
                                      Are you sure you want to permanently delete the booking agreement for{" "}
                                      <strong className="text-foreground font-bold">{drawerBooking.customer_name}</strong> (Plot #{drawerBooking.plots?.plot_number})?
                                    </p>
                                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] font-medium space-y-1">
                                      <div className="font-bold">⚠️ Consequence of deletion:</div>
                                      <div>• The plot status will be restored to <strong>Available</strong>.</div>
                                      <div>• All payment receipts & schedules associated with this booking will be removed.</div>
                                      <div>• This action cannot be reversed.</div>
                                    </div>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="pt-2">
                                  <AlertDialogCancel className="rounded-xl text-xs font-bold">Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteBooking.mutate(drawerBooking)}
                                    className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl gap-1.5"
                                  >
                                    <Trash2 className="size-3.5" />
                                    Confirm Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <div className="space-y-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-full">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled
                                      onClick={() =>
                                        toast.error("Booking cannot be deleted. Please set status to Cancelled or Rejected first.")
                                      }
                                      className="w-full h-10 text-xs font-bold gap-2 border-border/80 text-muted-foreground/60 bg-muted/30 rounded-xl cursor-not-allowed opacity-70"
                                    >
                                      <Lock className="size-4 text-muted-foreground/50" />
                                      Delete Booking (Locked)
                                    </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="rounded-xl text-xs max-w-xs p-3">
                                  <p className="font-bold text-amber-600">Deletion Requirement Notice</p>
                                  <p className="text-muted-foreground mt-1">
                                    Bookings must be set to <strong>Cancelled</strong> or <strong>Rejected</strong> before they can be deleted from the database.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                              <p className="text-[11px] text-muted-foreground/80 font-medium leading-tight">
                                🔒 This booking must be set to <strong>Cancelled</strong> or <strong>Rejected</strong> status before it can be deleted.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Tally Customer Ledger Breakdown Modal */}
        <CustomerTallyLedgerModal
          booking={selectedTallyModalBooking}
          open={ledgerModalOpen}
          onOpenChange={setLedgerModalOpen}
        />

        {/* Official Booking Agreement Print Form Modal */}
        <BookingPrintForm
          booking={printBooking}
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
        />
      </div>
    </TooltipProvider>
  );
}
