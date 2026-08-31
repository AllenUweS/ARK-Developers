import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { syncTransferToTally, syncTransferRepaymentToTally } from "@/lib/tallySync";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Landmark,
  ArrowRightLeft,
  Calendar,
  Building2,
  FileSpreadsheet,
  Zap,
  CheckCircle2,
  Clock,
  IndianRupee,
  ShieldCheck,
  Info,
} from "lucide-react";
import { toast } from "sonner";

export interface TreasuryTallyLedgerModalProps {
  transfer: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TreasuryTallyLedgerModal({
  transfer,
  open,
  onOpenChange,
}: TreasuryTallyLedgerModalProps) {
  const [syncing, setSyncing] = useState(false);

  // Fetch repayments for this specific transfer
  const { data: repayments = [], refetch: refetchRepayments } = useQuery({
    queryKey: ["treasury-repayments", transfer?.id],
    enabled: !!transfer?.id && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_transfer_repayments")
        .select("*")
        .eq("transfer_id", transfer.id)
        .order("created_at", { ascending: true });
      if (error) return [];
      return data ?? [];
    },
  });

  // Fetch Source Bank Account if not attached on transfer prop
  const { data: sourceBankAccount } = useQuery({
    queryKey: ["tally-modal-src-bank", transfer?.source_bank_account_id],
    enabled: !!transfer?.source_bank_account_id && open,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("project_bank_accounts")
        .select("*")
        .eq("id", transfer.source_bank_account_id)
        .maybeSingle();
      return data;
    },
  });

  // Fetch Target Bank Account if not attached on transfer prop
  const { data: targetBankAccount } = useQuery({
    queryKey: ["tally-modal-tgt-bank", transfer?.target_bank_account_id],
    enabled: !!transfer?.target_bank_account_id && open,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("project_bank_accounts")
        .select("*")
        .eq("id", transfer.target_bank_account_id)
        .maybeSingle();
      return data;
    },
  });

  const formatMoney = (val: number) =>
    `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  if (!transfer) return null;

  const srcProj = transfer.source_project?.name || "Source Project";
  const tgtProj = transfer.target_project?.name || "Target Project";
  const srcBank = transfer.source_bank_account || sourceBankAccount;
  const tgtBank = transfer.target_bank_account || targetBankAccount;

  const srcBankLabel = srcBank
    ? `${srcBank.bank_name} (${srcBank.account_type || 'A/C'})`
    : `${srcProj} Collection Bank A/c`;

  const srcBankDetails = srcBank
    ? `A/C: ••••${srcBank.account_number.slice(-4)} | IFSC: ${srcBank.ifsc_code}${srcBank.branch_name ? ` (${srcBank.branch_name})` : ''}`
    : `General Treasury`;

  const tgtBankLabel = tgtBank
    ? `${tgtBank.bank_name} (${tgtBank.account_type || 'A/C'})`
    : `${tgtProj} Collection Bank A/c`;

  const tgtBankDetails = tgtBank
    ? `A/C: ••••${tgtBank.account_number.slice(-4)} | IFSC: ${tgtBank.ifsc_code}${tgtBank.branch_name ? ` (${tgtBank.branch_name})` : ''}`
    : `General Treasury`;

  const amt = Number(transfer.amount || 0);
  const repaidAmt = Number(transfer.repaid_amount || 0);
  const remaining = Math.max(0, amt - repaidAmt);
  const pct = amt > 0 ? Math.min(100, Math.round((repaidAmt / amt) * 100)) : 0;
  const trfRef = `TRF-${transfer.id?.slice(0, 6)?.toUpperCase() || "2026-101"}`;

  const handleSyncToTally = async () => {
    setSyncing(true);
    try {
      // 1. Sync Initial Transfer Journal Voucher with explicit Bank details
      const syncRes = await syncTransferToTally({
        sourceProject: srcProj,
        targetProject: tgtProj,
        amount: amt,
        transferDate: transfer.created_at?.slice(0, 10),
        transferRef: trfRef,
        sourceBankName: srcBank?.bank_name,
        sourceAccountNo: srcBank?.account_number,
        sourceIfsc: srcBank?.ifsc_code,
        targetBankName: tgtBank?.bank_name,
        targetAccountNo: tgtBank?.account_number,
        targetIfsc: tgtBank?.ifsc_code,
      });

      if (!syncRes.success) {
        toast.error(`Tally Initial Transfer Sync: ${syncRes.responseText}`);
        setSyncing(false);
        return;
      }

      // 2. Sync All Repayments with explicit Bank details
      let syncedRepaymentsCount = 0;
      if (repayments.length > 0) {
        for (let i = 0; i < repayments.length; i++) {
          const r = repayments[i];
          const repRef = `REP-${trfRef}-${String(i + 1).padStart(2, "0")}`;
          await syncTransferRepaymentToTally({
            sourceProject: srcProj,
            targetProject: tgtProj,
            amount: Number(r.amount),
            repaymentDate: r.created_at?.slice(0, 10),
            repaymentRef: repRef,
            sourceBankName: srcBank?.bank_name,
            sourceAccountNo: srcBank?.account_number,
            sourceIfsc: srcBank?.ifsc_code,
            targetBankName: tgtBank?.bank_name,
            targetAccountNo: tgtBank?.account_number,
            targetIfsc: tgtBank?.ifsc_code,
          });
          syncedRepaymentsCount++;
        }
      }

      toast.success(
        `Synced 1 Transfer Journal + ${syncedRepaymentsCount} Repayment Vouchers for ${trfRef} into Tally Prime!`
      );
      refetchRepayments();
    } catch (err: any) {
      toast.error(`Tally sync error: ${err.message || "Failed to reach Tally Prime on port 9000"}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-5xl max-h-[92vh] overflow-y-auto overflow-x-hidden bg-card p-5 md:p-7 gap-5 shadow-2xl border border-border rounded-2xl">
        <DialogHeader className="border-b border-border/60 pb-4 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-xs uppercase bg-terracotta/10 text-terracotta border-terracotta/30 px-2.5 py-0.5">
                {trfRef}
              </Badge>
              <Badge variant="secondary" className="font-bold text-xs px-2.5 py-0.5">
                Journal Voucher
              </Badge>
              <Badge
                variant="outline"
                className={`text-xs font-semibold px-2.5 py-0.5 ${
                  pct >= 100
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                }`}
              >
                {pct >= 100 ? "100% Repaid" : `${pct}% Repaid`}
              </Badge>
            </div>

            <Button
              size="sm"
              variant="default"
              onClick={handleSyncToTally}
              disabled={syncing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-2 px-4 shadow-sm"
            >
              <Zap className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing Journal to Tally..." : "Sync Journal Voucher to Tally"}
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <img
              src="/ark-logo.png"
              alt="Ark Logo"
              className="h-10 w-auto object-contain shrink-0"
              onError={(e: any) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <div>
              <DialogTitle className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                Treasury Tally Statement — {srcProj} <ArrowRightLeft className="h-5 w-5 text-terracotta" /> {tgtProj}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Inter-project capital transfer accounting ledger detailing bank-to-bank journal voucher entries and repayment tracking for CA audit.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Transfer Metrics & Bank Details Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Source Bank Card */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-terracotta" /> Source (Debited) Bank
            </span>
            <span className="font-bold text-sm text-foreground block truncate">{srcProj}</span>
            <div className="pt-1 border-t border-border/40 space-y-0.5">
              <span className="font-semibold text-xs text-terracotta block truncate">
                {srcBankLabel}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground block truncate" title={srcBankDetails}>
                {srcBankDetails}
              </span>
            </div>
          </div>

          {/* Target Bank Card */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-emerald-600" /> Target (Credited) Bank
            </span>
            <span className="font-bold text-sm text-foreground block truncate">{tgtProj}</span>
            <div className="pt-1 border-t border-border/40 space-y-0.5">
              <span className="font-semibold text-xs text-emerald-600 dark:text-emerald-400 block truncate">
                {tgtBankLabel}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground block truncate" title={tgtBankDetails}>
                {tgtBankDetails}
              </span>
            </div>
          </div>

          {/* Transfer Amount Card */}
          <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <IndianRupee className="h-3.5 w-3.5" /> Transfer Amount
            </span>
            <span className="font-extrabold text-sm text-foreground block">{formatMoney(amt)}</span>
            <span className="text-[11px] text-emerald-600 font-semibold">{formatMoney(repaidAmt)} Repaid</span>
          </div>

          {/* Remaining Repayment Card */}
          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Remaining Repayment
            </span>
            <span className="font-extrabold text-sm text-amber-600 dark:text-amber-400 block">{formatMoney(remaining)}</span>
            <span className="text-[11px] text-muted-foreground">Pending Recovery</span>
          </div>
        </div>

        {/* Repayment Progress Bar */}
        <div className="space-y-1.5 px-0.5">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-muted-foreground">Capital Repayment Recovery</span>
            <span className="text-emerald-600 dark:text-emerald-400">{formatMoney(repaidAmt)} of {formatMoney(amt)} ({pct}%)</span>
          </div>
          <Progress value={pct} className="h-2.5 bg-muted" />
        </div>

        {/* Journal Voucher Table */}
        <div className="space-y-2 w-full">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-terracotta" /> Double-Entry Tally Journal Breakdown
            </h4>
            <Badge variant="outline" className="text-[11px] font-mono px-2.5">
              {1 + repayments.length} Journal Entries
            </Badge>
          </div>

          <div className="rounded-xl border border-border/80 overflow-hidden bg-card shadow-xs w-full">
            <table className="w-full text-xs text-left border-collapse table-auto">
              <thead>
                <tr className="bg-muted/70 border-b border-border/80 uppercase text-[10px] tracking-wider text-muted-foreground font-bold">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Vch Type</th>
                  <th className="py-3 px-3">Reference ID</th>
                  <th className="py-3 px-3">Debit Ledger (Dr)</th>
                  <th className="py-3 px-3">Credit Ledger (Cr)</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {/* Initial Capital Transfer Journal Voucher */}
                <tr className="hover:bg-muted/40 transition-colors">
                  <td className="py-3 px-3 font-sans text-muted-foreground whitespace-nowrap">
                    {transfer.created_at?.slice(0, 10) || "2026-07-31"}
                  </td>
                  <td className="py-3 px-3 font-sans whitespace-nowrap">
                    <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-blue-500/10 text-blue-600 border-blue-500/30">
                      Journal
                    </Badge>
                  </td>
                  <td className="py-3 px-3 font-bold text-foreground whitespace-nowrap">{trfRef}</td>
                  <td className="py-3 px-3 font-sans font-bold text-foreground">
                    <div>
                      <span>{tgtProj}</span>
                      <span className="block text-[11px] font-normal text-emerald-600 dark:text-emerald-400 font-mono">
                        {tgtBank ? `${tgtBank.bank_name} (${tgtBank.account_number})` : `${tgtProj} Collection Bank A/c`}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-sans text-muted-foreground">
                    <div>
                      <span className="text-foreground font-medium">{srcProj}</span>
                      <span className="block text-[11px] text-terracotta font-mono">
                        {srcBank ? `${srcBank.bank_name} (${srcBank.account_number})` : `${srcProj} Collection Bank A/c`}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-extrabold text-foreground whitespace-nowrap">
                    {formatMoney(amt)}
                  </td>
                </tr>

                {/* Repayments */}
                {repayments.map((r: any, idx: number) => (
                  <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-3 font-sans text-muted-foreground whitespace-nowrap">
                      {r.created_at?.slice(0, 10) || "2026-07-31"}
                    </td>
                    <td className="py-3 px-3 font-sans whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        Repayment
                      </Badge>
                    </td>
                    <td className="py-3 px-3 font-bold text-foreground whitespace-nowrap">
                      {`REP-${trfRef}-${String(idx + 1).padStart(2, "0")}`}
                    </td>
                    <td className="py-3 px-3 font-sans text-emerald-600 dark:text-emerald-400 font-bold">
                      <div>
                        <span>{srcProj}</span>
                        <span className="block text-[11px] font-normal text-terracotta font-mono">
                          {srcBank ? `${srcBank.bank_name} (${srcBank.account_number})` : `${srcProj} Collection Bank A/c`}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-sans text-muted-foreground">
                      <div>
                        <span>{tgtProj}</span>
                        <span className="block text-[11px] font-mono">
                          {tgtBank ? `${tgtBank.bank_name} (${tgtBank.account_number})` : `${tgtProj} Collection Bank A/c`}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatMoney(Number(r.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Narration Preview */}
        <div className="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-1 text-xs">
          <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-bold">
            <Info className="h-4 w-4" /> Tally Prime Audit Narration Log (Pushed to Tally Day Book)
          </div>
          <p className="font-mono text-[11px] text-muted-foreground bg-muted/60 p-2 rounded border border-border/40">
            Inter-Project Fund Transfer from {srcProj} ({srcBank ? `${srcBank.bank_name} [A/C: ${srcBank.account_number}, IFSC: ${srcBank.ifsc_code}]` : 'Collection Bank A/c'}) to {tgtProj} ({tgtBank ? `${tgtBank.bank_name} [A/C: ${tgtBank.account_number}, IFSC: ${tgtBank.ifsc_code}]` : 'Collection Bank A/c'}) - Ref: {trfRef}
          </p>
        </div>

        {/* Tally Prime Inspection Guide Box */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-terracotta/10 via-amber-500/10 to-card border border-terracotta/20 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-terracotta font-bold text-sm">
            <Landmark className="h-4 w-4" /> How to View this Inter-Project Journal Voucher inside Tally Prime:
          </div>
          <div className="text-muted-foreground space-y-1.5 pl-5 list-decimal font-medium">
            <p>1. Open **Tally Prime** ➔ Press <kbd className="px-2 py-0.5 bg-muted rounded border text-[11px] font-mono">Alt + G</kbd> (Go To).</p>
            <p>2. Type **`Day Book`** or **`Journal Register`** and press **Enter**.</p>
            <p>3. You will see the **Journal Voucher** recorded from <strong className="text-foreground">{srcBank ? `${srcBank.bank_name} A/C ${srcBank.account_number}` : `${srcProj} Bank`}</strong> to <strong className="text-foreground">{tgtBank ? `${tgtBank.bank_name} A/C ${tgtBank.account_number}` : `${tgtProj} Bank`}</strong> for <strong className="text-emerald-600">{formatMoney(amt)}</strong> with full audit narration!</p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs px-5">
            Close Statement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
