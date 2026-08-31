import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Landmark,
  Building2,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Calendar,
  CreditCard,
  CheckCircle2,
  FileSpreadsheet,
  QrCode,
  FileText,
  Banknote,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

interface BankAccountPassbookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankAccount: any | null;
  project: any | null;
  bookings: any[];
  payments: any[];
  transfers: any[];
}

const money = (val: number) =>
  `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function BankAccountPassbookModal({
  open,
  onOpenChange,
  bankAccount,
  project,
  bookings,
  payments,
  transfers,
}: BankAccountPassbookModalProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "inflows" | "outflows" | "booking" | "installment" | "transfer">("all");

  const ledgerEntries = useMemo(() => {
    if (!bankAccount) return [];

    const entries: any[] = [];
    const accId = bankAccount.id;

    // 1. Initial Opening Balance (if any)
    const openingBal = Number(bankAccount.opening_balance || 0);

    // 2. Direct Booking Advances into this bank account
    bookings.forEach((b: any) => {
      const bookingBankId =
        b.bank_account_id ||
        (Array.isArray(b.approval_history)
          ? [...b.approval_history].reverse().find((h: any) => h.bank_account_id)?.bank_account_id
          : null);

      const isThisAccount =
        bookingBankId === accId ||
        (!bookingBankId && bankAccount.is_primary && b.plots?.project_id === bankAccount.project_id);

      const advAmt = Number(b.advance_paid || b.booking_amount || 0);
      if (isThisAccount && advAmt > 0) {
        const plotNo = b.plots?.plot_number || "Plot";
        const prjCode = (b.plots?.projects?.code || project?.code || "PRJ").toUpperCase();
        const dateStr = b.booking_date || b.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);

        entries.push({
          id: `bkg-${b.id}`,
          date: dateStr,
          timestamp: new Date(dateStr).getTime(),
          type: "Booking Advance",
          category: "inflow",
          particulars: `${b.customer_name} — Downpayment for Plot #${plotNo} (${prjCode})`,
          customerName: b.customer_name,
          plotNumber: plotNo,
          paymentMethod: b.payment_method || "UPI",
          referenceNumber: b.receipt_number || `REC-${prjCode}-${plotNo}-ADV`,
          credit: advAmt,
          debit: 0,
        });
      }
    });

    // 3. Installment / EMI Collections into this bank account
    payments.forEach((p: any) => {
      const isThisAccount =
        p.bank_account_id === accId ||
        (!p.bank_account_id && bankAccount.is_primary && p.booking?.plots?.project_id === bankAccount.project_id);

      const pAmt = Number(p.amount || 0);
      if (isThisAccount && pAmt > 0) {
        const plotNo = p.booking?.plots?.plot_number || "Plot";
        const custName = p.booking?.customer_name || "Customer";
        const dateStr = p.paid_on || new Date().toISOString().slice(0, 10);

        entries.push({
          id: `inst-${p.id}`,
          date: dateStr,
          timestamp: new Date(dateStr).getTime(),
          type: "EMI Installment",
          category: "inflow",
          particulars: `${custName} — Installment Collection (Plot #${plotNo})`,
          customerName: custName,
          plotNumber: plotNo,
          paymentMethod: p.payment_method || "UPI",
          referenceNumber: p.reference_number || `REC-${p.id.slice(0, 6)}`,
          credit: pAmt,
          debit: 0,
        });
      }
    });

    // 4. Treasury Transfers - Inflows (Target Bank)
    transfers.forEach((t: any) => {
      if (t.target_bank_account_id === accId) {
        const tAmt = Number(t.transfer_amount || t.amount || 0);
        const dateStr = t.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);
        const srcPrjName = t.source_project?.name || "Source Project";

        entries.push({
          id: `tr-in-${t.id}`,
          date: dateStr,
          timestamp: new Date(dateStr).getTime(),
          type: "Treasury Inflow",
          category: "inflow",
          particulars: `Liquidity Transfer from ${srcPrjName} (${t.purpose || "Inter-project fund support"})`,
          paymentMethod: "Inter-Account Transfer",
          referenceNumber: `TR-${t.id.slice(0, 8).toUpperCase()}`,
          credit: tAmt,
          debit: 0,
        });
      }

      // Repayments received back into source bank
      if (t.source_bank_account_id === accId && Number(t.repaid_amount || 0) > 0) {
        const repAmt = Number(t.repaid_amount || 0);
        const dateStr = t.updated_at?.slice(0, 10) || t.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);
        const tgtPrjName = t.target_project?.name || "Target Project";

        entries.push({
          id: `rep-in-${t.id}`,
          date: dateStr,
          timestamp: new Date(dateStr).getTime(),
          type: "Repayment Inflow",
          category: "inflow",
          particulars: `Transfer Repayment recovered back from ${tgtPrjName}`,
          paymentMethod: "Treasury Repayment",
          referenceNumber: `REP-${t.id.slice(0, 8).toUpperCase()}`,
          credit: repAmt,
          debit: 0,
        });
      }

      // 5. Treasury Transfers - Outflows (Source Bank)
      if (t.source_bank_account_id === accId) {
        const tAmt = Number(t.transfer_amount || t.amount || 0);
        const dateStr = t.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);
        const tgtPrjName = t.target_project?.name || "Target Project";

        entries.push({
          id: `tr-out-${t.id}`,
          date: dateStr,
          timestamp: new Date(dateStr).getTime(),
          type: "Treasury Outflow",
          category: "outflow",
          particulars: `Fund Support Disbursed to ${tgtPrjName} (${t.purpose || "Liquidity Support"})`,
          paymentMethod: "Inter-Account Transfer",
          referenceNumber: `TR-${t.id.slice(0, 8).toUpperCase()}`,
          credit: 0,
          debit: tAmt,
        });
      }
    });

    // Sort chronologically ascending to calculate running balance
    entries.sort((a, b) => a.timestamp - b.timestamp);

    let runningBal = openingBal;
    const withRunningBalance = entries.map((item) => {
      runningBal += item.credit - item.debit;
      return {
        ...item,
        runningBalance: runningBal,
      };
    });

    // Reverse to show newest transactions first in the passbook
    return withRunningBalance.reverse();
  }, [bankAccount, project, bookings, payments, transfers]);

  const totalCredit = useMemo(() => {
    return ledgerEntries.reduce((sum, item) => sum + item.credit, 0);
  }, [ledgerEntries]);

  const totalDebit = useMemo(() => {
    return ledgerEntries.reduce((sum, item) => sum + item.debit, 0);
  }, [ledgerEntries]);

  const liveBalance = useMemo(() => {
    const opening = Number(bankAccount?.opening_balance || 0);
    return Math.max(0, opening + totalCredit - totalDebit);
  }, [bankAccount, totalCredit, totalDebit]);

  const filteredEntries = useMemo(() => {
    return ledgerEntries.filter((item) => {
      if (typeFilter === "inflows" && item.category !== "inflow") return false;
      if (typeFilter === "outflows" && item.category !== "outflow") return false;
      if (typeFilter === "booking" && !item.type.includes("Booking")) return false;
      if (typeFilter === "installment" && !item.type.includes("EMI")) return false;
      if (typeFilter === "transfer" && !item.type.includes("Treasury") && !item.type.includes("Repayment")) return false;

      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        item.particulars?.toLowerCase().includes(s) ||
        item.customerName?.toLowerCase().includes(s) ||
        item.referenceNumber?.toLowerCase().includes(s) ||
        item.paymentMethod?.toLowerCase().includes(s) ||
        item.plotNumber?.toLowerCase().includes(s)
      );
    });
  }, [ledgerEntries, typeFilter, search]);

  const handleExportCSV = () => {
    if (ledgerEntries.length === 0) {
      toast.error("No transactions to export");
      return;
    }

    const headers = [
      "Date",
      "Transaction Type",
      "Particulars",
      "Customer Name",
      "Plot Number",
      "Payment Mode",
      "Reference / UTR No",
      "Inflow / Credit (INR)",
      "Outflow / Debit (INR)",
      "Running Balance (INR)",
    ];

    const rows = ledgerEntries.map((item) => [
      item.date,
      item.type,
      `"${item.particulars.replace(/"/g, '""')}"`,
      item.customerName || "",
      item.plotNumber || "",
      item.paymentMethod || "",
      item.referenceNumber || "",
      item.credit,
      item.debit,
      item.runningBalance,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Bank_Passbook_${bankAccount?.bank_name}_${bankAccount?.account_number?.slice(-4)}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Bank account statement exported successfully!");
  };

  if (!bankAccount) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-3xl border-border shadow-2xl">
        {/* Passbook Header */}
        <div className="p-6 bg-gradient-to-br from-card via-card to-muted/50 border-b border-border/80 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-terracotta/10 rounded-2xl border border-terracotta/20 text-terracotta shrink-0 shadow-inner">
                <Landmark className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl font-black tracking-tight text-foreground">
                    {bankAccount.bank_name}
                  </h2>
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-muted text-foreground font-bold border">
                    ••••{bankAccount.account_number?.slice(-4) || "0000"}
                  </span>
                  {bankAccount.is_primary && (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black">
                      Primary Escrow
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {bankAccount.account_type || "RERA Escrow Account"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span>Project: <strong>{project?.name || "All Projects"}</strong></span>
                  {bankAccount.ifsc_code && (
                    <span className="font-mono">· IFSC: {bankAccount.ifsc_code}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Quick Export Action */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="h-9 rounded-xl font-bold text-xs gap-1.5 shadow-xs hover:bg-background"
              >
                <Download className="h-3.5 w-3.5 text-terracotta" />
                Export Passbook (CSV)
              </Button>
            </div>
          </div>

          {/* Key Metric Gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            <div className="p-3.5 rounded-2xl bg-background/90 border border-border/80 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">
                Current Liquid Balance
              </span>
              <span className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-400 block mt-0.5">
                {money(liveBalance)}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                Live available liquidity
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-background/90 border border-border/80 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">
                Total Inflows / Collections
              </span>
              <span className="text-xl font-black font-mono text-foreground block mt-0.5">
                {money(totalCredit)}
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block flex items-center gap-1">
                <ArrowDownLeft className="h-3 w-3" />
                {ledgerEntries.filter((e) => e.category === "inflow").length} verified receipts
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-background/90 border border-border/80 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">
                Total Treasury Outflows
              </span>
              <span className="text-xl font-black font-mono text-foreground block mt-0.5">
                {money(totalDebit)}
              </span>
              <span className="text-[10px] text-amber-600 font-semibold mt-0.5 block flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                {ledgerEntries.filter((e) => e.category === "outflow").length} fund disbursals
              </span>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customer, UTR, plot, cheque..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-background"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {[
              { id: "all", label: "All Records" },
              { id: "inflows", label: "Collections Only" },
              { id: "booking", label: "Plot Downpayments" },
              { id: "installment", label: "EMIs" },
              { id: "transfer", label: "Treasury Transfers" },
            ].map((tab) => (
              <Button
                key={tab.id}
                variant={typeFilter === tab.id ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(tab.id as any)}
                className={`h-8 text-xs rounded-xl font-bold transition-all shrink-0 ${
                  typeFilter === tab.id
                    ? "bg-terracotta hover:bg-terracotta/90 text-white shadow-xs"
                    : "hover:bg-background"
                }`}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Transaction History Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-[300px]">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground space-y-2">
              <Landmark className="h-10 w-10 mx-auto opacity-30 text-terracotta" />
              <p className="font-bold text-sm text-foreground">No transaction receipts found</p>
              <p className="text-xs">
                Payments recorded in Approvals, Installments, or Treasury Transfers will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="border border-border/80 rounded-2xl overflow-hidden shadow-2xs bg-card">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50 text-[11px] font-extrabold uppercase text-muted-foreground tracking-wider">
                    <th className="py-3.5 px-5 w-32">Date</th>
                    <th className="py-3.5 px-5">Transaction / Customer</th>
                    <th className="py-3.5 px-5 w-52">Mode & Reference</th>
                    <th className="py-3.5 px-5 text-right w-36">Inflow (₹)</th>
                    <th className="py-3.5 px-5 text-right w-32">Outflow (₹)</th>
                    <th className="py-3.5 px-5 text-right w-40">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredEntries.map((row) => {
                    const isCredit = row.credit > 0;
                    return (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                        {/* Date */}
                        <td className="py-4 px-5 font-mono font-medium text-muted-foreground whitespace-nowrap">
                          {row.date}
                        </td>

                        {/* Particulars */}
                        <td className="py-4 px-5">
                          <div className="font-bold text-foreground text-[13px]">{row.particulars}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                                row.type.includes("Booking")
                                  ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
                                  : row.type.includes("EMI")
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20"
                              }`}
                            >
                              {row.type}
                            </span>
                            {row.plotNumber && (
                              <span className="text-[11px] text-muted-foreground font-mono font-medium">
                                Plot #{row.plotNumber}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Payment Mode & UTR */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            {row.paymentMethod?.toLowerCase().includes("upi") ? (
                              <QrCode className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            ) : row.paymentMethod?.toLowerCase().includes("cheque") ? (
                              <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            ) : row.paymentMethod?.toLowerCase().includes("cash") ? (
                              <Banknote className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            ) : (
                              <CreditCard className="h-3.5 w-3.5 text-terracotta shrink-0" />
                            )}
                            <span>{row.paymentMethod || "Bank Transfer"}</span>
                          </div>
                          {row.referenceNumber && (
                            <div className="font-mono text-[11px] text-muted-foreground truncate mt-0.5">
                              Ref: {row.referenceNumber}
                            </div>
                          )}
                        </td>

                        {/* Credit (Inflow) */}
                        <td className="py-4 px-5 text-right font-mono font-bold text-emerald-600 text-sm whitespace-nowrap">
                          {isCredit ? `+${money(row.credit)}` : "—"}
                        </td>

                        {/* Debit (Outflow) */}
                        <td className="py-4 px-5 text-right font-mono font-bold text-destructive text-sm whitespace-nowrap">
                          {row.debit > 0 ? `-${money(row.debit)}` : "—"}
                        </td>

                        {/* Running Balance */}
                        <td className="py-4 px-5 text-right font-mono font-extrabold text-foreground text-sm whitespace-nowrap bg-muted/15">
                          {money(row.runningBalance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
