import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Landmark,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Search,
  Wallet,
  TrendingUp,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  History,
  RotateCcw,
  Loader2,
  ShieldCheck,
  Coins,
  Eye,
  FileSpreadsheet,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { syncTransferToTally, syncTransferRepaymentToTally } from "@/lib/tallySync";
import { TreasuryTallyLedgerModal } from "@/components/analytics/TreasuryTallyLedgerModal";
import { ProjectAccountsRegistryModal } from "@/components/treasury/ProjectAccountsRegistryModal";
import { ProjectVaultsGrid } from "@/components/treasury/ProjectVaultsGrid";
import { InterProjectLedger } from "@/components/treasury/InterProjectLedger";
import { AddEditBankAccountDialog } from "@/components/projects/AddEditBankAccountDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/treasury")({
  component: TreasuryPage,
});

const money = (val: number) =>
  `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function TreasuryPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [repayModalOpen, setRepayModalOpen] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<any | null>(null);

  // Treasury Tally Modal State
  const [treasuryTallyModalOpen, setTreasuryTallyModalOpen] = useState(false);
  const [selectedTallyTransfer, setSelectedTallyTransfer] = useState<any | null>(null);

  // Bank Accounts Registry Modal State
  const [registryModalOpen, setRegistryModalOpen] = useState(false);
  const [inlineAddModalOpen, setInlineAddModalOpen] = useState(false);
  const [inlineAddProjectId, setInlineAddProjectId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  const [sourceProjectId, setSourceProjectId] = useState("");
  const [targetProjectId, setTargetProjectId] = useState("");
  const [sourceBankAccountId, setSourceBankAccountId] = useState("");
  const [targetBankAccountId, setTargetBankAccountId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferPurpose, setTransferPurpose] = useState("");
  const [repaymentDueDate, setRepaymentDueDate] = useState("");

  const [repayAmount, setRepayAmount] = useState("");
  const [repayNotes, setRepayNotes] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "repaid">("all");

  // User role check
  const { data: role } = useQuery({
    queryKey: ["role", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: user.id });
      return (data as string) ?? "employee";
    },
  });

  const isManagementOrAdmin =
    role === "admin" || role === "super_admin" || role === "management" || role === "accounts";

  // Fetch Profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ["treasury-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch Projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ["treasury-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, plots(id, price, status)")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch Bookings with plot and project relations
  const { data: bookings = [] } = useQuery({
    queryKey: ["treasury-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, plots(id, plot_number, price, project_id, projects(id, name, code))")
        .in("status", ["pending", "approved", "on_hold"]);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch All Installment Payments
  const { data: installmentPayments = [] } = useQuery({
    queryKey: ["treasury-installment-payments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("installment_payments")
        .select("*, booking:bookings(id, customer_name, plots(plot_number, project_id, projects(id, name, code)))")
        .order("paid_on", { ascending: false });
      if (error) {
        console.warn("Error fetching installment_payments:", error);
        return [];
      }
      return data ?? [];
    },
  });

  // Fetch Inter-Project Transfers
  const { data: rawTransfers = [], isLoading: isLoadingTransfers, error: transfersError } = useQuery({
    queryKey: ["project-fund-transfers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_fund_transfers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching project_fund_transfers:", error);
        return [];
      }
      return data ?? [];
    },
  });

  // Fetch All Repayments to ensure 100% accurate live sum calculation
  const { data: allRepayments = [] } = useQuery({
    queryKey: ["project-transfer-repayments-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_transfer_repayments")
        .select("*");
      if (error) return [];
      return data ?? [];
    },
  });

  // Fetch All Project Bank Accounts
  const { data: allBankAccounts = [] } = useQuery({
    queryKey: ["treasury-all-bank-accounts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_bank_accounts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) return [];
      return data ?? [];
    },
  });

  // Map projects, profiles & bank accounts to transfers locally with dynamic repayment sums
  const transfers = useMemo(() => {
    const projectMap = new Map(projects.map((p: any) => [p.id, p]));
    const profileMap = new Map(profiles.map((pr: any) => [pr.id, pr]));
    const bankAccountMap = new Map(allBankAccounts.map((b: any) => [b.id, b]));

    // Map repayments by transfer_id
    const repaymentSums = new Map<string, number>();
    allRepayments.forEach((r: any) => {
      const current = repaymentSums.get(r.transfer_id) || 0;
      repaymentSums.set(r.transfer_id, current + Number(r.amount || 0));
    });

    return rawTransfers.map((t: any) => {
      const repaidFromTable = repaymentSums.get(t.id) || 0;
      const effectiveRepaid = Math.max(Number(t.repaid_amount || 0), repaidFromTable);
      const isFullyPaid = effectiveRepaid >= Number(t.amount || 0);

      return {
        ...t,
        repaid_amount: effectiveRepaid,
        status: isFullyPaid ? "repaid" : effectiveRepaid > 0 ? "partially_repaid" : (t.status || "active"),
        source_project: projectMap.get(t.source_project_id),
        target_project: projectMap.get(t.target_project_id),
        source_bank_account: bankAccountMap.get(t.source_bank_account_id),
        target_bank_account: bankAccountMap.get(t.target_bank_account_id),
        profile: profileMap.get(t.transferred_by),
      };
    });
  }, [rawTransfers, projects, profiles, allRepayments, allBankAccounts]);

  // Project Financial Metrics Computation
  const projectMetrics = useMemo(() => {
    return projects.map((p: any) => {
      const projectBookings = bookings.filter((b: any) => b.plots?.project_id === p.id);
      const totalAgreedRevenue = projectBookings.reduce(
        (sum: number, b: any) => sum + Number(b.total_price || 0),
        0
      );
      const totalCollected = projectBookings.reduce(
        (sum: number, b: any) => sum + Number(b.advance_paid || 0),
        0
      );
      const totalOutstanding = Math.max(0, totalAgreedRevenue - totalCollected);

      // Inter-project transfer & repayment calculations
      const initialOutgoing = transfers
        .filter((t: any) => t.source_project_id === p.id)
        .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

      const initialIncoming = transfers
        .filter((t: any) => t.target_project_id === p.id)
        .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

      const repaymentsRecoveredBack = transfers
        .filter((t: any) => t.source_project_id === p.id)
        .reduce((sum: number, t: any) => sum + Number(t.repaid_amount || 0), 0);

      const repaymentsReturnedOut = transfers
        .filter((t: any) => t.target_project_id === p.id)
        .reduce((sum: number, t: any) => sum + Number(t.repaid_amount || 0), 0);

      const netOutgoing = Math.max(0, initialOutgoing - repaymentsRecoveredBack);
      const netIncoming = Math.max(0, initialIncoming - repaymentsReturnedOut);

      const netCapitalShift = netIncoming - netOutgoing;
      const netAvailableTreasury = Math.max(0, totalCollected + netCapitalShift);

      return {
        ...p,
        totalAgreedRevenue,
        totalCollected,
        totalOutstanding,
        initialOutgoing,
        initialIncoming,
        repaymentsRecoveredBack,
        repaymentsReturnedOut,
        netOutgoing,
        netIncoming,
        netCapitalShift,
        netAvailableTreasury,
      };
    });
  }, [projects, bookings, transfers]);

  // Overall Portfolio Totals
  const portfolioStats = useMemo(() => {
    const totalAgreed = projectMetrics.reduce((sum, p) => sum + p.totalAgreedRevenue, 0);
    const totalCollected = projectMetrics.reduce((sum, p) => sum + p.totalCollected, 0);
    const totalOutstanding = projectMetrics.reduce((sum, p) => sum + p.totalOutstanding, 0);
    const activeTransfersAmount = transfers
      .filter((t: any) => t.status !== "repaid")
      .reduce((sum: number, t: any) => sum + (Number(t.amount) - Number(t.repaid_amount || 0)), 0);

    return {
      totalAgreed,
      totalCollected,
      totalOutstanding,
      activeTransfersAmount,
    };
  }, [projectMetrics, transfers]);

  // Filter bank accounts by source & target projects
  const sourceProjectAccounts = useMemo(() => {
    if (!sourceProjectId) return [];
    return allBankAccounts.filter((b: any) => b.project_id === sourceProjectId);
  }, [allBankAccounts, sourceProjectId]);

  const targetProjectAccounts = useMemo(() => {
    if (!targetProjectId) return [];
    return allBankAccounts.filter((b: any) => b.project_id === targetProjectId);
  }, [allBankAccounts, targetProjectId]);

  // Create Fund Transfer Mutation
  const createTransferMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(transferAmount);
      if (!sourceProjectId || !targetProjectId) throw new Error("Select both source and target projects");
      if (sourceProjectId === targetProjectId) throw new Error("Source and target projects cannot be the same");
      if (isNaN(amt) || amt <= 0) throw new Error("Enter a valid transfer amount");

      const { error } = await (supabase as any).from("project_fund_transfers").insert({
        source_project_id: sourceProjectId,
        target_project_id: targetProjectId,
        source_bank_account_id: sourceBankAccountId || null,
        target_bank_account_id: targetBankAccountId || null,
        amount: amt,
        purpose: transferPurpose || null,
        repayment_due_date: repaymentDueDate || null,
        transferred_by: user.id,
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      const srcProj = projects.find((p: any) => p.id === sourceProjectId)?.name || "Source Project";
      const tgtProj = projects.find((p: any) => p.id === targetProjectId)?.name || "Target Project";
      const amt = Number(transferAmount);

      toast.success("Inter-project fund transfer recorded successfully!");

      try {
        const srcAcc = allBankAccounts.find((b: any) => b.id === sourceBankAccountId);
        const tgtAcc = allBankAccounts.find((b: any) => b.id === targetBankAccountId);
        const syncRes = await syncTransferToTally({
          sourceProject: srcProj,
          targetProject: tgtProj,
          amount: amt,
          transferRef: `TRF-${Date.now().toString().slice(-6)}`,
          sourceBankName: srcAcc?.bank_name,
          sourceAccountNo: srcAcc?.account_number,
          sourceIfsc: srcAcc?.ifsc_code,
          targetBankName: tgtAcc?.bank_name,
          targetAccountNo: tgtAcc?.account_number,
          targetIfsc: tgtAcc?.ifsc_code,
        });
        if (syncRes.success) {
          toast.success("Synced Journal Voucher to Tally Prime!");
        }
      } catch (err: any) {
        console.warn("Tally sync background attempt:", err);
      }

      setTransferModalOpen(false);
      setSourceProjectId("");
      setTargetProjectId("");
      setSourceBankAccountId("");
      setTargetBankAccountId("");
      setTransferAmount("");
      setTransferPurpose("");
      setRepaymentDueDate("");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to complete fund transfer"),
  });

  // Create Repayment Mutation
  const repayTransferMutation = useMutation({
    mutationFn: async () => {
      if (!activeTransfer) return;
      const amt = Number(repayAmount);
      const remaining = Number(activeTransfer.amount) - Number(activeTransfer.repaid_amount || 0);

      if (isNaN(amt) || amt <= 0) throw new Error("Enter a valid repayment amount");
      if (amt > remaining) throw new Error(`Repayment cannot exceed remaining balance of ${money(remaining)}`);

      // 1. Insert repayment record
      const { error: rErr } = await (supabase as any).from("project_transfer_repayments").insert({
        transfer_id: activeTransfer.id,
        amount: amt,
        repaid_by: user.id,
        notes: repayNotes || null,
      });
      if (rErr) throw rErr;

      // 2. Update transfer record
      const newRepaidTotal = Number(activeTransfer.repaid_amount || 0) + amt;
      const isFullyRepaid = newRepaidTotal >= Number(activeTransfer.amount);

      const { error: tErr } = await (supabase as any)
        .from("project_fund_transfers")
        .update({
          repaid_amount: newRepaidTotal,
          status: isFullyRepaid ? "repaid" : "partially_repaid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeTransfer.id);

      if (tErr) throw tErr;
    },
    onSuccess: () => {
      toast.success("Fund repayment recorded successfully!");
      setRepayModalOpen(false);
      setActiveTransfer(null);
      setRepayAmount("");
      setRepayNotes("");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to record repayment"),
  });

  // Filtered Transfers
  const filteredTransfers = transfers.filter((t: any) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && t.status !== "repaid") ||
      (statusFilter === "repaid" && t.status === "repaid");

    const searchTerms = `${t.source_project?.name || ""} ${t.target_project?.name || ""} ${t.purpose || ""}`.toLowerCase();
    return matchesStatus && searchTerms.includes(search.trim().toLowerCase());
  });

  if (!isManagementOrAdmin) {
    return (
      <div className="p-12 text-center space-y-4">
        <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold">Management Access Required</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          The Treasury & Inter-Project Fund Transfer hub is restricted to Executive Management and Admins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Landmark className="h-3 w-3" /> Management Hub
            </span>
          </div>
          <h1 className="text-display text-4xl mt-2 font-bold tracking-tight">
            Treasury & Fund Transfers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time project revenue performance, treasury reserves, and inter-project capital reallocations.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setRegistryModalOpen(true)}
            className="border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 gap-2 font-medium"
          >
            <Landmark className="h-4 w-4" /> Bank Accounts Registry
          </Button>

          <Button
            onClick={() => setTransferModalOpen(true)}
            className="bg-purple-700 hover:bg-purple-800 text-white gap-2 font-medium shadow-md"
          >
            <ArrowRightLeft className="h-4 w-4" /> Transfer Funds Between Projects
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5 space-y-1 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-medium">
            <Coins className="h-3.5 w-3.5 text-purple-500" /> Total Agreed Revenue
          </p>
          <p className="text-2xl text-display font-semibold">{money(portfolioStats.totalAgreed)}</p>
          <p className="text-xs text-muted-foreground">Booked revenue across all projects</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-1 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-medium">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Total Collections
          </p>
          <p className="text-2xl text-display font-semibold text-emerald-600 dark:text-emerald-400">
            {money(portfolioStats.totalCollected)}
          </p>
          <p className="text-xs text-muted-foreground">Realized cash in hand</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-1 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-medium">
            <Wallet className="h-3.5 w-3.5 text-terracotta" /> Outstanding Receivables
          </p>
          <p className="text-2xl text-display font-semibold text-terracotta">
            {money(portfolioStats.totalOutstanding)}
          </p>
          <p className="text-xs text-muted-foreground">Pending installment payments</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-1 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-medium">
            <ArrowRightLeft className="h-3.5 w-3.5 text-blue-500" /> Active Inter-Project Loans
          </p>
          <p className="text-2xl text-display font-semibold text-blue-600 dark:text-blue-400">
            {money(portfolioStats.activeTransfersAmount)}
          </p>
          <p className="text-xs text-muted-foreground">Reallocated capital pending repayment</p>
        </div>
      </div>

      {/* Projects Financial Revenue Grid */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" /> Project Treasury Balances
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select any development project below to filter and inspect its dedicated bank vaults.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={selectedProjectId === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedProjectId("all")}
              className={`h-8 text-xs font-bold rounded-xl transition-all ${
                selectedProjectId === "all"
                  ? "bg-purple-700 hover:bg-purple-800 text-white shadow-xs"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              All Projects Portfolio ({projects.length})
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projectMetrics.map((p) => {
            const isSelected = selectedProjectId === p.id;
            const pBankAccounts = allBankAccounts.filter((b: any) => b.project_id === p.id);

            return (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedProjectId(isSelected ? "all" : p.id);
                  const el = document.getElementById("project-vaults-section");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className={`rounded-3xl border p-5 flex flex-col justify-between cursor-pointer transition-all duration-300 shadow-xs ${
                  isSelected
                    ? "border-purple-600 dark:border-purple-400 ring-2 ring-purple-500/30 bg-purple-500/5 shadow-md scale-[1.01]"
                    : "bg-card border-border hover:border-purple-500/40 hover:shadow-sm"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/50">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground font-mono">
                          {p.code}
                        </span>
                        {isSelected && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-600 text-white tracking-wider shadow-xs">
                            ✨ Vaults Active
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-base tracking-tight truncate mt-0.5">{p.name}</h3>
                    </div>
                    <Badge variant="outline" className="text-[11px] uppercase font-medium">
                      {p.plots?.length || 0} Plots
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 py-4 text-xs">
                    <div>
                      <p className="text-muted-foreground">Agreed Revenue</p>
                      <p className="font-bold text-sm mt-0.5">{money(p.totalAgreedRevenue)}</p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Collected Cash</p>
                      <p className="font-bold text-sm mt-0.5 text-emerald-600 dark:text-emerald-400">
                        {money(p.totalCollected)}
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Outstanding</p>
                      <p className="font-medium mt-0.5">{money(p.totalOutstanding)}</p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Net Inter-Project Capital</p>
                      <p
                        className={`font-semibold mt-0.5 flex items-center gap-0.5 ${
                          p.netCapitalShift > 0
                            ? "text-emerald-600"
                            : p.netCapitalShift < 0
                            ? "text-terracotta"
                            : "text-muted-foreground"
                        }`}
                      >
                        {p.netCapitalShift > 0 ? (
                          <>
                            <ArrowDownLeft className="h-3 w-3" /> +{money(p.netCapitalShift)}
                          </>
                        ) : p.netCapitalShift < 0 ? (
                          <>
                            <ArrowUpRight className="h-3 w-3" /> −{money(Math.abs(p.netCapitalShift))}
                          </>
                        ) : (
                          "₹0"
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      Net Available Treasury
                    </p>
                    <p className="text-lg font-black font-mono text-purple-700 dark:text-purple-300">
                      {money(p.netAvailableTreasury)}
                    </p>
                    <span className="text-[10px] text-muted-foreground font-medium block">
                      🏦 {pBankAccounts.length} {pBankAccounts.length === 1 ? "Bank Account" : "Bank Accounts"} Linked
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSourceProjectId(p.id);
                      setTransferModalOpen(true);
                    }}
                    className="text-xs text-purple-600 border-purple-500/30 hover:bg-purple-500/10 gap-1 rounded-xl font-bold"
                  >
                    <ArrowRightLeft className="h-3 w-3" /> Transfer Funds
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Project Bank Accounts & Liquidity Vaults Grid */}
      <ProjectVaultsGrid
        projects={projects}
        bankAccounts={allBankAccounts}
        bookings={bookings}
        payments={installmentPayments}
        transfers={transfers}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onInitiateTransfer={(bankId, projId) => {
          setSourceProjectId(projId);
          setSourceBankAccountId(bankId);
          setTransferModalOpen(true);
        }}
        onAddNewAccount={(projId) => {
          if (projId) setInlineAddProjectId(projId);
          setInlineAddModalOpen(true);
        }}
      />

      {/* Inter-Project Fund Transfer History Ledger */}
      <InterProjectLedger
        transfers={transfers}
        isLoading={isLoadingTransfers}
        onOpenTransferModal={() => setTransferModalOpen(true)}
        onOpenRepayModal={(t) => {
          const remaining = Number(t.amount) - Number(t.repaid_amount || 0);
          setActiveTransfer(t);
          setRepayAmount(String(remaining));
          setRepayModalOpen(true);
        }}
        onOpenTallyModal={(t) => {
          setSelectedTallyTransfer(t);
          setTreasuryTallyModalOpen(true);
        }}
      />

      {/* Inter-Project Fund Transfer Modal */}
      <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-600 text-xl font-bold">
              <ArrowRightLeft className="h-5 w-5" /> Inter-Project Fund Transfer
            </DialogTitle>
            <DialogDescription>
              Reallocate funds from a project with surplus treasury directly to another project's designated bank account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Source & Target Project Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Source Project (From)</Label>
                <Select
                  value={sourceProjectId}
                  onValueChange={(val) => {
                    setSourceProjectId(val);
                    const accs = allBankAccounts.filter((b: any) => b.project_id === val);
                    const primary = accs.find((b: any) => b.is_primary) || accs[0];
                    setSourceBankAccountId(primary?.id || "");
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select Source Project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Target Project (To)</Label>
                <Select
                  value={targetProjectId}
                  onValueChange={(val) => {
                    setTargetProjectId(val);
                    const accs = allBankAccounts.filter((b: any) => b.project_id === val);
                    const primary = accs.find((b: any) => b.is_primary) || accs[0];
                    setTargetBankAccountId(primary?.id || "");
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select Target Project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p: any) => (
                      <SelectItem key={p.id} value={p.id} disabled={p.id === sourceProjectId}>
                        {p.name} ({p.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Source & Target Bank Account Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Source Bank Account */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground">Source Bank Account</Label>
                  {sourceProjectId && (
                    <button
                      type="button"
                      onClick={() => {
                        setInlineAddProjectId(sourceProjectId);
                        setInlineAddModalOpen(true);
                      }}
                      className="text-[11px] text-terracotta hover:underline font-medium"
                    >
                      + Add A/C
                    </button>
                  )}
                </div>
                {sourceProjectId ? (
                  sourceProjectAccounts.length > 0 ? (
                    <Select value={sourceBankAccountId} onValueChange={setSourceBankAccountId}>
                      <SelectTrigger className="mt-1 h-10 text-xs">
                        <SelectValue placeholder="Select Source Bank Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceProjectAccounts.map((b: any) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.bank_name} ({b.account_type}) - ••••{b.account_number.slice(-4)}
                            {b.is_primary ? " ★ Primary" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-1 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-2">
                      <span>No bank accounts linked to source project</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px] bg-background"
                        onClick={() => {
                          setInlineAddProjectId(sourceProjectId);
                          setInlineAddModalOpen(true);
                        }}
                      >
                        + Add Now
                      </Button>
                    </div>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground mt-2 italic">Select source project first</p>
                )}
              </div>

              {/* Target Bank Account */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground">Target Destination Bank Account</Label>
                  {targetProjectId && (
                    <button
                      type="button"
                      onClick={() => {
                        setInlineAddProjectId(targetProjectId);
                        setInlineAddModalOpen(true);
                      }}
                      className="text-[11px] text-emerald-600 hover:underline font-medium"
                    >
                      + Add A/C
                    </button>
                  )}
                </div>
                {targetProjectId ? (
                  targetProjectAccounts.length > 0 ? (
                    <Select value={targetBankAccountId} onValueChange={setTargetBankAccountId}>
                      <SelectTrigger className="mt-1 h-10 text-xs">
                        <SelectValue placeholder="Select Target Bank Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {targetProjectAccounts.map((b: any) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.bank_name} ({b.account_type}) - ••••{b.account_number.slice(-4)}
                            {b.is_primary ? " ★ Primary" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-1 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-2">
                      <span>No bank accounts linked to target project</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px] bg-background"
                        onClick={() => {
                          setInlineAddProjectId(targetProjectId);
                          setInlineAddModalOpen(true);
                        }}
                      >
                        + Add Now
                      </Button>
                    </div>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground mt-2 italic">Select target project first</p>
                )}
              </div>
            </div>

            {/* Interactive Visual Transfer Flow Preview Box */}
            {sourceProjectId && targetProjectId && (
              <div className="p-3.5 rounded-xl border border-purple-500/30 bg-gradient-to-r from-amber-500/[0.06] via-card to-emerald-500/[0.06] text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-purple-600 dark:text-purple-400">
                    Bank-to-Bank Transfer Route Preview
                  </p>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Instant NEFT / RTGS Wire
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 font-mono">
                  {/* Source Bank Box */}
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] space-y-0.5">
                    <span className="text-[9px] font-extrabold uppercase text-amber-700 dark:text-amber-300 block">
                      DEBIT ORIGIN
                    </span>
                    <span className="font-bold text-foreground block truncate">
                      {allBankAccounts.find((b: any) => b.id === sourceBankAccountId)?.bank_name || "General Treasury"}
                    </span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {allBankAccounts.find((b: any) => b.id === sourceBankAccountId)?.account_number
                        ? `•••• ${allBankAccounts.find((b: any) => b.id === sourceBankAccountId)?.account_number.slice(-4)}`
                        : "Treasury A/c"}
                    </span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold block truncate">
                      🏢 {projects.find((p: any) => p.id === sourceProjectId)?.name}
                    </span>
                  </div>

                  {/* Wire Flow Arrow */}
                  <div className="flex flex-col items-center px-1">
                    <span className="font-extrabold text-purple-600 dark:text-purple-400 text-xs">
                      {transferAmount ? money(Number(transferAmount)) : "₹0"}
                    </span>
                    <div className="flex items-center text-purple-500 my-1">
                      <span className="h-0.5 w-6 bg-purple-500 inline-block animate-pulse" />
                      <ArrowRight className="h-4 w-4 -ml-1 text-purple-600" />
                    </div>
                    <span className="text-[9px] text-muted-foreground uppercase font-bold">Transfer</span>
                  </div>

                  {/* Target Bank Box */}
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[11px] space-y-0.5">
                    <span className="text-[9px] font-extrabold uppercase text-emerald-700 dark:text-emerald-300 block">
                      CREDIT DESTINATION
                    </span>
                    <span className="font-bold text-foreground block truncate">
                      {allBankAccounts.find((b: any) => b.id === targetBankAccountId)?.bank_name || "General Treasury"}
                    </span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {allBankAccounts.find((b: any) => b.id === targetBankAccountId)?.account_number
                        ? `•••• ${allBankAccounts.find((b: any) => b.id === targetBankAccountId)?.account_number.slice(-4)}`
                        : "Treasury A/c"}
                    </span>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold block truncate">
                      🏢 {projects.find((p: any) => p.id === targetProjectId)?.name}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Transfer Amount (₹) *</Label>
              <div className="mt-1">
                <CurrencyInput
                  placeholder="e.g. 5,00,000"
                  value={transferAmount}
                  onChange={setTransferAmount}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Repayment Target Date (Optional)</Label>
                <Input
                  type="date"
                  className="mt-1 text-xs"
                  value={repaymentDueDate}
                  onChange={(e) => setRepaymentDueDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Transfer Purpose / Narration</Label>
                <Input
                  placeholder="e.g. Infrastructure development"
                  className="mt-1 text-xs"
                  value={transferPurpose}
                  onChange={(e) => setTransferPurpose(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTransferModalOpen(false)}
              disabled={createTransferMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => createTransferMutation.mutate()}
              disabled={
                createTransferMutation.isPending ||
                !sourceProjectId ||
                !targetProjectId ||
                !transferAmount
              }
              className="bg-purple-700 hover:bg-purple-800 text-white"
            >
              {createTransferMutation.isPending ? "Executing Transfer..." : "Confirm & Transfer Funds"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repay Fund Modal */}
      <Dialog open={repayModalOpen} onOpenChange={(open) => !open && setRepayModalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <RotateCcw className="h-5 w-5" /> Repay Funds Back to Source
            </DialogTitle>
            <DialogDescription>
              Return capital from {activeTransfer?.target_project?.name || "Target Project"} back to {activeTransfer?.source_project?.name || "Source Project"}.
            </DialogDescription>
          </DialogHeader>

          {activeTransfer && (
            <div className="space-y-4">
              <div className="rounded-xl border p-3.5 bg-muted/20 space-y-1 text-xs">
                <p className="text-muted-foreground uppercase tracking-wider font-semibold text-[10px]">Transfer Summary</p>
                <p className="font-semibold text-sm">
                  {activeTransfer.source_project?.name || "Source"} ➔ {activeTransfer.target_project?.name || "Target"}
                </p>
                <p className="text-muted-foreground">
                  Original Loan: {money(Number(activeTransfer.amount))} • Already Repaid: {money(Number(activeTransfer.repaid_amount || 0))}
                </p>
                <p className="font-bold text-terracotta text-sm mt-1">
                  Remaining Due: {money(Number(activeTransfer.amount) - Number(activeTransfer.repaid_amount || 0))}
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Repayment Amount (₹)</Label>
                <div className="mt-1">
                  <CurrencyInput
                    placeholder="e.g. 2,00,000"
                    value={repayAmount}
                    onChange={setRepayAmount}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Repayment Notes (Optional)</Label>
                <Input
                  placeholder="e.g. Returned after Phase 2 customer collections"
                  className="mt-1 text-xs"
                  value={repayNotes}
                  onChange={(e) => setRepayNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRepayModalOpen(false)}
              disabled={repayTransferMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => repayTransferMutation.mutate()}
              disabled={repayTransferMutation.isPending || !repayAmount}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {repayTransferMutation.isPending ? "Recording Repayment..." : "Confirm Repayment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Treasury Tally Statement Breakdown Modal */}
      <TreasuryTallyLedgerModal
        transfer={selectedTallyTransfer}
        open={treasuryTallyModalOpen}
        onOpenChange={setTreasuryTallyModalOpen}
      />

      {/* Portfolio Bank Accounts Master Registry Modal */}
      <ProjectAccountsRegistryModal
        open={registryModalOpen}
        onOpenChange={setRegistryModalOpen}
        projects={projects}
      />

      {/* Inline Bank Account Creation Dialog for Treasury Transfers */}
      {inlineAddModalOpen && (
        <AddEditBankAccountDialog
          projectId={inlineAddProjectId}
          projects={projects}
          open={inlineAddModalOpen}
          onOpenChange={setInlineAddModalOpen}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["treasury-all-bank-accounts"] });
          }}
        />
      )}
    </div>
  );
}
