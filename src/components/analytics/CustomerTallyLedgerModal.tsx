import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  syncBookingToTally,
  syncPaymentToTally,
  syncCustomerLedgerUnified,
  isBookingSyncedToTally,
  isPaymentSyncedToTally,
} from "@/lib/tallySync";
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
  IndianRupee,
  Calendar,
  CheckCircle2,
  Clock,
  Building2,
  User,
  Landmark,
  FileSpreadsheet,
  Zap,
  HelpCircle,
  Download,
  MessageCircle,
} from "lucide-react";
import { downloadEMIStatementPDF, uploadEMIStatementPDFToStorage } from "@/lib/emiStatementPDF";
import { sendEMIStatementWhatsApp } from "@/lib/whatsappService";
import { toast } from "sonner";

export interface CustomerTallyLedgerModalProps {
  booking: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerTallyLedgerModal({
  booking,
  open,
  onOpenChange,
}: CustomerTallyLedgerModalProps) {
  const [syncing, setSyncing] = useState(false);
  const [showAccountingHelp, setShowAccountingHelp] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const toggleRowSync = (row: any) => {
    if (typeof window === "undefined" || !booking) return;
    const keyPrefix = "tally_sync_v1_";
    if (row.vchType === "Sales") {
      const key = `${keyPrefix}bkg_${booking.id}`;
      if (row.isSynced) {
        localStorage.removeItem(key);
        toast.info("Marked Sales Voucher as Pending Tally Sync");
      } else {
        localStorage.setItem(key, new Date().toISOString());
        toast.success("Marked Sales Voucher as Synced");
      }
    } else {
      const key = `${keyPrefix}pay_${row.id}`;
      if (row.isSynced) {
        localStorage.removeItem(key);
        toast.info("Marked Payment Receipt as Pending Tally Sync");
      } else {
        localStorage.setItem(key, new Date().toISOString());
        toast.success("Marked Payment Receipt as Synced");
      }
    }
    setRefreshKey((k) => k + 1);
  };

  // Fetch all recorded installment payments for this booking
  const { data: payments = [], refetch: refetchPayments } = useQuery({
    queryKey: ["tally-ledger-payments", booking?.id],
    enabled: !!booking?.id && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("installment_payments")
        .select("*")
        .eq("booking_id", booking.id)
        .order("paid_on", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch all project bank accounts for this booking's project
  const projectId = booking?.plots?.project_id || booking?.plots?.projects?.id;
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["tally-ledger-banks", projectId],
    enabled: !!projectId && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_bank_accounts")
        .select("*")
        .eq("project_id", projectId);
      if (error) return [];
      return data ?? [];
    },
  });

  // Fetch all configured installment schedules for this booking
  const { data: schedules = [] } = useQuery({
    queryKey: ["tally-ledger-schedules", booking?.id],
    enabled: !!booking?.id && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("booking_installment_schedules")
        .select("*")
        .eq("booking_id", booking.id)
        .order("installment_number", { ascending: true });
      if (error) {
        console.warn("Could not fetch schedules:", error);
        return [];
      }
      return data ?? [];
    },
  });

