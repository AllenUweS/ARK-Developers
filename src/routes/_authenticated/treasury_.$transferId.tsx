import { useState, useMemo, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { printElement } from "@/lib/printUtils";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileText,
  History,
  Landmark,
  Printer,
  RotateCcw,
  ShieldCheck,
  User,
  Wallet,
  AlertCircle,
  Sparkles,
  Loader2,
  CreditCard,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/treasury_/$transferId")({
  component: TransferDetailPage,
});

const money = (val: number) =>
  `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function TransferDetailPage() {
  const { transferId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const printCertRef = useRef<HTMLDivElement>(null);

  const [repayModalOpen, setRepayModalOpen] = useState(false);
  const [repayAmount, setRepayAmount] = useState("");
  const [repayNotes, setRepayNotes] = useState("");

  // Role check
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
    queryKey: ["treasury-detail-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return data ?? [];
    },
  });

  // Fetch Transfer details
  const { data: rawTransfer, isLoading: isLoadingTransfer } = useQuery({
    queryKey: ["project-fund-transfer-detail", transferId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_fund_transfers")
        .select("*")
        .eq("id", transferId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch Source Project
  const { data: sourceProject } = useQuery({
    queryKey: ["project-source", rawTransfer?.source_project_id],
    enabled: !!rawTransfer?.source_project_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*, plots(id, price, status)")
        .eq("id", rawTransfer.source_project_id)
        .maybeSingle();
      return data;
    },
  });

  // Fetch Target Project
  const { data: targetProject } = useQuery({
    queryKey: ["project-target", rawTransfer?.target_project_id],
    enabled: !!rawTransfer?.target_project_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*, plots(id, price, status)")
        .eq("id", rawTransfer.target_project_id)
        .maybeSingle();
      return data;
    },
  });

  // Fetch Source Bank Account
  const { data: sourceBankAccount } = useQuery({
    queryKey: ["bank-account-source", rawTransfer?.source_bank_account_id],
    enabled: !!rawTransfer?.source_bank_account_id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("project_bank_accounts")
        .select("*")
        .eq("id", rawTransfer.source_bank_account_id)
        .maybeSingle();
      return data;
    },
  });

  // Fetch Target Bank Account
  const { data: targetBankAccount } = useQuery({
    queryKey: ["bank-account-target", rawTransfer?.target_bank_account_id],
    enabled: !!rawTransfer?.target_bank_account_id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("project_bank_accounts")
        .select("*")
        .eq("id", rawTransfer.target_bank_account_id)
        .maybeSingle();
      return data;
    },
  });

  // Fetch Initiator Profile
  const { data: initiatorProfile } = useQuery({
    queryKey: ["profile-initiator", rawTransfer?.transferred_by],
    enabled: !!rawTransfer?.transferred_by,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, phone, job_title")
        .eq("id", rawTransfer.transferred_by)
        .maybeSingle();
      return data;
    },
  });

  // Fetch Raw Repayments History (No complex join syntax to prevent errors)
  const { data: rawRepayments = [], isLoading: isLoadingRepayments } = useQuery({
    queryKey: ["transfer-repayments-list", transferId],
    enabled: !!transferId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_transfer_repayments")
        .select("*")
        .eq("transfer_id", transferId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching repayments:", error);
        return [];
      }
      return data ?? [];
    },
  });

  // Map profiles to repayments locally
  const repayments = useMemo(() => {
    const profileMap = new Map(profiles.map((pr: any) => [pr.id, pr]));

    return rawRepayments.map((r: any) => ({
      ...r,
      profile: profileMap.get(r.repaid_by),
    }));
  }, [rawRepayments, profiles]);

  // Repayment Mutation
  const repayTransferMutation = useMutation({
    mutationFn: async () => {
      if (!transfer) return;
      const amt = Number(repayAmount);
      const remaining = Number(transfer.amount) - Number(transfer.repaid_amount || 0);

      if (isNaN(amt) || amt <= 0) throw new Error("Enter a valid repayment amount");
      if (amt > remaining) throw new Error(`Repayment cannot exceed remaining balance of ${money(remaining)}`);

      // 1. Insert repayment record
      const { error: rErr } = await (supabase as any).from("project_transfer_repayments").insert({
        transfer_id: transfer.id,
        amount: amt,
        repaid_by: user.id,
        notes: repayNotes || null,
      });
      if (rErr) throw rErr;

      // 2. Update transfer record
      const newRepaidTotal = Number(transfer.repaid_amount || 0) + amt;
      const isFullyRepaid = newRepaidTotal >= Number(transfer.amount);

      const { error: tErr } = await (supabase as any)
        .from("project_fund_transfers")
        .update({
          repaid_amount: newRepaidTotal,
          status: isFullyRepaid ? "repaid" : "partially_repaid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transfer.id);

      if (tErr) throw tErr;
    },
    onSuccess: () => {
      toast.success("Fund repayment recorded successfully!");
      setRepayModalOpen(false);
      setRepayAmount("");
      setRepayNotes("");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to record repayment"),
  });

  const totalRepaidFromTable = useMemo(() => {
    return rawRepayments.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
  }, [rawRepayments]);

  const effectiveRepaid = useMemo(() => {
    if (!rawTransfer) return 0;
    return Math.max(Number(rawTransfer.repaid_amount || 0), totalRepaidFromTable);
  }, [rawTransfer, totalRepaidFromTable]);

  const transfer = useMemo(() => {
    if (!rawTransfer) return null;
    const isFullyPaid = effectiveRepaid >= Number(rawTransfer.amount || 0);
    return {
      ...rawTransfer,
      repaid_amount: effectiveRepaid,
      status: isFullyPaid ? "repaid" : effectiveRepaid > 0 ? "partially_repaid" : (rawTransfer.status || "active"),
    };
  }, [rawTransfer, effectiveRepaid]);

  const remainingBalance = useMemo(() => {
    if (!transfer) return 0;
    return Math.max(0, Number(transfer.amount) - Number(effectiveRepaid));
  }, [transfer, effectiveRepaid]);

  const repaidPercentage = useMemo(() => {
    if (!transfer || !transfer.amount) return 0;
    return Math.min(100, Math.round((Number(effectiveRepaid) / Number(transfer.amount)) * 100));
  }, [transfer, effectiveRepaid]);

  const isRepaid = transfer?.status === "repaid" || remainingBalance === 0;

  if (isLoadingTransfer) {
    return (
      <div className="p-16 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto" />
        <p className="text-sm text-muted-foreground">Loading transaction flow details...</p>
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="p-12 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <h2 className="text-lg font-bold">Transaction Not Found</h2>
        <p className="text-sm text-muted-foreground">This fund transfer record does not exist or has been removed.</p>
        <Button onClick={() => navigate({ to: "/treasury" })} variant="outline">
          Back to Treasury
        </Button>
      </div>
    );
  }

  const handlePrintCertificate = () => {
    printElement(printCertRef.current, {
      title: `ARK_Capital_Transfer_Audit_Certificate_${transfer.id.slice(0, 8)}`,
      pageSize: "A4 portrait",
      pageMargin: "8mm 10mm",
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/treasury"
            className="p-2 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <img
            src="/ark-logo.png"
            alt="Ark Logo"
            className="h-10 w-auto object-contain shrink-0 hidden sm:block"
            onError={(e: any) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Transaction Audit Flow
              </span>
              <span className="text-xs text-muted-foreground">ID: #{transfer.id.slice(0, 8)}</span>
            </div>
            <h1 className="text-display text-2xl sm:text-3xl font-bold tracking-tight mt-1">
              Capital Transfer Inspection
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintCertificate}
            className="text-xs gap-1.5 border-border/80 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" /> Print Audit Certificate
          </Button>

          {!isRepaid && isManagementOrAdmin && (
            <Button
              size="sm"
              onClick={() => {
                setRepayAmount(String(remainingBalance));
                setRepayModalOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-sm cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Repay Funds Back
            </Button>
          )}
        </div>
      </div>

      {/* VISUAL CAPITAL FLOW CONNECTOR DIAGRAM (Source ➔ Transfer ➔ Destination) */}
      <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-500/[0.06] via-card to-emerald-500/[0.06] p-6 md:p-8 shadow-xs">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] items-center relative z-10">
          {/* SOURCE PROJECT BOX (Where it came from) */}
          <div className="rounded-2xl border border-terracotta/30 bg-card p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-terracotta px-2 py-0.5 rounded-md bg-terracotta/10 border border-terracotta/20">
                SOURCE PROJECT (CAPITAL ORIGIN)
              </span>
              <Building2 className="h-4 w-4 text-terracotta" />
            </div>

            <div>
              <h3 className="text-xl font-bold">{sourceProject?.name || "Source Project"}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Code: {sourceProject?.code || "N/A"}</p>
            </div>

            {/* Bank Account Details */}
            {sourceBankAccount ? (
              <div className="p-2.5 rounded-lg bg-terracotta/10 border border-terracotta/20 text-xs space-y-0.5">
                <p className="font-semibold text-terracotta flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> {sourceBankAccount.bank_name} ({sourceBankAccount.account_type})
                </p>
                <p className="font-mono text-[11px] text-foreground">
                  A/C: {sourceBankAccount.account_number}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  IFSC: {sourceBankAccount.ifsc_code} • {sourceBankAccount.branch_name || "Main Branch"}
                </p>
              </div>
            ) : (
              <div className="p-2 rounded bg-muted/40 text-[11px] text-muted-foreground italic">
                General Treasury Account
              </div>
            )}

            <div className="pt-3 border-t border-border/50 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground text-[11px]">Location</p>
                <p className="font-medium truncate">{sourceProject?.location || "Main Site"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[11px]">Outflow Shift</p>
                <p className="font-bold text-terracotta">−{money(Number(transfer.amount))}</p>
              </div>
            </div>
          </div>

          {/* CAPITAL FLOW CONNECTOR */}
          <div className="flex flex-col items-center justify-center p-4 space-y-2 text-center">
            <div className="px-4 py-2 rounded-2xl bg-purple-600 text-white font-bold text-lg shadow-md flex items-center gap-2 animate-pulse">
              <Coins className="h-5 w-5" /> {money(Number(transfer.amount))}
            </div>

            <div className="flex items-center gap-2 text-purple-500 font-semibold text-xs my-1">
              <span>OUTFLOW</span>
              <div className="flex items-center">
                <span className="h-0.5 w-8 bg-purple-500 inline-block animate-pulse" />
                <ArrowRight className="h-4 w-4 -ml-1" />
              </div>
              <span>INFLOW</span>
            </div>

            <span className="text-[11px] text-muted-foreground font-medium">
              Transferred on {new Date(transfer.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>

          {/* DESTINATION PROJECT BOX (Where it went) */}
          <div className="rounded-2xl border border-emerald-500/30 bg-card p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                TARGET PROJECT (CAPITAL DESTINATION)
              </span>
              <Landmark className="h-4 w-4 text-emerald-500" />
            </div>

            <div>
              <h3 className="text-xl font-bold">{targetProject?.name || "Target Project"}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Code: {targetProject?.code || "N/A"}</p>
            </div>

            {/* Bank Account Details */}
            {targetBankAccount ? (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-0.5">
                <p className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> {targetBankAccount.bank_name} ({targetBankAccount.account_type})
                </p>
                <p className="font-mono text-[11px] text-foreground">
                  A/C: {targetBankAccount.account_number}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  IFSC: {targetBankAccount.ifsc_code} • {targetBankAccount.branch_name || "Main Branch"}
                </p>
              </div>
            ) : (
              <div className="p-2 rounded bg-muted/40 text-[11px] text-muted-foreground italic">
                General Treasury Account
              </div>
            )}

            <div className="pt-3 border-t border-border/50 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground text-[11px]">Location</p>
                <p className="font-medium truncate">{targetProject?.location || "Main Site"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[11px]">Inflow Boost</p>
                <p className="font-bold text-emerald-600 dark:text-emerald-400">+{money(Number(transfer.amount))}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PREMIUM REPAYMENT RECOVERY FINANCIAL METER */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/[0.07] via-card to-teal-500/[0.07] p-6 md:p-7 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  Live Capital Recovery Gauge
                </span>
                {repaidPercentage === 100 && (
                  <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> 100% Settled
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold mt-0.5">Repayment Recovery Meter</h3>
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {repaidPercentage}%
            </span>
            <p className="text-xs text-muted-foreground font-medium">
              {money(Number(transfer.repaid_amount || 0))} of {money(Number(transfer.amount))} Returned
            </p>
          </div>
        </div>

        {/* Custom High-Tech Visual Meter Bar */}
        <div className="space-y-2">
          <div className="relative h-4 w-full rounded-full bg-muted/60 overflow-hidden border border-emerald-500/20 p-0.5 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300 transition-all duration-1000 ease-out relative shadow-md"
              style={{ width: `${repaidPercentage}%` }}
            >
              {/* Animated Light Shimmer Overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] animate-pulse" />
            </div>
          </div>

          {/* Visual Milestone Trackers */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 px-1">
            <div className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>0% Disbursed</span>
            </div>

            <div className={`flex items-center gap-1 font-medium ${repaidPercentage >= 25 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
              <span className={`h-2 w-2 rounded-full ${repaidPercentage >= 25 ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
              <span>25% Return</span>
            </div>

            <div className={`flex items-center gap-1 font-medium ${repaidPercentage >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
              <span className={`h-2 w-2 rounded-full ${repaidPercentage >= 50 ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
              <span>50% Halfway</span>
            </div>

            <div className={`flex items-center gap-1 font-medium ${repaidPercentage >= 75 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
              <span className={`h-2 w-2 rounded-full ${repaidPercentage >= 75 ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
              <span>75% Almost Settled</span>
            </div>

            <div className={`flex items-center gap-1 font-bold ${repaidPercentage === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
              <span className={`h-2 w-2 rounded-full ${repaidPercentage === 100 ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
              <span>100% Fully Recovered</span>
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY STATS & LOAN HEALTH */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5 space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Original Capital Loan</p>
          <p className="text-2xl font-bold text-display">{money(Number(transfer.amount))}</p>
          <p className="text-xs text-muted-foreground">Initial amount transferred</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Repaid Back</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {money(Number(transfer.repaid_amount || 0))}
          </p>
          <p className="text-xs text-muted-foreground">Returned to source project</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Outstanding Principal</p>
          <p className={`text-2xl font-bold ${remainingBalance > 0 ? "text-terracotta" : "text-emerald-600"}`}>
            {money(remainingBalance)}
          </p>
          <p className="text-xs text-muted-foreground">Remaining balance due</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Loan Health Status</p>
          <div className="mt-1">
            {isRepaid ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs px-2.5 py-1">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Fully Settled
              </Badge>
            ) : transfer.repaid_amount > 0 ? (
              <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-xs px-2.5 py-1">
                Partially Repaid
              </Badge>
            ) : (
              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs px-2.5 py-1">
                Active Capital Loan
              </Badge>
            )}
          </div>
          {transfer.repayment_due_date && (
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-purple-500" /> Target Return: {new Date(`${transfer.repayment_due_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
      </div>

      {/* METADATA AUDIT BREAKDOWN */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Transfer Metadata */}
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2 text-purple-600">
            <FileText className="h-5 w-5" /> Transfer Authorization Details
          </h3>

          <div className="space-y-3 text-xs divide-y divide-border/40">
            <div className="pt-2 flex justify-between">
              <span className="text-muted-foreground">Initiated By</span>
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-purple-500" /> {initiatorProfile?.full_name || "Management User"}
              </span>
            </div>

            <div className="pt-2 flex justify-between">
              <span className="text-muted-foreground">Email Address</span>
              <span className="font-mono text-foreground">{initiatorProfile?.email || "N/A"}</span>
            </div>

            <div className="pt-2 flex justify-between">
              <span className="text-muted-foreground">Exact Timestamp</span>
              <span className="font-mono text-foreground">
                {new Date(transfer.created_at).toLocaleString("en-IN")}
              </span>
            </div>

            <div className="pt-2 space-y-1">
              <span className="text-muted-foreground">Transfer Purpose / Allocation Note</span>
              <p className="p-3 rounded-xl bg-muted/30 text-xs leading-relaxed italic text-foreground">
                "{transfer.purpose || "No additional notes provided for this capital reallocation."}"
              </p>
            </div>
          </div>
        </div>

        {/* Repayment History Timeline */}
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2 text-emerald-600">
              <History className="h-5 w-5" /> Step-by-Step Repayment Audit Trail
            </h3>
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              {repayments.length} Return Entries
            </Badge>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {isLoadingRepayments ? (
              <p className="p-4 text-xs text-muted-foreground">Loading repayment history...</p>
            ) : repayments.length === 0 ? (
              <div className="p-8 text-center space-y-2 border border-dashed rounded-xl">
                <RotateCcw className="h-6 w-6 text-muted-foreground/40 mx-auto" />
                <p className="text-xs font-medium text-muted-foreground">No return payments recorded yet</p>
                <p className="text-[11px] text-muted-foreground/70">
                  When funds are returned step-by-step from {targetProject?.name || "Target"} back to {sourceProject?.name || "Source"}, each repayment record will be audited here.
                </p>
              </div>
            ) : (
              repayments.map((r: any, idx: number) => (
                <div
                  key={r.id}
                  className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] text-xs space-y-1.5 shadow-xs"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      Return Step #{repayments.length - idx}: +{money(Number(r.amount))}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(r.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3 text-emerald-500 shrink-0" />
                    Returned by: <strong className="text-foreground">{r.profile?.full_name || "Management User"}</strong>
                  </p>

                  {r.notes && (
                    <p className="text-[11px] text-muted-foreground/90 italic bg-card/80 p-2.5 rounded-lg border border-border/40 mt-1">
                      "{r.notes}"
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Repay Fund Modal */}
      <Dialog open={repayModalOpen} onOpenChange={(open) => !open && setRepayModalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <RotateCcw className="h-5 w-5" /> Repay Funds Back to Source
            </DialogTitle>
            <DialogDescription>
              Return capital step-by-step from {targetProject?.name || "Target"} back to {sourceProject?.name || "Source"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border p-3.5 bg-muted/20 space-y-1 text-xs">
              <p className="text-muted-foreground uppercase tracking-wider font-semibold text-[10px]">Transfer Summary</p>
              <p className="font-semibold text-sm">
                {sourceProject?.name} ➔ {targetProject?.name}
              </p>
              <p className="text-muted-foreground">
                Original Loan: {money(Number(transfer.amount))} • Already Repaid: {money(Number(transfer.repaid_amount || 0))}
              </p>
              <p className="font-bold text-terracotta text-sm mt-1">
                Remaining Due: {money(remainingBalance)}
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Repayment Amount (₹)</Label>
              <Input
                type="number"
                min="1"
                max={remainingBalance}
                className="mt-1"
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Repayment Notes (Optional)</Label>
              <Input
                placeholder="e.g. Phase 1 return after land sale collection"
                className="mt-1 text-xs"
                value={repayNotes}
                onChange={(e) => setRepayNotes(e.target.value)}
              />
            </div>
          </div>

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

      {/* HIDDEN A4 CAPITAL TRANSFER AUDIT CERTIFICATE FOR PRINTING */}
      <div className="hidden">
        <div
          ref={printCertRef}
          className="print-document bg-white text-slate-900 p-8 font-sans leading-relaxed text-xs space-y-5"
        >
          {/* HEADER */}
          <div
            className="border-b-2 border-slate-900 pb-3 flex items-center gap-5"
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: "20px",
              borderBottom: "2px solid #0f172a",
              paddingBottom: "12px",
            }}
          >
            <img
              src="/ark-logo.png"
              alt="Ark Logo"
              className="h-16 w-auto object-contain shrink-0"
              style={{
                height: "65px",
                width: "auto",
                maxWidth: "160px",
                objectFit: "contain",
                flexShrink: 0,
                display: "block",
              }}
              onError={(e: any) => { e.currentTarget.style.display = "none"; }}
            />
            <div className="flex-1 space-y-0.5" style={{ flex: "1 1 0%", minWidth: 0 }}>
              <h1 className="font-serif font-black text-2xl text-slate-900 tracking-tight leading-none" style={{ margin: 0, fontSize: "22px", fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>
                ARK BUILDERS & DEVELOPERS
              </h1>
              <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider" style={{ margin: "2px 0 0 0", fontSize: "11px", fontWeight: 700, color: "#9a3412", letterSpacing: "0.5px" }}>
                Corporate Treasury & Financial Controls Department
              </p>
              <p className="text-[10px] text-slate-600" style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#475569" }}>
                #4th Floor, SVB City Center, Above Yes Bank, Club Road, HUBBALLI – 580029
              </p>
            </div>
            <div className="text-right space-y-1" style={{ textAlign: "right", flexShrink: 0 }}>
              <span className="inline-block px-3 py-1 bg-purple-100 text-purple-900 border border-purple-300 font-mono font-bold text-[11px] rounded-md">
                AUDIT CERTIFICATE
              </span>
              <div className="text-[10px] font-mono text-slate-600">Ref: TRF-{transfer.id.slice(0, 8).toUpperCase()}</div>
              <div className="text-[10px] text-slate-500">Date: {new Date(transfer.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</div>
            </div>
          </div>

          {/* TITLE BANNER */}
          <div className="bg-[#0B2545] text-white p-3 rounded-lg flex items-center justify-between font-bold text-xs uppercase tracking-wider">
            <span>INTER-PROJECT CAPITAL REALLOCATION AUDIT CERTIFICATE</span>
            <span className="font-mono text-amber-300">AMOUNT: {money(Number(transfer.amount))}</span>
          </div>

          {/* SOURCE AND TARGET BOXES */}
          <div className="grid grid-cols-2 gap-4">
            {/* SOURCE */}
            <div className="border border-slate-300 rounded-lg p-3.5 bg-slate-50 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block border-b border-slate-200 pb-1">
                ORIGIN (CAPITAL OUTFLOW)
              </span>
              <div>
                <span className="text-[10px] text-slate-500 block">Project Name & Code</span>
                <span className="font-bold text-slate-900 text-sm">{sourceProject?.name || "Source Project"} ({sourceProject?.code || "N/A"})</span>
              </div>
              <div className="text-[11px] space-y-0.5 pt-1">
                <div><span className="font-medium text-slate-600">Bank Name:</span> <strong>{sourceBankAccount?.bank_name || "General Treasury"}</strong></div>
                <div><span className="font-medium text-slate-600">Account No:</span> <strong className="font-mono">{sourceBankAccount?.account_number || "N/A"}</strong></div>
                <div><span className="font-medium text-slate-600">IFSC Code:</span> <strong className="font-mono">{sourceBankAccount?.ifsc_code || "N/A"}</strong></div>
              </div>
            </div>

            {/* TARGET */}
            <div className="border border-slate-300 rounded-lg p-3.5 bg-emerald-50/50 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block border-b border-emerald-200 pb-1">
                BENEFICIARY (CAPITAL INFLOW)
              </span>
              <div>
                <span className="text-[10px] text-slate-500 block">Project Name & Code</span>
                <span className="font-bold text-slate-900 text-sm">{targetProject?.name || "Target Project"} ({targetProject?.code || "N/A"})</span>
              </div>
              <div className="text-[11px] space-y-0.5 pt-1">
                <div><span className="font-medium text-slate-600">Bank Name:</span> <strong>{targetBankAccount?.bank_name || "General Treasury"}</strong></div>
                <div><span className="font-medium text-slate-600">Account No:</span> <strong className="font-mono">{targetBankAccount?.account_number || "N/A"}</strong></div>
                <div><span className="font-medium text-slate-600">IFSC Code:</span> <strong className="font-mono">{targetBankAccount?.ifsc_code || "N/A"}</strong></div>
              </div>
            </div>
          </div>

          {/* FINANCIAL & TERMS SUMMARY */}
          <div className="border border-slate-300 rounded-lg p-4 bg-white space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Capital Shifted</span>
                <span className="text-base font-black text-slate-900 font-mono">{money(Number(transfer.amount))}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Repaid Back</span>
                <span className="text-base font-black text-emerald-700 font-mono">{money(effectiveRepaid)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Outstanding Balance</span>
                <span className="text-base font-black text-amber-700 font-mono">{money(remainingBalance)}</span>
              </div>
            </div>

            <div className="text-[11px] space-y-1.5 pt-1">
              <div><span className="font-bold text-slate-800">Declared Transfer Purpose:</span> <span className="text-slate-900">{transfer.purpose || "Inter-project liquidity reallocation for site development"}</span></div>
              {transfer.repayment_due_date && (
                <div><span className="font-bold text-slate-800">Scheduled Repayment Deadline:</span> <span className="text-slate-900">{new Date(transfer.repayment_due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</span></div>
              )}
              <div><span className="font-bold text-slate-800">Accounting Ledger Linkage:</span> <span className="text-slate-900 font-mono">Tally Prime Port 9000 Journal Voucher ID #TRF-{transfer.id.slice(0, 8).toUpperCase()}</span></div>
            </div>
          </div>

          {/* REPAYMENT HISTORY TABLE IF ANY */}
          {repayments.length > 0 && (
            <div className="space-y-2">
              <span className="font-bold text-xs text-slate-900 uppercase tracking-wider block">
                Recorded Repayments History
              </span>
              <table className="w-full border border-slate-300 text-left text-[11px] rounded-lg overflow-hidden">
                <thead className="bg-slate-100 border-b border-slate-300 font-bold text-[10px] uppercase">
                  <tr>
                    <th className="p-2 border-r border-slate-300">#</th>
                    <th className="p-2 border-r border-slate-300">Repayment Date</th>
                    <th className="p-2 border-r border-slate-300">Amount (₹)</th>
                    <th className="p-2">Notes & Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {repayments.map((r: any, idx: number) => (
                    <tr key={r.id}>
                      <td className="p-2 border-r border-slate-300 font-bold">{idx + 1}</td>
                      <td className="p-2 border-r border-slate-300">{new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td className="p-2 border-r border-slate-300 font-mono font-bold text-emerald-800">{money(Number(r.amount))}</td>
                      <td className="p-2 text-slate-700">{r.notes || "Repayment transaction"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* AUTHORIZATION SIGNATURES */}
          <div className="pt-6 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs">
            <div className="space-y-5">
              <div className="h-7 border-b border-dashed border-slate-400 flex items-end justify-center pb-1 text-[10px] text-slate-500 font-medium">
                Verified Electronic Entry
              </div>
              <span className="font-bold text-slate-800 block text-[11px]">Accounts Executive</span>
            </div>
            <div className="space-y-5">
              <div className="h-7 border-b border-dashed border-slate-400 flex items-end justify-center pb-1 text-[10px] text-slate-500 font-medium">
                Treasury Certified
              </div>
              <span className="font-bold text-slate-800 block text-[11px]">Finance & Treasury Head</span>
            </div>
            <div className="space-y-5">
              <div className="h-7 border-b border-dashed border-slate-400 flex items-end justify-center pb-1 text-[10px] text-slate-500 font-medium">
                Authorized Approval
              </div>
              <span className="font-bold text-slate-800 block text-[11px]">Managing Director / Partner</span>
            </div>
          </div>

          <div className="text-center text-[9px] text-slate-400 pt-2">
            ARK Builders & Developers ERP • Official Treasury Audit Certificate • Generated on {new Date().toLocaleString("en-IN")}
          </div>
        </div>
      </div>
    </div>
  );
}
