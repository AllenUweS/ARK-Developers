import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  History,
  Search,
  ArrowRight,
  Building2,
  Landmark,
  CreditCard,
  CheckCircle2,
  RotateCcw,
  FileSpreadsheet,
  Eye,
  Calendar,
  User,
  Download,
  LayoutGrid,
  Table as TableIcon,
  Coins,
  Clock,
  AlertCircle,
  X,
  FileText,
  Wallet,
  ArrowRightLeft,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export interface InterProjectLedgerProps {
  transfers: any[];
  isLoading: boolean;
  onOpenTransferModal: () => void;
  onOpenRepayModal: (transfer: any) => void;
  onOpenTallyModal: (transfer: any) => void;
}

const money = (val: number) =>
  `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function InterProjectLedger({
  transfers,
  isLoading,
  onOpenTransferModal,
  onOpenRepayModal,
  onOpenTallyModal,
}: InterProjectLedgerProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "partial" | "repaid">("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [copiedAccId, setCopiedAccId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedAccId(id);
    toast.success(`Copied "${text}" to clipboard`);
    setTimeout(() => setCopiedAccId(null), 2000);
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalCount = transfers.length;
    const totalVolume = transfers.reduce((acc, t) => acc + Number(t.amount || 0), 0);

    let activeLoansCount = 0;
    let partialLoansCount = 0;
    let settledLoansCount = 0;
    let outstandingDueVolume = 0;
    let totalRecoveredVolume = 0;

    transfers.forEach((t) => {
      const amt = Number(t.amount || 0);
      const repaid = Number(t.repaid_amount || 0);
      const remaining = Math.max(0, amt - repaid);

      totalRecoveredVolume += repaid;
      outstandingDueVolume += remaining;

      if (remaining <= 0 || t.status === "repaid") {
        settledLoansCount++;
      } else if (repaid > 0) {
        partialLoansCount++;
        activeLoansCount++;
      } else {
        activeLoansCount++;
      }
    });

    return {
      totalCount,
      totalVolume,
      activeLoansCount,
      partialLoansCount,
      settledLoansCount,
      outstandingDueVolume,
      totalRecoveredVolume,
    };
  }, [transfers]);

  // Filtered List
  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      const amt = Number(t.amount || 0);
      const repaid = Number(t.repaid_amount || 0);
      const remaining = Math.max(0, amt - repaid);
      const isSettled = remaining <= 0 || t.status === "repaid";
      const isPartial = repaid > 0 && remaining > 0;

      // Status Match
      if (statusFilter === "active" && isSettled) return false;
      if (statusFilter === "partial" && !isPartial) return false;
      if (statusFilter === "repaid" && !isSettled) return false;

      // Search Match
      if (!search.trim()) return true;
      const query = search.toLowerCase().trim();
      const srcName = t.source_project?.name || "";
      const tgtName = t.target_project?.name || "";
      const srcBank = t.source_bank_account?.bank_name || "";
      const tgtBank = t.target_bank_account?.bank_name || "";
      const srcAcc = t.source_bank_account?.account_number || "";
      const tgtAcc = t.target_bank_account?.account_number || "";
      const srcIfsc = t.source_bank_account?.ifsc_code || "";
      const tgtIfsc = t.target_bank_account?.ifsc_code || "";
      const user = t.profile?.full_name || "";
      const purpose = t.purpose || "";
      const ref = `TRF-${t.id?.slice(0, 6) || ""}`.toLowerCase();

      return (
        srcName.toLowerCase().includes(query) ||
        tgtName.toLowerCase().includes(query) ||
        srcBank.toLowerCase().includes(query) ||
        tgtBank.toLowerCase().includes(query) ||
        srcAcc.toLowerCase().includes(query) ||
        tgtAcc.toLowerCase().includes(query) ||
        srcIfsc.toLowerCase().includes(query) ||
        tgtIfsc.toLowerCase().includes(query) ||
        user.toLowerCase().includes(query) ||
        purpose.toLowerCase().includes(query) ||
        ref.includes(query)
      );
    });
  }, [transfers, statusFilter, search]);

  // Export to CSV Function
  const handleExportCSV = () => {
    if (transfers.length === 0) {
      toast.error("No transfer records to export");
      return;
    }

    const headers = [
      "Transfer Reference",
      "Date",
      "Source Project",
      "Source Bank Name",
      "Source Account Number",
      "Source IFSC",
      "Target Project",
      "Target Bank Name",
      "Target Account Number",
      "Target IFSC",
      "Initiated By",
      "Original Amount (INR)",
      "Repaid Amount (INR)",
      "Net Outstanding Due (INR)",
      "Status",
      "Target Repayment Date",
      "Purpose / Narration",
    ];

    const rows = filteredTransfers.map((t) => {
      const amt = Number(t.amount || 0);
      const repaid = Number(t.repaid_amount || 0);
      const remaining = Math.max(0, amt - repaid);
      const isSettled = remaining <= 0 || t.status === "repaid";
      const statusLabel = isSettled ? "Fully Repaid" : repaid > 0 ? "Partially Repaid" : "Active Loan";

      return [
        `"TRF-${t.id.slice(0, 6).toUpperCase()}"`,
        `"${new Date(t.created_at).toLocaleDateString("en-IN")}"`,
        `"${t.source_project?.name || "Source Project"}"`,
        `"${t.source_bank_account?.bank_name || "General Treasury"}"`,
        `"${t.source_bank_account?.account_number ? `'${t.source_bank_account.account_number}` : "N/A"}"`,
        `"${t.source_bank_account?.ifsc_code || "N/A"}"`,
        `"${t.target_project?.name || "Target Project"}"`,
        `"${t.target_bank_account?.bank_name || "General Treasury"}"`,
        `"${t.target_bank_account?.account_number ? `'${t.target_bank_account.account_number}` : "N/A"}"`,
        `"${t.target_bank_account?.ifsc_code || "N/A"}"`,
        `"${t.profile?.full_name || "Management User"}"`,
        amt,
        repaid,
        remaining,
        `"${statusLabel}"`,
        `"${t.repayment_due_date || "N/A"}"`,
        `"${(t.purpose || "").replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Inter_Project_Bank_Transfers_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Ledger exported to CSV successfully!");
  };

  return (
    <section className="rounded-2xl border bg-card shadow-xs overflow-hidden transition-all">
      {/* 1. Header & Summary Stats Ribbon */}
      <div className="p-5 md:p-6 border-b bg-gradient-to-r from-purple-500/[0.04] via-card to-emerald-500/[0.04]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 shadow-inner">
              <History className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-xl tracking-tight">Inter-Project Fund Transfers Ledger</h2>
                <Badge variant="outline" className="text-[11px] font-medium border-purple-500/30 text-purple-700 dark:text-purple-300 bg-purple-500/5">
                  {transfers.length} Total Records
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Audit trail of bank-to-bank capital allocations, target repayment dates, and real-time fund return tracking.
              </p>
            </div>
          </div>

          {/* Quick Metric Pills */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="px-3.5 py-1.5 rounded-xl border bg-background/80 flex items-center gap-2 shadow-2xs">
              <Coins className="h-3.5 w-3.5 text-purple-500" />
              <div className="text-left leading-tight">
                <span className="text-[10px] text-muted-foreground uppercase font-medium block">Total Reallocated</span>
                <span className="text-xs font-bold text-foreground">{money(stats.totalVolume)}</span>
              </div>
            </div>

            <div className="px-3.5 py-1.5 rounded-xl border border-terracotta/20 bg-terracotta/5 flex items-center gap-2 shadow-2xs">
              <Wallet className="h-3.5 w-3.5 text-terracotta" />
              <div className="text-left leading-tight">
                <span className="text-[10px] text-muted-foreground uppercase font-medium block">Active Outflows</span>
                <span className="text-xs font-bold text-terracotta">{money(stats.outstandingDueVolume)}</span>
              </div>
            </div>

            <div className="px-3.5 py-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-2 shadow-2xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <div className="text-left leading-tight">
                <span className="text-[10px] text-muted-foreground uppercase font-medium block">Settled Loans</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.settledLoansCount} Completed
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Interactive Control Bar: Tabs, Search, View Switcher & CSV */}
        <div className="mt-5 pt-4 border-t border-border/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Segmented Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                statusFilter === "all"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All Transfers ({stats.totalCount})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                statusFilter === "active"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Active Loans ({stats.activeLoansCount})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("partial")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                statusFilter === "partial"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              Partially Repaid ({stats.partialLoansCount})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("repaid")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                statusFilter === "repaid"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Fully Settled ({stats.settledLoansCount})
            </button>
          </div>

          {/* Search, View Mode & Export Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 sm:w-60 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search projects, banks, IFSC..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-7 text-xs h-8 bg-background/90"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* View Switcher (Cards vs Table) */}
            <div className="flex items-center p-0.5 rounded-lg border bg-muted/40 text-muted-foreground shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                title="Visual Wire Flow Card View"
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                title="Accounting Table View"
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "hover:text-foreground"
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* CSV Export */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 px-2.5 text-xs font-medium gap-1.5 border-border/80 hover:bg-muted cursor-pointer shrink-0"
              title="Export Transfer Records to CSV"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Main Data Container */}
      {isLoading ? (
        <div className="p-12 text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Loading bank transfers ledger...</p>
        </div>
      ) : filteredTransfers.length === 0 ? (
        <div className="p-12 text-center space-y-3">
          <RotateCcw className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">No fund transfers found</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {search || statusFilter !== "all"
                ? "No transfer records match your current filter criteria."
                : "No inter-project bank-to-bank capital transfers recorded yet."}
            </p>
          </div>
          {(search || statusFilter !== "all") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
              className="text-xs h-8 mt-2"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : viewMode === "cards" ? (
        /* VISUAL BANK-TO-BANK WIRE FLOW CARDS */
        <div className="p-4 sm:p-5 space-y-4 bg-muted/10">
          {filteredTransfers.map((t) => {
            const amt = Number(t.amount || 0);
            const repaid = Number(t.repaid_amount || 0);
            const remaining = Math.max(0, amt - repaid);
            const isSettled = remaining <= 0 || t.status === "repaid";
            const percentRepaid = amt > 0 ? Math.min(100, Math.round((repaid / amt) * 100)) : 0;
            const refCode = `TRF-${t.id.slice(0, 6).toUpperCase()}`;

            return (
              <div
                key={t.id}
                className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all space-y-4 group"
              >
                {/* Card Top Banner: Ref, Timestamp, Admin, Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/50 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                      #{refCode}
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1 font-medium">
                      <Calendar className="h-3 w-3" />
                      {new Date(t.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground/70" />
                      {t.profile?.full_name || "Management User"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {t.repayment_due_date && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground px-2 py-0.5 rounded-md bg-background border">
                        <Clock className="h-3 w-3 text-amber-500" />
                        Target Return:{" "}
                        <strong className="text-foreground">
                          {new Date(`${t.repayment_due_date}T00:00:00`).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </strong>
                      </span>
                    )}

                    {isSettled ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-semibold gap-1 py-0.5">
                        <CheckCircle2 className="h-3 w-3" /> Fully Settled
                      </Badge>
                    ) : repaid > 0 ? (
                      <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-[11px] font-semibold gap-1 py-0.5">
                        <Clock className="h-3 w-3" /> Partially Repaid ({percentRepaid}%)
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[11px] font-semibold gap-1 py-0.5">
                        <AlertCircle className="h-3 w-3" /> Active Capital Loan
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Structured Main Grid (4-Column Layout) */}
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12 items-center">
                  {/* Column 1: Enhanced Visual Bank-to-Bank Conduit (xl: 5 cols) */}
                  <div className="xl:col-span-5 rounded-xl border border-border/80 bg-background/60 backdrop-blur-sm p-3.5 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between text-[10px] uppercase font-extrabold tracking-wider text-muted-foreground border-b pb-1.5 border-border/50">
                      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Debited Account
                      </span>
                      <span className="text-purple-600 dark:text-purple-400 font-mono font-bold">
                        Inter-Bank Wire
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Credited Account
                      </span>
                    </div>

                    <div className="flex items-stretch justify-between gap-2.5">
                      {/* Source Bank Account Card */}
                      <div className="flex-1 min-w-0 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex flex-col justify-between space-y-1.5 hover:border-amber-500/40 transition-colors">
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              Debited
                            </span>
                            {t.source_bank_account?.account_type && (
                              <span className="text-[9px] font-medium text-muted-foreground capitalize">
                                {t.source_bank_account.account_type}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-foreground font-bold text-xs truncate">
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                            <span className="truncate" title={t.source_bank_account?.bank_name || t.source_project?.name || "Source Project"}>
                              {t.source_bank_account?.bank_name || t.source_project?.name || "Source Project"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-0.5 text-[10px] text-muted-foreground font-mono">
                          <div
                            onClick={(e) =>
                              t.source_bank_account?.account_number &&
                              handleCopy(`src-${t.id}`, t.source_bank_account.account_number, e)
                            }
                            className="flex items-center gap-1 text-foreground font-semibold truncate cursor-pointer hover:text-amber-600"
                            title="Click to copy account number"
                          >
                            <CreditCard className="h-3 w-3 shrink-0 text-amber-600" />
                            <span className="truncate">
                              {t.source_bank_account?.account_number
                                ? `•••• ${t.source_bank_account.account_number.slice(-4)}`
                                : "Treasury Ledger"}
                            </span>
                            {t.source_bank_account?.account_number && (
                              copiedAccId === `src-${t.id}` ? (
                                <Check className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                              ) : (
                                <Copy className="h-2.5 w-2.5 opacity-40 hover:opacity-100 shrink-0" />
                              )
                            )}
                          </div>
                          <div className="text-[9px] text-muted-foreground truncate" title={t.source_project?.name}>
                            🏢 {t.source_project?.name || "Source Project"}
                          </div>
                          {t.source_bank_account?.ifsc_code && (
                            <div className="text-[9px] text-muted-foreground/80 truncate">
                              IFSC: {t.source_bank_account.ifsc_code}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Directional Connector Flow */}
                      <div className="flex flex-col items-center justify-center px-0.5 shrink-0">
                        <div className="h-7 w-7 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-2xs">
                          <ArrowRight className="h-4 w-4" />
                        </div>
                        <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 mt-1 font-mono">
                          {money(amt)}
                        </span>
                      </div>

                      {/* Destination Bank Account Card */}
                      <div className="flex-1 min-w-0 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col justify-between space-y-1.5 hover:border-emerald-500/40 transition-colors">
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              Credited
                            </span>
                            {t.target_bank_account?.account_type && (
                              <span className="text-[9px] font-medium text-muted-foreground capitalize">
                                {t.target_bank_account.account_type}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-foreground font-bold text-xs truncate">
                            <Landmark className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            <span className="truncate" title={t.target_bank_account?.bank_name || t.target_project?.name || "Target Project"}>
                              {t.target_bank_account?.bank_name || t.target_project?.name || "Target Project"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-0.5 text-[10px] text-muted-foreground font-mono">
                          <div
                            onClick={(e) =>
                              t.target_bank_account?.account_number &&
                              handleCopy(`tgt-${t.id}`, t.target_bank_account.account_number, e)
                            }
                            className="flex items-center gap-1 text-foreground font-semibold truncate cursor-pointer hover:text-emerald-600"
                            title="Click to copy account number"
                          >
                            <CreditCard className="h-3 w-3 shrink-0 text-emerald-600" />
                            <span className="truncate">
                              {t.target_bank_account?.account_number
                                ? `•••• ${t.target_bank_account.account_number.slice(-4)}`
                                : "Treasury Ledger"}
                            </span>
                            {t.target_bank_account?.account_number && (
                              copiedAccId === `tgt-${t.id}` ? (
                                <Check className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                              ) : (
                                <Copy className="h-2.5 w-2.5 opacity-40 hover:opacity-100 shrink-0" />
                              )
                            )}
                          </div>
                          <div className="text-[9px] text-muted-foreground truncate" title={t.target_project?.name}>
                            🏢 {t.target_project?.name || "Target Project"}
                          </div>
                          {t.target_bank_account?.ifsc_code && (
                            <div className="text-[9px] text-muted-foreground/80 truncate">
                              IFSC: {t.target_bank_account.ifsc_code}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Financials & Recovery Progress Meter (xl: 3 cols) */}
                  <div className="xl:col-span-3 rounded-xl border border-border/70 bg-card p-3 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        Original Allocation
                      </span>
                      <span className="text-base font-bold text-foreground">{money(amt)}</span>
                    </div>

                    {/* Progress Bar & Percentage Pill */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Recovery Progress</span>
                        <span
                          className={`font-semibold font-mono ${
                            isSettled
                              ? "text-emerald-600"
                              : repaid > 0
                              ? "text-sky-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {percentRepaid}% ({isSettled ? "Settled" : `${money(repaid)} returned`})
                        </span>
                      </div>
                      <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden border border-border/40">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            isSettled
                              ? "bg-emerald-500"
                              : repaid > 0
                              ? "bg-gradient-to-r from-sky-500 to-emerald-400"
                              : "bg-muted-foreground/20"
                          }`}
                          style={{ width: `${percentRepaid}%` }}
                        />
                      </div>
                    </div>

                    {/* Dues Breakdown */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
                      <span className="text-muted-foreground text-[11px]">
                        Repaid:{" "}
                        <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          +{money(repaid)}
                        </strong>
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        Net Outstanding:{" "}
                        <strong
                          className={
                            remaining > 0
                              ? "text-terracotta font-bold"
                              : "text-emerald-600 font-bold"
                          }
                        >
                          {remaining > 0 ? money(remaining) : "₹0 Settled"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Column 3: Narration Memo Note (xl: 2 cols) */}
                  <div className="xl:col-span-2 min-h-[70px] flex flex-col justify-center">
                    {t.purpose ? (
                      <div className="p-2.5 rounded-xl bg-background border border-border/60 text-xs space-y-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                          <FileText className="h-3 w-3 text-purple-500" /> Narration Note
                        </span>
                        <p className="text-foreground/90 italic line-clamp-2 text-[11px] leading-tight" title={t.purpose}>
                          "{t.purpose}"
                        </p>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30 text-center">
                        <span className="text-[11px] text-muted-foreground/70 italic">
                          Standard capital transfer
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Column 4: Standardized Actions Group (xl: 2 cols) */}
                  <div className="xl:col-span-2 flex flex-col sm:flex-row xl:flex-col gap-2 justify-center items-stretch">
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenTallyModal(t)}
                        className="text-xs h-8 text-terracotta border-terracotta/30 hover:bg-terracotta/10 gap-1 px-2 font-medium cursor-pointer"
                        title="View Tally Journal Voucher"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" /> Tally
                      </Button>

                      <Link
                        to="/treasury/$transferId"
                        params={{ transferId: t.id }}
                        className="inline-flex items-center justify-center gap-1 text-xs h-8 px-2 rounded-lg border border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 font-medium transition-colors cursor-pointer"
                        title="Inspect Complete Audit Flow"
                      >
                        <Eye className="h-3.5 w-3.5 shrink-0" /> Inspect
                      </Link>
                    </div>

                    {!isSettled ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onOpenRepayModal(t)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5 font-medium shadow-xs cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Repay Funds Back
                      </Button>
                    ) : (
                      <div className="h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1 text-xs font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Settled
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* COMPACT ACCOUNTING TABLE VIEW WITH ENHANCED BANK COLUMNS */
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="text-xs hover:bg-transparent">
                <TableHead className="font-bold text-foreground w-28">Ref & Date</TableHead>
                <TableHead className="font-bold text-foreground min-w-[200px]">Debited Bank Account (From)</TableHead>
                <TableHead className="font-bold text-foreground min-w-[200px]">Credited Bank Account (To)</TableHead>
                <TableHead className="font-bold text-foreground text-right">Principal Amount</TableHead>
                <TableHead className="font-bold text-foreground text-right">Repaid Amount</TableHead>
                <TableHead className="font-bold text-foreground text-right">Net Due</TableHead>
                <TableHead className="font-bold text-foreground text-center">Status</TableHead>
                <TableHead className="font-bold text-foreground text-right pr-5">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/50 text-xs">
              {filteredTransfers.map((t) => {
                const amt = Number(t.amount || 0);
                const repaid = Number(t.repaid_amount || 0);
                const remaining = Math.max(0, amt - repaid);
                const isSettled = remaining <= 0 || t.status === "repaid";
                const percentRepaid = amt > 0 ? Math.min(100, Math.round((repaid / amt) * 100)) : 0;
                const refCode = `TRF-${t.id.slice(0, 6).toUpperCase()}`;

                return (
                  <TableRow key={t.id} className="hover:bg-muted/30 transition-colors">
                    {/* Ref & Date */}
                    <TableCell className="font-medium">
                      <div className="font-mono font-bold text-purple-600 dark:text-purple-400">
                        #{refCode}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(t.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </TableCell>

                    {/* Debited Bank & Project Account */}
                    <TableCell>
                      <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/15 max-w-[220px] space-y-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1 rounded">
                            Debited
                          </span>
                          {t.source_bank_account?.account_type && (
                            <span className="text-[9px] text-muted-foreground capitalize">
                              {t.source_bank_account.account_type}
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-xs text-foreground truncate" title={t.source_bank_account?.bank_name || t.source_project?.name || "Standard Treasury"}>
                          {t.source_bank_account?.bank_name || "Standard Treasury"}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground truncate">
                          {t.source_bank_account?.account_number
                            ? `•••• ${t.source_bank_account.account_number.slice(-4)}`
                            : "General A/c"}
                          {t.source_bank_account?.ifsc_code ? ` · ${t.source_bank_account.ifsc_code}` : ""}
                        </div>
                        <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold truncate">
                          🏢 {t.source_project?.name || "Source Project"}
                        </div>
                      </div>
                    </TableCell>

                    {/* Credited Bank & Project Account */}
                    <TableCell>
                      <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 max-w-[220px] space-y-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1 rounded">
                            Credited
                          </span>
                          {t.target_bank_account?.account_type && (
                            <span className="text-[9px] text-muted-foreground capitalize">
                              {t.target_bank_account.account_type}
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-xs text-foreground truncate" title={t.target_bank_account?.bank_name || t.target_project?.name || "Standard Treasury"}>
                          {t.target_bank_account?.bank_name || "Standard Treasury"}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground truncate">
                          {t.target_bank_account?.account_number
                            ? `•••• ${t.target_bank_account.account_number.slice(-4)}`
                            : "General A/c"}
                          {t.target_bank_account?.ifsc_code ? ` · ${t.target_bank_account.ifsc_code}` : ""}
                        </div>
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold truncate">
                          🏢 {t.target_project?.name || "Target Project"}
                        </div>
                      </div>
                    </TableCell>

                    {/* Principal */}
                    <TableCell className="text-right font-bold text-foreground">
                      {money(amt)}
                    </TableCell>

                    {/* Repaid */}
                    <TableCell className="text-right">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        +{money(repaid)}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        ({percentRepaid}%)
                      </span>
                    </TableCell>

                    {/* Net Due */}
                    <TableCell className="text-right">
                      <span
                        className={`font-bold ${
                          remaining > 0
                            ? "text-terracotta"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {remaining > 0 ? money(remaining) : "₹0 Settled"}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center">
                      {isSettled ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                          Settled
                        </Badge>
                      ) : repaid > 0 ? (
                        <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-[10px]">
                          Partial
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">
                          Active
                        </Badge>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right pr-5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onOpenTallyModal(t)}
                          className="h-7 px-2 text-[11px] text-terracotta hover:bg-terracotta/10 cursor-pointer"
                          title="Tally Voucher Breakdown"
                        >
                          <FileSpreadsheet className="h-3 w-3 mr-1" /> Tally
                        </Button>

                        <Link
                          to="/treasury/$transferId"
                          params={{ transferId: t.id }}
                          className="inline-flex items-center text-[11px] h-7 px-2 rounded border border-border hover:bg-muted font-medium transition-colors cursor-pointer"
                          title="View Transfer Audit"
                        >
                          <Eye className="h-3 w-3 mr-1 text-purple-600" /> Audit
                        </Link>

                        {!isSettled && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => onOpenRepayModal(t)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-2 text-[11px] gap-1 cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" /> Repay
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