  const formatMoney = (amount: number) =>
    `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  const prjCode = (booking?.plots?.projects?.code || "PRJ").toUpperCase();
  const prjName = booking?.plots?.projects?.name || "Project";
  const plotNo = String(booking?.plots?.plot_number || "101");
  const bkgRef = `BKG-${prjCode}-${plotNo}`;

  const totalPrice = Number(booking?.total_price || 0);
  const advancePaid = Number(booking?.advance_paid || 0);
  const govtValuation = Number(booking?.govt_amount || 0);

  // Single Unified Customer Ledger Name in Tally Prime
  const customerLedgerName = `Customer - ${booking?.customer_name || "Customer"} (Plot #${plotNo})`;

  // Single Unified Customer Ledger Statement
  const statement = useMemo(() => {
    if (!booking) return [];
    let currentBalance = 0;
    const entries: any[] = [];
    const bankMap = new Map<string, any>(bankAccounts.map((b: any) => [b.id, b]));

    // 1. Initial Sales Voucher (Debit to Customer)
    currentBalance += totalPrice;
    entries.push({
      id: `sales-${booking.id}`,
      type: "Sales Voucher",
      vchType: "Sales",
      refNo: bkgRef,
      date: booking.booking_date || booking.created_at?.slice(0, 10) || "2026-07-28",
      particulars: `Plot #${plotNo} Sale (${prjName})`,
      debit: totalPrice,
      credit: 0,
      runningBalance: currentBalance,
      narrative: `Plot #${plotNo} Sale | Project: ${prjName} [${prjCode}] | Customer: ${booking.customer_name} | Ref: ${bkgRef}`,
      isSynced: isBookingSyncedToTally(booking.id),
    });

    // 2. Receipt Vouchers (Credit to Customer)
    if (payments.length > 0) {
      payments.forEach((p: any, idx: number) => {
        const pAmt = Number(p.amount || 0);
        currentBalance -= pAmt;
        const recRef = p.reference_number || `REC-${prjCode}-${plotNo}-${String(idx + 1).padStart(2, "0")}`;
        const isCash = (p.payment_method || "").toLowerCase() === "cash";
        const bankObj = p.bank_account_id ? bankMap.get(p.bank_account_id) : null;
        const bankName = isCash
          ? "Cash in Hand"
          : bankObj
            ? `${bankObj.bank_name} (••••${bankObj.account_number?.slice(-4) || "0000"})`
            : `${prjName} Collection Bank A/c`;

        entries.push({
          id: p.id,
          type: "Receipt Voucher",
          vchType: "Receipt",
          refNo: recRef,
          date: p.paid_on || "2026-07-31",
          particulars: `Deposit to ${bankName} (${p.payment_method || "Bank Transfer"})`,
          debit: 0,
          credit: pAmt,
          runningBalance: currentBalance,
          narrative: `Payment Collection for Plot #${plotNo} | Mode: ${p.payment_method || "Bank Transfer"} | Bank: ${bankName} | Ref: ${recRef}`,
          isSynced: isPaymentSyncedToTally(p.id),
        });
      });
    } else if (advancePaid > 0) {
      currentBalance -= advancePaid;
      const recRef = `REC-${prjCode}-${plotNo}-01`;
      const advanceBankObj = booking.bank_account_id ? bankMap.get(booking.bank_account_id) : null;
      const advanceBankName = advanceBankObj
        ? `${advanceBankObj.bank_name} (••••${advanceBankObj.account_number?.slice(-4) || "0000"})`
        : `${prjName} Collection Bank A/c`;

      entries.push({
        id: `advance-${booking.id}`,
        type: "Receipt Voucher",
        vchType: "Receipt",
        refNo: recRef,
        date: booking.booking_date || booking.created_at?.slice(0, 10) || "2026-07-28",
        particulars: `Downpayment Deposit to ${advanceBankName}`,
        debit: 0,
        credit: advancePaid,
        runningBalance: currentBalance,
        narrative: `Downpayment Collection for Plot #${plotNo} | Ref: ${recRef}`,
        isSynced: isPaymentSyncedToTally(`advance_${booking.id}`),
      });
    }

    return entries;
  }, [booking, payments, bankAccounts, totalPrice, advancePaid, prjCode, prjName, plotNo, bkgRef, refreshKey]);

  const totalCollected = useMemo(() => {
    return statement.reduce((sum, item) => sum + item.credit, 0);
  }, [statement]);

  const pendingDues = Math.max(0, totalPrice - totalCollected);
  const collectedPct = totalPrice > 0 ? Math.min(100, Math.round((totalCollected / totalPrice) * 100)) : 0;

  // Single Customer Ledger Tally Sync Handler (Idempotent / Deduplicated)
  const syncCustomerLedgerToTally = async (forceResync = false) => {
    if (!booking) return;
    setSyncing(true);
    try {
      const res = await syncCustomerLedgerUnified({
        booking,
        payments,
        bankAccounts,
        forceResync,
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
        refetchPayments();
      } else {
        toast.error(`Tally sync error: ${res.error || "Failed to reach Tally Prime on port 9000"}`);
      }
    } catch (err: any) {
      toast.error(`Tally sync error: ${err.message || "Failed to reach Tally Prime on port 9000"}`);
    } finally {
      setSyncing(false);
    }
  };

  // PDF Export Handler
  const handleDownloadPDF = () => {
    if (!booking) return;
    downloadEMIStatementPDF({
      customerName: booking.customer_name || "Customer",
      customerPhone: booking.customer_phone || undefined,
      customerAddress: booking.customer_address || undefined,
      projectName: prjName,
      projectCode: prjCode,
      plotNumber: plotNo,
      areaSqft: Number(booking.plots?.area_sqft || 0) || undefined,
      totalPrice,
      advancePaid,
      remainingBalance: pendingDues,
      govtAmount: govtValuation,
      companyAmount: 0,
      installmentCount: schedules.length || booking.installment_count || 12,
      installmentAmount: Number(booking.installment_amount || 0) || undefined,
      firstDueDate: booking.first_installment_due_date,
      bookingDate: booking.booking_date || booking.created_at,
      scheduleRows: schedules,
      recordedPayments: payments,
    });
    toast.success("Generated Statement PDF for download!");
  };

  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  const handleSendWhatsAppEMI = async () => {
    if (!booking) return;
    setSendingWhatsApp(true);
    const toastId = toast.loading(`Generating PDF & dispatching WhatsApp EMI Statement to ${booking.customer_name} via Meta API...`);
    try {
      const pdfUrl = await uploadEMIStatementPDFToStorage({
        customerName: booking.customer_name || "Customer",
        customerPhone: booking.customer_phone || undefined,
        customerAddress: booking.customer_address || undefined,
        projectName: prjName,
        projectCode: prjCode,
        plotNumber: plotNo,
        areaSqft: Number(booking.plots?.area_sqft || 0) || undefined,
        totalPrice,
        advancePaid,
        remainingBalance: pendingDues,
        govtAmount: govtValuation,
        companyAmount: 0,
        installmentCount: schedules.length || booking.installment_count || 12,
        scheduleRows: schedules,
        recordedPayments: payments,
      });

      const totalCount = booking.installment_count || 12;
      const realizedCount = payments.length;
      const nextDueDateStr = booking.first_installment_due_date || new Date().toISOString().slice(0, 10);
      const nextDueAmount = Number(booking.installment_amount || 0) || (pendingDues > 0 ? Math.round(pendingDues / Math.max(totalCount - realizedCount, 1)) : 0);

      const res = await sendEMIStatementWhatsApp({
        customerName: booking.customer_name || "Customer",
        customerPhone: booking.customer_phone || "",
        unitProjectDetails: `${prjName ? prjName.slice(0, 18) : "Project"} · Plot #${plotNo}`,
        totalContractPrice: totalPrice,
        totalAmountRealized: advancePaid,
        remainingBalance: pendingDues,
        paidInstallmentsText: `${realizedCount} of ${totalCount} EMIs`,
        pendingInstallmentsText: `${Math.max(totalCount - realizedCount, 0)} EMIs remaining`,
        nextDueDate: nextDueDateStr,
        nextDueAmount: nextDueAmount,
        pdfDocumentUrl: pdfUrl || undefined,
        pdfFileName: `EMI_Statement_Plot_${plotNo}.pdf`,
      });

      toast.dismiss(toastId);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(`WhatsApp Meta API Error: ${res.message || "Failed to send WhatsApp EMI Statement"}`, {
          duration: 10000,
          action: res.deepLink
            ? {
                label: "Open 1-Tap WhatsApp",
                onClick: () => window.open(res.deepLink, "_blank"),
              }
            : undefined,
        });
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "Failed to send WhatsApp EMI Statement");
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const [sendingWhatsAppPDF, setSendingWhatsAppPDF] = useState(false);

  const handleSendWhatsAppPDF = async () => {
    if (!booking) return;
    setSendingWhatsAppPDF(true);
    const toastId = toast.loading(`Generating PDF & dispatching WhatsApp statement for ${booking.customer_name}...`);
    try {
      const pdfUrl = await uploadEMIStatementPDFToStorage({
        customerName: booking.customer_name || "Customer",
        customerPhone: booking.customer_phone || undefined,
        customerAddress: booking.customer_address || undefined,
        projectName: prjName,
        projectCode: prjCode,
        plotNumber: plotNo,
        areaSqft: Number(booking.plots?.area_sqft || 0) || undefined,
        totalPrice,
        advancePaid,
        remainingBalance: pendingDues,
        govtAmount: govtValuation,
        companyAmount: 0,
        installmentCount: schedules.length || booking.installment_count || 12,
        scheduleRows: schedules,
        recordedPayments: payments,
      });

      const totalCount = booking.installment_count || 12;
      const realizedCount = payments.length;
      const nextDueDateStr = booking.first_installment_due_date || new Date().toISOString().slice(0, 10);
      const nextDueAmount = Number(booking.installment_amount || 0) || (pendingDues > 0 ? Math.round(pendingDues / Math.max(totalCount - realizedCount, 1)) : 0);

      const res = await sendEMIStatementWhatsApp({
        customerName: booking.customer_name || "Customer",
        customerPhone: booking.customer_phone || "",
        unitProjectDetails: `${prjName ? prjName.slice(0, 18) : "Project"} · Plot #${plotNo}`,
        totalContractPrice: totalPrice,
        totalAmountRealized: advancePaid,
        remainingBalance: pendingDues,
        paidInstallmentsText: `${realizedCount} of ${totalCount} EMIs`,
        pendingInstallmentsText: `${Math.max(totalCount - realizedCount, 0)} EMIs remaining`,
        nextDueDate: nextDueDateStr,
        nextDueAmount: nextDueAmount,
        pdfDocumentUrl: pdfUrl || undefined,
        pdfFileName: `EMI_Statement_Plot_${plotNo}.pdf`,
      });

      toast.dismiss(toastId);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(`WhatsApp API Error: ${res.message}`, {
          duration: 10000,
          action: res.deepLink
            ? {
                label: "Open 1-Tap WhatsApp",
                onClick: () => window.open(res.deepLink, "_blank"),
              }
            : undefined,
        });
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "Failed to send WhatsApp PDF Statement");
    } finally {
      setSendingWhatsAppPDF(false);
    }
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-6xl max-h-[92vh] overflow-y-auto overflow-x-hidden bg-card p-5 md:p-7 gap-5 shadow-2xl border border-border rounded-2xl">
        <DialogHeader className="border-b border-border/60 pb-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-xs uppercase bg-terracotta/10 text-terracotta border-terracotta/30 px-2.5 py-0.5">
                {prjCode}
              </Badge>
              <Badge variant="secondary" className="font-bold text-xs px-2.5 py-0.5">
                Plot #{plotNo}
              </Badge>
              {govtValuation > 0 && (
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 font-bold px-2.5 py-0.5 flex items-center gap-1">
                  🏛️ Govt Valuation: {formatMoney(govtValuation)}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                disabled={sendingWhatsApp}
                onClick={handleSendWhatsAppEMI}
                className="border-emerald-600/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-extrabold gap-1.5 shadow-xs"
              >
                <MessageCircle className="h-4 w-4 text-emerald-600" />
                {sendingWhatsApp ? "Sending..." : "WhatsApp Text"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadPDF}
                className="border-terracotta/40 text-terracotta hover:bg-terracotta/10 text-xs font-bold gap-1.5 shadow-xs"
              >
                <Download className="h-4 w-4" /> Download PDF Statement
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={sendingWhatsAppPDF}
                onClick={handleSendWhatsAppPDF}
                className="border-emerald-700 text-emerald-800 dark:text-emerald-200 bg-emerald-600/15 hover:bg-emerald-600/25 text-xs font-extrabold gap-1.5 shadow-xs"
              >
                <MessageCircle className="h-4 w-4 text-emerald-600 fill-emerald-600/20" />
                {sendingWhatsAppPDF ? "Sending PDF..." : "Send WhatsApp PDF"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAccountingHelp(!showAccountingHelp)}
                className="text-xs gap-1.5 border-border hover:bg-muted text-muted-foreground"
              >
                <HelpCircle className="h-3.5 w-3.5 text-terracotta" />
                {showAccountingHelp ? "Hide Accounting Guide" : "Tally Dr / Cr Guide"}
              </Button>

              <Button
                size="sm"
                variant="default"
                onClick={() => syncCustomerLedgerToTally(false)}
                disabled={syncing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs gap-2 px-4 shadow-sm"
              >
                <Zap className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing to Tally..." : "⚡ Sync to Tally Prime"}
              </Button>
            </div>
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
              <DialogTitle className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-terracotta" /> Tally Customer Ledger Statement
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Official Ark Builders Customer Ledger with automated Sales & Receipt Voucher sync to Tally Prime.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {showAccountingHelp && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2 text-foreground">
            <div className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2 text-sm">
              <HelpCircle className="h-4 w-4" /> Real Estate Customer Tally Accounting Principles:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-background/80 rounded-lg border border-amber-500/20">
                <span className="font-bold text-amber-600 dark:text-amber-400 block mb-1">📜 1. Sales Voucher (Debit)</span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Upon plot booking, a <strong>Sales Voucher</strong> debits the Customer Account (under <em>Sundry Debtors</em>) and credits <strong>Plot Sales Revenue</strong>.
                </p>
              </div>

              <div className="p-3 bg-background/80 rounded-lg border border-emerald-500/20">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-1">💳 2. Receipt Vouchers (Credit)</span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Each installment payment or advance received logs a <strong>Receipt Voucher</strong> that debits <strong>{prjName} Collection Bank A/c</strong> and credits the Customer Account.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Section Header Cards & Sync Action */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-terracotta" /> Target Tally Ledger
            </span>
            <span className="font-bold text-xs text-foreground block truncate" title={customerLedgerName}>
              {customerLedgerName}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">Under Sundry Debtors</span>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-terracotta" /> Agreed Deal Value
            </span>
            <span className="font-extrabold text-sm text-foreground block">{formatMoney(totalPrice)}</span>
            <span className="text-[11px] text-muted-foreground">Total Contract</span>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <IndianRupee className="h-3.5 w-3.5" /> Money Collected
            </span>
            <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 block">{formatMoney(totalCollected)}</span>
            <span className="text-[11px] text-emerald-600 font-semibold">{collectedPct}% Received</span>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Outstanding Balance
            </span>
            <span className="font-extrabold text-sm text-amber-600 dark:text-amber-400 block">{formatMoney(pendingDues)}</span>
            <span className="text-[11px] text-muted-foreground">Current Dr Balance</span>
          </div>
        </div>

        {/* Section Progress Bar */}
        <div className="space-y-1.5 px-0.5">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-muted-foreground flex items-center gap-1.5">
              📊 Customer Collection Progress
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono">
              {formatMoney(totalCollected)} of {formatMoney(totalPrice)} ({collectedPct}%)
            </span>
          </div>
          <Progress value={collectedPct} className="h-2.5 bg-muted" />
        </div>

        {/* Table */}
        <div className="space-y-3 w-full">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-terracotta" />
              Customer Ledger Entries ({statement.length} items)
            </h4>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncCustomerLedgerToTally(true)}
                disabled={syncing}
                className="text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground border-border"
                title="Force re-sync all entries to Tally Prime"
              >
                <Zap className={`h-3 w-3 ${syncing ? "animate-spin" : "text-amber-500"}`} />
                Re-sync All
              </Button>
              <Button
                size="sm"
                onClick={() => syncCustomerLedgerToTally(false)}
                disabled={syncing}
                className="text-xs font-bold gap-2 px-3.5 bg-terracotta hover:bg-terracotta/90 text-white shadow-xs"
              >
                <Zap className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync Unsynced to Tally Prime"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 overflow-hidden bg-card shadow-xs w-full">
            <table className="w-full text-xs text-left border-collapse table-auto">
              <thead>
                <tr className="bg-muted/70 border-b border-border/80 uppercase text-[10px] tracking-wider text-muted-foreground font-bold">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Vch Type</th>
                  <th className="py-3 px-3">Voucher Ref</th>
                  <th className="py-3 px-3">Particulars & Description</th>
                  <th className="py-3 px-3 text-right">Billed Amount (Dr)</th>
                  <th className="py-3 px-3 text-right">Received Amount (Cr)</th>
                  <th className="py-3 px-3 text-right">Remaining Dues</th>
                  <th className="py-3 px-3 text-center">Tally Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {statement.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-3 font-sans text-muted-foreground whitespace-nowrap">{row.date}</td>
                    <td className="py-3 px-3 font-sans whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold px-2 py-0.5 ${
                          row.vchType === "Sales"
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                            : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        }`}
                      >
                        {row.vchType}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 font-bold text-foreground whitespace-nowrap">{row.refNo}</td>
                    <td className="py-3 px-3 font-sans">
                      <div className="font-semibold text-foreground">{row.particulars}</div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-sm mt-0.5" title={row.narrative}>
                        {row.narrative}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-foreground whitespace-nowrap">
                      {row.debit > 0 ? formatMoney(row.debit) : "—"}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {row.credit > 0 ? formatMoney(row.credit) : "—"}
                    </td>
                    <td className="py-3 px-3 text-right font-bold whitespace-nowrap">
                      {row.runningBalance <= 0.01 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">₹0.00 (Fully Settled)</span>
                      ) : (
                        <span className="text-terracotta">{formatMoney(row.runningBalance)} Dr</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-sans whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleRowSync(row)}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        title={row.isSynced ? "Click to toggle status to Pending" : "Click to toggle status to Synced"}
                      >
                        {row.isSynced ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 inline-flex items-center"
                          >
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Synced
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 inline-flex items-center"
                          >
                            <Clock className="h-3 w-3 text-amber-600 animate-pulse" /> Pending
                          </Badge>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-r from-terracotta/10 via-amber-500/10 to-card border border-terracotta/20 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-terracotta font-bold text-sm">
            <Landmark className="h-4 w-4" /> How to View this Customer Ledger in Tally Prime:
          </div>
          <div className="text-muted-foreground space-y-1.5 pl-5 list-decimal font-medium">
            <p>1. Open <strong>Tally Prime</strong> ➔ Press <kbd className="px-2 py-0.5 bg-muted rounded border text-[11px] font-mono">Alt + G</kbd> (Go To).</p>
            <p>2. Type <strong>`Ledger Vouchers`</strong> and press <strong>Enter</strong>.</p>
            <p>3. Select Target Ledger: <strong className="text-foreground">{customerLedgerName}</strong>.</p>
            <p>4. Tally Prime will display the single Sales Voucher + Receipts with a net balance of <strong className="text-emerald-600">{formatMoney(pendingDues)} Dr</strong>!</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              className="border-terracotta/40 text-terracotta hover:bg-terracotta/10 text-xs font-bold gap-1.5 shadow-xs"
            >
              <Download className="h-4 w-4" /> Download PDF Statement
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={sendingWhatsAppPDF}
              onClick={handleSendWhatsAppPDF}
              className="border-emerald-700 text-emerald-800 dark:text-emerald-200 bg-emerald-600/15 hover:bg-emerald-600/25 text-xs font-extrabold gap-1.5 shadow-xs"
            >
              <MessageCircle className="h-4 w-4 text-emerald-600 fill-emerald-600/20" />
              {sendingWhatsAppPDF ? "Sending PDF..." : "Send WhatsApp PDF"}
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs px-5">
            Close Statement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
