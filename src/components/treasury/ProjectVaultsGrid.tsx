import { useState, useMemo } from "react";
import {
  Landmark,
  Building2,
  Search,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Sparkles,
  CreditCard,
  Wifi,
  ShieldCheck,
  CheckCircle2,
  Coins,
  ArrowRightLeft,
  BookOpen,
  PieChart,
} from "lucide-react";
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
import { BankAccountPassbookModal } from "./BankAccountPassbookModal";

interface ProjectVaultsGridProps {
  projects: any[];
  bankAccounts: any[];
  bookings: any[];
  payments: any[];
  transfers: any[];
  selectedProjectId?: string;
  onSelectProject?: (projectId: string) => void;
  onInitiateTransfer?: (sourceBankId: string, projectId: string) => void;
  onAddNewAccount?: (projectId?: string) => void;
}

const money = (val: number) =>
  `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function ProjectVaultsGrid({
  projects,
  bankAccounts,
  bookings,
  payments,
  transfers,
  selectedProjectId = "all",
  onSelectProject,
  onInitiateTransfer,
  onAddNewAccount,
}: ProjectVaultsGridProps) {
  const [internalProjectFilter, setInternalProjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const projectFilter = selectedProjectId !== undefined ? selectedProjectId : internalProjectFilter;
  const setProjectFilter = (id: string) => {
    if (onSelectProject) onSelectProject(id);
    setInternalProjectFilter(id);
  };

  const [selectedPassbookAccount, setSelectedPassbookAccount] = useState<any | null>(null);
  const [passbookOpen, setPassbookOpen] = useState(false);

  // Map project ID to Project object
  const projectMap = useMemo(() => {
    return new Map<string, any>(projects.map((p) => [p.id, p]));
  }, [projects]);

  const activeProject = useMemo(() => {
    if (projectFilter === "all") return null;
    return projectMap.get(projectFilter);
  }, [projectFilter, projectMap]);

  // Compute live balances, total collections, and financial metrics for EVERY bank account
  const accountsWithMetrics = useMemo(() => {
    return bankAccounts.map((acc: any) => {
      const accId = acc.id;
      const proj = projectMap.get(acc.project_id);

      // 1. Direct Booking Downpayments
      const directBookings = bookings.filter((b: any) => {
        const bookingBankId =
          b.bank_account_id ||
          (Array.isArray(b.approval_history)
            ? [...b.approval_history].reverse().find((h: any) => h.bank_account_id)?.bank_account_id
            : null);

        return (
          bookingBankId === accId ||
          (!bookingBankId && acc.is_primary && b.plots?.project_id === acc.project_id)
        );
      });
      const bookingCollections = directBookings.reduce(
        (sum: number, b: any) => sum + Number(b.advance_paid || b.booking_amount || 0),
        0
      );

      // 2. Direct Installment / EMI Collections
      const directPayments = payments.filter((p: any) => {
        return (
          p.bank_account_id === accId ||
          (!p.bank_account_id && acc.is_primary && p.booking?.plots?.project_id === acc.project_id)
        );
      });
      const installmentCollections = directPayments.reduce(
        (sum: number, p: any) => sum + Number(p.amount || 0),
        0
      );

      const totalCollections = bookingCollections + installmentCollections;

      // 3. Treasury Capital Shifts
      const incomingTransfers = transfers
        .filter((t: any) => t.target_bank_account_id === accId)
        .reduce((sum: number, t: any) => sum + Number(t.transfer_amount || t.amount || 0), 0);

      const outgoingTransfers = transfers
        .filter((t: any) => t.source_bank_account_id === accId)
        .reduce((sum: number, t: any) => sum + Number(t.transfer_amount || t.amount || 0), 0);

      const repaymentsRecovered = transfers
        .filter((t: any) => t.source_bank_account_id === accId)
        .reduce((sum: number, t: any) => sum + Number(t.repaid_amount || 0), 0);

      const repaymentsSentOut = transfers
        .filter((t: any) => t.target_bank_account_id === accId)
        .reduce((sum: number, t: any) => sum + Number(t.repaid_amount || 0), 0);

      const netTreasuryShift =
        incomingTransfers - outgoingTransfers + repaymentsRecovered - repaymentsSentOut;

      const openingBal = Number(acc.opening_balance || 0);
      const liveBalance = Math.max(0, openingBal + totalCollections + netTreasuryShift);

      return {
        ...acc,
        project: proj,
        bookingCollections,
        installmentCollections,
        totalCollections,
        incomingTransfers,
        outgoingTransfers,
        netTreasuryShift,
        liveBalance,
        totalTransactions: directBookings.length + directPayments.length,
      };
    });
  }, [bankAccounts, projectMap, bookings, payments, transfers]);

  // Determine top account with maximum balance (Leaderboard Winner)
  const highestBalanceAccountId = useMemo(() => {
    if (accountsWithMetrics.length === 0) return null;
    const sorted = [...accountsWithMetrics].sort((a, b) => b.liveBalance - a.liveBalance);
    return sorted[0]?.liveBalance > 0 ? sorted[0].id : null;
  }, [accountsWithMetrics]);

  // Filtered accounts list
  const filteredAccounts = useMemo(() => {
    return accountsWithMetrics.filter((acc: any) => {
      if (projectFilter !== "all" && acc.project_id !== projectFilter) return false;
      if (typeFilter !== "all" && acc.account_type !== typeFilter) return false;

      if (!search.trim()) return true;
      const s = search.toLowerCase();
      const prjName = acc.project?.name?.toLowerCase() || "";
      const bankName = acc.bank_name?.toLowerCase() || "";
      const accNum = acc.account_number?.toLowerCase() || "";
      const ifsc = acc.ifsc_code?.toLowerCase() || "";

      return prjName.includes(s) || bankName.includes(s) || accNum.includes(s) || ifsc.includes(s);
    });
  }, [accountsWithMetrics, projectFilter, typeFilter, search]);

  // Overall Total Treasury for the active view
  const currentViewTotalBalance = useMemo(() => {
    return filteredAccounts.reduce((sum, a) => sum + a.liveBalance, 0);
  }, [filteredAccounts]);

  const currentViewTotalCollected = useMemo(() => {
    return filteredAccounts.reduce((sum, a) => sum + a.totalCollections, 0);
  }, [filteredAccounts]);

  const handleOpenPassbook = (acc: any) => {
    setSelectedPassbookAccount(acc);
    setPassbookOpen(true);
  };

  // Card background styling based on bank identity
  const getCardTheme = (bankName: string = "") => {
    const lower = bankName.toLowerCase();
    if (lower.includes("hdfc")) {
      return "from-[#071739] via-[#0b2559] to-[#041026] border-[#1d4ed8]/30 shadow-blue-950/40";
    }
    if (lower.includes("sbi") || lower.includes("state bank")) {
      return "from-[#081f3d] via-[#103a6b] to-[#041326] border-[#0284c7]/30 shadow-sky-950/40";
    }
    if (lower.includes("icici")) {
      return "from-[#380d13] via-[#52131b] to-[#1f060a] border-[#b91c1c]/30 shadow-rose-950/40";
    }
    if (lower.includes("axis")) {
      return "from-[#300a1c] via-[#470f2a] to-[#1a040e] border-[#be185d]/30 shadow-pink-950/40";
    }
    if (lower.includes("kotak")) {
      return "from-[#330c11] via-[#24080b] to-[#120406] border-[#dc2626]/30 shadow-red-950/40";
    }
    return "from-[#111827] via-[#1f2937] to-[#090d16] border-border/40 shadow-slate-950/40";
  };

  return (
    <div className="space-y-5" id="project-vaults-section">
      {/* Treasury Vaults Header & Overview Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-card via-card to-muted/40 border border-border/80 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="p-2 rounded-xl bg-terracotta/10 text-terracotta border border-terracotta/20">
                <Landmark className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black tracking-tight text-foreground">
                {activeProject ? (
                  <span>{activeProject.name} — Bank Accounts & Vaults</span>
                ) : (
                  <span>All Projects — Bank Vaults & Liquidity Hub</span>
                )}
              </h2>
              {activeProject && (
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider font-mono">
                  {activeProject.code}
                </Badge>
              )}
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black">
                {filteredAccounts.length} {filteredAccounts.length === 1 ? "Vault" : "Vaults"} Linked
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {activeProject ? (
                <span>
                  Showing real-time liquid balance, direct plot collections, and RERA escrow reserves specifically for <strong>{activeProject.name}</strong>.
                </span>
              ) : (
                <span>
                  Real-time monitoring of cash liquidity, RERA escrow compliance, direct plot collections, and inter-project transfers across all bank accounts. Click on any project card above to view its dedicated vaults.
                </span>
              )}
            </p>
          </div>

          {/* Quick Aggregate Indicators */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="px-4 py-3 rounded-2xl bg-background/90 border border-border/80 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">
                {activeProject ? `${activeProject.code} Liquid Balance` : "Total Company Balance"}
              </span>
              <span className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-400 block mt-0.5">
                {money(currentViewTotalBalance)}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5 font-medium">
                Across {filteredAccounts.length} active {filteredAccounts.length === 1 ? "account" : "accounts"}
              </span>
            </div>

            <div className="px-4 py-3 rounded-2xl bg-background/90 border border-border/80 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">
                Total Collections Received
              </span>
              <span className="text-xl font-black font-mono text-foreground block mt-0.5">
                {money(currentViewTotalCollected)}
              </span>
              <span className="text-[10px] text-emerald-600 block mt-0.5 font-semibold">
                Downpayments & EMIs combined
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1 flex-wrap">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bank, account #, IFSC..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-background"
            />
          </div>

          {/* Project Filter */}
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-9 text-xs rounded-xl w-full sm:w-48 bg-background">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Projects ({projects.length})</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Account Type Filter */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 text-xs rounded-xl w-full sm:w-44 bg-background">
              <SelectValue placeholder="Account Type" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Account Types</SelectItem>
              <SelectItem value="Escrow">RERA Escrow Accounts</SelectItem>
              <SelectItem value="Current">Current / Operating</SelectItem>
              <SelectItem value="Collection">Collection Accounts</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {onAddNewAccount && (
          <Button
            size="sm"
            onClick={() => onAddNewAccount(projectFilter !== "all" ? projectFilter : undefined)}
            className="h-9 bg-terracotta hover:bg-terracotta/90 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Add Bank Account
          </Button>
        )}
      </div>

      {/* Bank Vault Digital Cards Grid */}
      {filteredAccounts.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 border border-dashed rounded-3xl p-8 space-y-3">
          <Landmark className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="font-bold text-sm text-foreground">No bank accounts matched your filter</p>
          <p className="text-xs text-muted-foreground">
            Try adjusting your search query or add a bank account for this project.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredAccounts.map((acc: any) => {
            const isHighest = acc.id === highestBalanceAccountId;
            const projectBalanceSum = accountsWithMetrics
              .filter((a) => a.project_id === acc.project_id)
              .reduce((sum, a) => sum + a.liveBalance, 0);

            const liquidityShare =
              projectBalanceSum > 0 ? Math.round((acc.liveBalance / projectBalanceSum) * 100) : 0;

            const themeClasses = getCardTheme(acc.bank_name);

            return (
              <div
                key={acc.id}
                className="group relative flex flex-col justify-between rounded-3xl bg-card border border-border/80 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                {/* Visual Metal / ATM Card Header */}
                <div
                  className={`p-5 rounded-t-3xl bg-gradient-to-br ${themeClasses} text-white relative overflow-hidden border-b`}
                >
                  {/* Subtle Background Pattern */}
                  <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/5 rounded-full blur-2xl pointer-events-none" />

                  {/* Leaderboard Badge if Richest Account */}
                  {isHighest && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400 text-amber-950 font-black text-[9px] uppercase tracking-wider shadow-lg animate-pulse">
                      <Sparkles className="h-3 w-3 fill-amber-950" />
                      Highest Liquidity Vault
                    </div>
                  )}

                  {/* Top Row: Chip & Wi-Fi */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {/* Gold Chip simulation */}
                      <div className="w-9 h-7 rounded-md bg-gradient-to-tr from-amber-300 via-amber-100 to-amber-400 border border-amber-500/50 shadow-inner flex flex-col justify-around px-1 py-0.5">
                        <div className="w-full h-px bg-amber-700/40" />
                        <div className="w-full h-px bg-amber-700/40" />
                      </div>
                      <Wifi className="h-4 w-4 text-white/60 rotate-90" />
                    </div>

                    {!isHighest && acc.is_primary && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                        Primary Escrow
                      </span>
                    )}
                  </div>

                  {/* Live Balance Highlight */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-white/60">
                      Live Available Balance
                    </span>
                    <div className="text-2xl font-black font-mono tracking-tight text-white">
                      {money(acc.liveBalance)}
                    </div>
                  </div>

                  {/* Masked Account Number & Bank Name */}
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <span className="font-mono text-sm tracking-widest text-white/90 block font-extrabold">
                        •••• •••• •••• {acc.account_number?.slice(-4) || "0000"}
                      </span>
                      <span className="text-[11px] font-bold text-white/80 block mt-0.5">
                        {acc.bank_name}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-white/60 block font-mono">
                        {acc.ifsc_code || "IFSC Registered"}
                      </span>
                      <span className="text-[10px] text-white/90 font-bold block truncate max-w-[120px]">
                        {acc.project?.name || "Project"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Body & Operational Analytics */}
                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between bg-card">
                  <div className="space-y-3">
                    {/* Collection Stats */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2.5 rounded-2xl bg-muted/40 border border-border/50">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                          Total Collections
                        </span>
                        <span className="text-sm font-extrabold font-mono text-foreground block mt-0.5">
                          {money(acc.totalCollections)}
                        </span>
                        <span className="text-[9px] text-emerald-600 font-semibold block mt-0.5">
                          {acc.totalTransactions} verified receipts
                        </span>
                      </div>

                      <div className="p-2.5 rounded-2xl bg-muted/40 border border-border/50">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                          Net Treasury Shift
                        </span>
                        <span
                          className={`text-sm font-extrabold font-mono block mt-0.5 ${
                            acc.netTreasuryShift > 0
                              ? "text-emerald-600"
                              : acc.netTreasuryShift < 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {acc.netTreasuryShift > 0
                            ? `+${money(acc.netTreasuryShift)}`
                            : acc.netTreasuryShift < 0
                            ? `-${money(Math.abs(acc.netTreasuryShift))}`
                            : "₹0"}
                        </span>
                        <span className="text-[9px] text-muted-foreground block mt-0.5">
                          Inter-project transfers
                        </span>
                      </div>
                    </div>

                    {/* Liquidity Share Gauge */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground font-medium flex items-center gap-1">
                          <PieChart className="h-3 w-3 text-terracotta" />
                          Project Fund Share
                        </span>
                        <span className="font-extrabold text-foreground font-mono">
                          {liquidityShare}% of Project Liquidity
                        </span>
                      </div>
                      <Progress value={liquidityShare} className="h-1.5" />
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenPassbook(acc)}
                      className="h-9 rounded-xl text-xs font-bold gap-1.5 shadow-2xs hover:bg-background"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-terracotta" />
                      View Passbook
                    </Button>

                    {onInitiateTransfer ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onInitiateTransfer(acc.id, acc.project_id)}
                        className="h-9 rounded-xl text-xs font-bold gap-1.5 bg-terracotta/10 hover:bg-terracotta/20 text-terracotta"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        Transfer Liquidity
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenPassbook(acc)}
                        className="h-9 rounded-xl text-xs font-semibold"
                      >
                        Details
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dedicated Bank Account Passbook Modal */}
      {selectedPassbookAccount && (
        <BankAccountPassbookModal
          open={passbookOpen}
          onOpenChange={setPassbookOpen}
          bankAccount={selectedPassbookAccount}
          project={selectedPassbookAccount.project}
          bookings={bookings}
          payments={payments}
          transfers={transfers}
        />
      )}
    </div>
  );
}
