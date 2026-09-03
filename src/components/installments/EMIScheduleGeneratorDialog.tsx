import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Calculator,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Lock,
  Download,
  MessageCircle,
  Zap,
} from "lucide-react";
import { downloadEMIStatementPDF, uploadEMIStatementPDFToStorage } from "@/lib/emiStatementPDF";
import { sendEMIStatementWhatsApp } from "@/lib/whatsappService";
import { supabase } from "@/integrations/supabase/client";
import {
  reconcileScheduleRows,
  addMonthsToDate,
  EMIScheduleRowItem,
} from "@/lib/emiReconciliation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface EMIScheduleRow extends EMIScheduleRowItem {}

interface EMIScheduleGeneratorDialogProps {
  booking: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const money = (val: number) => `₹${Math.round(val || 0).toLocaleString("en-IN")}`;

const cleanNote = (note?: string, num?: number) => {
  if (!note) return `EMI #${num || 1}`;
  const cleaned = note.replace(/Govt Guideline |Company Commercial /gi, "").trim();
  return cleaned || `EMI #${num || 1}`;
};

export function EMIScheduleGeneratorDialog({
  booking,
  open,
  onOpenChange,
  onSuccess,
}: EMIScheduleGeneratorDialogProps) {
  const queryClient = useQueryClient();

  const totalPrice = Number(booking?.total_price || 0);
  const advancePaid = Number(booking?.advance_paid || 0);

  // Fetch recorded payments for this booking to know exact funds collected
  const { data: payments = [] } = useQuery({
    queryKey: ["booking-payments", booking?.id],
    queryFn: async () => {
      if (!booking?.id) return [];
      const { data, error } = await (supabase as any)
        .from("installment_payments")
        .select("*")
        .eq("booking_id", booking.id)
        .order("paid_on", { ascending: true });
      if (error) return [];
      return data || [];
    },
    enabled: Boolean(booking?.id && open),
  });

  const totalRecorded = useMemo(
    () => payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0),
    [payments]
  );
  const totalCollected = Math.max(advancePaid, totalRecorded);
  const netPrincipal = Math.max(0, totalPrice - totalCollected);

  const [monthsCount, setMonthsCount] = useState<number>(booking?.installment_count || 12);
  const [recurrenceDay, setRecurrenceDay] = useState<string>("5");
  const [startDate, setStartDate] = useState<string>(
    booking?.first_installment_due_date || new Date().toISOString().slice(0, 10)
  );

  const [rows, setRows] = useState<EMIScheduleRow[]>([]);
  const [autoRebalance, setAutoRebalance] = useState<boolean>(true);

  const { data: existingSchedules = [] } = useQuery({
    queryKey: ["booking-schedules", booking?.id],
    queryFn: async () => {
      if (!booking?.id) return [];
      const { data, error } = await (supabase as any)
        .from("booking_installment_schedules")
        .select("*")
        .eq("booking_id", booking.id)
        .order("installment_number", { ascending: true });
      if (error) return [];
      return data || [];
    },
    enabled: Boolean(booking?.id && open),
  });

  useEffect(() => {
    if (booking && open) {
      if (existingSchedules.length > 0 || payments.length > 0) {
        const rawRows = existingSchedules.map((item: any) => ({
          id: item.id,
          installment_number: item.installment_number,
          due_date: item.due_date,
          amount: Number(item.amount),
          paid_amount: Number(item.paid_amount || 0),
          status: item.status || "pending",
          notes: cleanNote(item.notes, item.installment_number),
        }));

        // Reconcile existing schedule rows against actual recorded payment vouchers
        const reconciled = reconcileScheduleRows({
          rows: rawRows,
          payments,
          totalPrice,
          totalCollected,
          startDate: booking?.first_installment_due_date || rawRows[0]?.due_date || startDate,
          recurrenceDay,
          targetTotalTerms: Math.max(monthsCount || 12, payments.length + 1),
          autoRebalancePending: true,
        });

        setRows(reconciled.reconciledRows);
        setMonthsCount(reconciled.reconciledRows.length);
        if (rawRows[0]?.due_date) {
          const dayNum = parseInt(rawRows[0].due_date.split("-")[2], 10);
          if (!isNaN(dayNum)) setRecurrenceDay(String(dayNum));
        }
      } else {
        generateEqualSchedule(
          monthsCount > 0 ? monthsCount : 12,
          startDate,
          recurrenceDay
        );
      }
    }
  }, [booking, open, existingSchedules, payments, totalCollected, totalPrice]);

  // Helper: Checks if a row is paid/finalized and locked
  const isPaidRow = (r: EMIScheduleRow) =>
    r.status === "paid" || (r.paid_amount !== undefined && r.paid_amount >= r.amount);

  // Equal Schedule Generation & Auto-Recalculation (PRESERVES PAID ROWS & REBALANCES PENDING)
  const generateEqualSchedule = (count: number, start: string, day: string) => {
    const terms = Math.max(1, count || 12);
    const reconciled = reconcileScheduleRows({
      rows: rows.length > 0 ? rows : [],
      payments,
      totalPrice,
      totalCollected,
      startDate: start,
      recurrenceDay: day,
      targetTotalTerms: terms,
      autoRebalancePending: true,
    });

    setRows(reconciled.reconciledRows);
    setMonthsCount(reconciled.reconciledRows.length);
  };

  const totalScheduled = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [rows]
  );

  const paidCount = useMemo(() => rows.filter(isPaidRow).length, [rows]);
  const diffBalance = Math.round(totalPrice - totalScheduled);
  const isBalanced = Math.abs(diffBalance) < 1;
  const isOverScheduled = totalScheduled > totalPrice;
  const overAllocatedAmt = Math.max(0, totalScheduled - totalPrice);

  const handleAutoBalance = () => {
    if (rows.length === 0) return;
    generateEqualSchedule(monthsCount, startDate, recurrenceDay);
  };

  const updateRow = (index: number, field: keyof EMIScheduleRow, val: any) => {
    if (isPaidRow(rows[index])) {
      toast.error("Cannot modify a paid installment line item.");
      return;
    }
    const updated = [...rows];

    // Dynamic Downstream Auto-Rebalance and Hard Cap when editing amount
    if (field === "amount") {
      let numVal = Number(val) || 0;
      if (numVal < 0) numVal = 0;

      // Hard clamp: a single line item can NEVER exceed the total agreement price
      const otherPaidSum = rows
        .filter((_, i) => i !== index && isPaidRow(rows[i]))
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const maxAllowed = Math.max(0, totalPrice - otherPaidSum);

      if (numVal > maxAllowed) {
        numVal = maxAllowed;
        toast.warning(
          `Capped at ${money(maxAllowed)} (maximum allowed for agreement price of ${money(totalPrice)})`
        );
      }

      updated[index] = { ...updated[index], amount: numVal };

      // Dynamic Downstream Auto-Rebalance when editing amount
      if (autoRebalance) {
        const downstreamIndices: number[] = [];
        for (let i = index + 1; i < updated.length; i++) {
          if (!isPaidRow(updated[i])) {
            downstreamIndices.push(i);
          }
        }

        if (downstreamIndices.length > 0) {
          let sumUpToCurrent = 0;
          for (let i = 0; i <= index; i++) {
            sumUpToCurrent += Number(updated[i].amount) || 0;
          }

          const remainingToDistribute = Math.max(0, totalPrice - sumUpToCurrent);
          const count = downstreamIndices.length;
          const baseShare = Math.floor(remainingToDistribute / count);
          const remainder = remainingToDistribute - baseShare * count;

          downstreamIndices.forEach((dIdx, pos) => {
            const isLast = pos === count - 1;
            updated[dIdx].amount = isLast ? baseShare + remainder : baseShare;
          });
        }
      }
    } else {
      updated[index] = { ...updated[index], [field]: val };
    }

    setRows(updated);
  };

  const addCustomRow = () => {
    const nextNum = rows.length + 1;
    const lastDate = rows[rows.length - 1]?.due_date || startDate;
    const nextDate = addMonthsToDate(lastDate, 1, recurrenceDay);

    const paidRows = rows.filter(isPaidRow);
    const unpaidRows = rows.filter((r) => !isPaidRow(r));
    const paidSum = paidRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const unpaidSum = unpaidRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const remainingToAllocate = Math.max(0, totalPrice - paidSum - unpaidSum);

    const newRow: EMIScheduleRow = {
      installment_number: nextNum,
      due_date: nextDate,
      amount: remainingToAllocate > 0 ? remainingToAllocate : 0,
      status: "pending",
      notes: `EMI #${nextNum}`,
    };

    setRows([...rows, newRow]);
    setMonthsCount(rows.length + 1);
  };

  const deleteRow = (index: number) => {
    if (isPaidRow(rows[index])) {
      toast.error("Cannot delete a paid installment line item.");
      return;
    }
    const filtered = rows.filter((_, i) => i !== index);
    const reindexed = filtered.map((r, i) => ({
      ...r,
      installment_number: i + 1,
    }));
    setRows(reindexed);
    setMonthsCount(reindexed.length);
  };

  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      if (!booking?.id) throw new Error("No booking selected");
      if (rows.length === 0) throw new Error("Cannot save empty schedule");

      if (totalScheduled > totalPrice) {
        throw new Error(
          `Cannot save: Total scheduled amount (${money(totalScheduled)}) exceeds the booking total price (${money(totalPrice)}) by ${money(totalScheduled - totalPrice)}. Please adjust row amounts.`
        );
      }

      const { error: delError } = await (supabase as any)
        .from("booking_installment_schedules")
        .delete()
        .eq("booking_id", booking.id);

      if (delError) {
        console.warn("Delete old schedules note:", delError.message);
      }

      const payload = rows.map((r, i) => ({
        booking_id: booking.id,
        installment_number: i + 1,
        due_date: r.due_date,
        amount: Number(r.amount),
        paid_amount: Number(r.paid_amount || 0),
        status: r.status || "pending",
        notes: cleanNote(r.notes, i + 1),
      }));

      const { error: insError } = await (supabase as any)
        .from("booking_installment_schedules")
        .insert(payload);

      if (insError) throw insError;

      const firstDue = rows[0]?.due_date || null;
      const firstAmt = rows[0]?.amount || 0;
      await (supabase as any)
        .from("bookings")
        .update({
          installment_count: rows.length,
          installment_amount: firstAmt,
          first_installment_due_date: firstDue,
        })
        .eq("id", booking.id);
    },
    onSuccess: () => {
      toast.success("Everything is done! Installment schedule saved successfully.");
      queryClient.invalidateQueries({ queryKey: ["booking-schedules", booking?.id] });
      queryClient.invalidateQueries({ queryKey: ["all-booking-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["bookings-admin"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save EMI schedule");
    },
  });

  const handleDownloadPDF = () => {
    if (!booking) return;
    downloadEMIStatementPDF({
      customerName: booking.customer_name || "Customer",
      customerPhone: booking.customer_phone || undefined,
      customerAddress: booking.customer_address || undefined,
      projectName: booking.plots?.projects?.name || "Project",
      projectCode: booking.plots?.projects?.code || "PRJ",
      plotNumber: String(booking.plots?.plot_number || "N/A"),
      areaSqft: Number(booking.plots?.area_sqft || 0) || undefined,
      totalPrice,
      advancePaid,
      remainingBalance: Math.max(0, totalPrice - advancePaid),
      installmentCount: monthsCount,
      firstDueDate: startDate,
      bookingDate: booking?.booking_date || booking?.created_at,
      scheduleRows: rows,
    });
    toast.success("Generated EMI Statement PDF for download!");
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
        projectName: booking.plots?.projects?.name || "Project",
        projectCode: booking.plots?.projects?.code || "PRJ",
        plotNumber: String(booking.plots?.plot_number || "N/A"),
        areaSqft: Number(booking.plots?.area_sqft || 0) || undefined,
        totalPrice,
        advancePaid,
        remainingBalance: Math.max(0, totalPrice - advancePaid),
        installmentCount: monthsCount,
        firstDueDate: startDate,
        scheduleRows: rows,
      });

      const totalCount = monthsCount || 12;
      const realizedCount = rows.filter((r) => String(r.status).toLowerCase() === "paid").length;
      const remainingVal = Math.max(0, totalPrice - advancePaid);

      const res = await sendEMIStatementWhatsApp({
        customerName: booking.customer_name || "Customer",
        customerPhone: booking.customer_phone || "",
        unitProjectDetails: `${booking.plots?.projects?.name ? booking.plots.projects.name.slice(0, 18) : "Project"} · Plot #${booking.plots?.plot_number || "N/A"}`,
        totalContractPrice: totalPrice,
        totalAmountRealized: advancePaid,
        remainingBalance: remainingVal,
        paidInstallmentsText: `${realizedCount} of ${totalCount} EMIs`,
        pendingInstallmentsText: `${Math.max(totalCount - realizedCount, 0)} EMIs remaining`,
        nextDueDate: startDate || new Date().toISOString().slice(0, 10),
        nextDueAmount: rows.find((r) => String(r.status).toLowerCase() !== "paid")?.amount || 0,
        pdfDocumentUrl: pdfUrl || undefined,
        pdfFileName: `EMI_Statement_Plot_${booking.plots?.plot_number || "Mapped"}.pdf`,
      });

      toast.dismiss(toastId);
      if (res.success) {
        toast.success(res.message);
      } else {
        const isAuthErr = res.message?.includes("190") || res.message?.includes("Authentication");
        const displayMsg = isAuthErr
          ? "WhatsApp Meta Token Expired on deployed build. Re-deploying latest token to Vercel..."
          : res.message || "Failed to send WhatsApp PDF Statement";

        toast.error(`WhatsApp API Error: ${displayMsg}`, {
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
      <DialogContent className="w-[96vw] max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-3xl">
        <DialogHeader className="p-5 pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
              <Calculator className="h-5 w-5 text-terracotta" />
              EMI Schedule Planner
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Configure structured EMI schedules for <strong>{booking.customer_name}</strong> (Plot #{booking.plots?.plot_number || "Mapped"} · {booking.plots?.projects?.name}).
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              className="border-terracotta/40 text-terracotta hover:bg-terracotta/10 gap-1.5 text-xs font-bold shadow-xs rounded-xl"
            >
              <Download className="h-4 w-4" /> Download PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={sendingWhatsAppPDF}
              onClick={handleSendWhatsAppPDF}
              className="border-emerald-700 text-emerald-800 dark:text-emerald-200 bg-emerald-600/15 hover:bg-emerald-600/25 gap-1.5 text-xs font-extrabold shadow-xs rounded-xl"
            >
              <MessageCircle className="h-4 w-4 text-emerald-600 fill-emerald-600/20" />
              {sendingWhatsAppPDF ? "Sending..." : "Send WhatsApp PDF"}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Summary Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl border bg-card/60 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Agreement Price</span>
              <span className="text-base font-extrabold text-foreground font-mono">{money(totalPrice)}</span>
              <span className="text-[10px] text-muted-foreground block font-medium">Contract Value</span>
            </div>

            <div className="p-3.5 rounded-2xl border bg-emerald-500/10 border-emerald-500/30 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                Total Money Received
              </span>
              <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {money(totalCollected)}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium block font-bold">
                ✓ {paidCount} EMI{paidCount !== 1 ? "s" : ""} Settled
              </span>
            </div>

            <div className="p-3.5 rounded-2xl border bg-terracotta/10 border-terracotta/30 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-terracotta block">
                Outstanding Balance
              </span>
              <span className="text-base font-extrabold text-terracotta font-mono">
                {money(netPrincipal)}
              </span>
              <span className="text-[10px] text-muted-foreground block font-medium">
                {Math.max(0, rows.length - paidCount)} Pending Term{rows.length - paidCount !== 1 ? "s" : ""}
              </span>
            </div>

            <div
              className={`p-3.5 rounded-2xl border space-y-1 ${
                isOverScheduled
                  ? "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/30"
                  : isBalanced
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-600"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block">Total Scheduled</span>
              <span className="text-base font-extrabold font-mono block">{money(totalScheduled)}</span>
              <span className="text-[10px] font-semibold block">
                {isOverScheduled
                  ? `🚨 Exceeds Deal by ${money(overAllocatedAmt)}`
                  : isBalanced
                  ? "✅ 100% Balanced"
                  : `Diff: ${money(diffBalance)}`}
              </span>
            </div>
          </div>

          {/* Quick Auto-Generator Controls */}
          <div className="p-4 rounded-2xl border bg-muted/30 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-terracotta" />
                Schedule Parameters
              </span>
              <span className="text-[11px] text-muted-foreground">
                Set monthly installments count and due day to auto-divide remaining balance.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="months-count" className="text-[11px] font-bold">
                  Installment Months
                </Label>
                <Input
                  id="months-count"
                  type="number"
                  min="1"
                  max="60"
                  placeholder="12"
                  value={monthsCount === 0 ? "" : monthsCount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/^0+(?=\d)/, "");
                    setMonthsCount(raw === "" ? 0 : parseInt(raw, 10) || 0);
                  }}
                  className="h-9 text-xs font-mono rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="start-date" className="text-[11px] font-bold">
                  First Due Date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (e.target.value) {
                      setRecurrenceDay(String(parseInt(e.target.value.split("-")[2], 10)));
                    }
                  }}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="recurrence-day" className="text-[11px] font-bold">
                  Monthly Due Day
                </Label>
                <Select value={recurrenceDay} onValueChange={setRecurrenceDay}>
                  <SelectTrigger id="recurrence-day" className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="1">1st of Month</SelectItem>
                    <SelectItem value="5">5th of Month</SelectItem>
                    <SelectItem value="10">10th of Month</SelectItem>
                    <SelectItem value="15">15th of Month</SelectItem>
                    <SelectItem value="20">20th of Month</SelectItem>
                    <SelectItem value="25">25th of Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => generateEqualSchedule(monthsCount, startDate, recurrenceDay)}
                  className="h-9 text-xs w-full bg-terracotta hover:bg-terracotta/90 text-white font-extrabold gap-1.5 rounded-xl shadow-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Generate Equal EMIs
                </Button>
              </div>
            </div>
          </div>

          {/* Validation Alert Bar */}
          {isOverScheduled ? (
            <div className="p-3.5 rounded-2xl border bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300 flex items-center justify-between text-xs animate-pulse">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
                <p>
                  🚨 <strong>OVER-ALLOCATED:</strong> Total scheduled sum (<strong>{money(totalScheduled)}</strong>) exceeds total agreement contract value (<strong>{money(totalPrice)}</strong>) by <strong>{money(overAllocatedAmt)}</strong>. Please reduce line amounts or auto-balance before saving.
                </p>
              </div>

              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleAutoBalance}
                className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-extrabold gap-1.5 rounded-xl shrink-0 ml-3 shadow-sm cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Auto-Fix & Balance
              </Button>
            </div>
          ) : !isBalanced && (
            <div className="p-3.5 rounded-2xl border bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                <p>
                  Scheduled total differs by <strong>{money(Math.abs(diffBalance))}</strong> from Total Target (
                  {diffBalance > 0 ? "Under-scheduled" : "Over-scheduled"}).
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoBalance}
                className="h-7.5 text-xs border-amber-500/40 text-amber-800 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 font-bold gap-1 rounded-xl"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Auto-Balance Difference
              </Button>
            </div>
          )}

          {/* Interactive Line-Item Table */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                <Calculator className="h-4 w-4 text-terracotta" />
                Schedule Line Items ({rows.length} Month{rows.length !== 1 ? "s" : ""})
              </h4>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoRebalance(!autoRebalance)}
                  className={`h-8 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    autoRebalance
                      ? "bg-terracotta/10 border-terracotta/40 text-terracotta shadow-xs"
                      : "bg-muted border-border text-muted-foreground"
                  }`}
                  title="When enabled, changing any EMI amount automatically re-divides the remaining balance across downstream EMIs."
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Auto-Rebalance Downstream: <strong>{autoRebalance ? "ON" : "OFF"}</strong></span>
                </button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addCustomRow()}
                  className="h-8 text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1 font-bold rounded-xl"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Line Item
                </Button>
              </div>
            </div>

            {/* PAID INSTALLMENT LOCK PROTECTION NOTICE BANNER */}
            {paidCount > 0 && (
              <div className="p-2.5 px-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>{paidCount} Installment{paidCount > 1 ? "s" : ""} PAID & Locked</strong> — Generators will ONLY distribute across the remaining <strong>{rows.length - paidCount} pending installment(s)</strong>.
                  </span>
                </span>
              </div>
            )}

            <div className="border border-border/80 rounded-2xl overflow-hidden bg-card shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground border-b text-[10px] uppercase font-extrabold tracking-wider">
                  <tr>
                    <th className="p-3 pl-4 w-12 text-center">#</th>
                    <th className="p-3 w-40">Due Date</th>
                    <th className="p-3 w-44">Amount (₹)</th>
                    <th className="p-3 min-w-[200px]">Notes / Milestone Description</th>
                    <th className="p-3 w-32 text-center">Status</th>
                    <th className="p-3 pr-4 w-14 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {rows.map((row, idx) => {
                    const isPaid = isPaidRow(row);

                    return (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          isPaid ? "bg-emerald-500/[0.06] hover:bg-emerald-500/[0.09]" : "hover:bg-muted/20"
                        }`}
                      >
                        <td className="p-3 text-center font-extrabold text-muted-foreground">{row.installment_number}</td>

                        <td className="p-2.5">
                          <Input
                            type="date"
                            disabled={isPaid}
                            value={row.due_date}
                            onChange={(e) => updateRow(idx, "due_date", e.target.value)}
                            className="h-8.5 text-xs font-mono rounded-lg disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                        </td>

                        <td className="p-2.5">
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-xs font-bold text-muted-foreground">₹</span>
                            <Input
                              type="text"
                              disabled={isPaid}
                              placeholder="0"
                              value={row.amount === 0 ? "" : row.amount.toLocaleString("en-IN")}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const rawDigits = e.target.value.replace(/[^0-9]/g, "");
                                const parsed = rawDigits ? parseInt(rawDigits, 10) : 0;
                                updateRow(idx, "amount", parsed);
                              }}
                              className={`h-8.5 pl-6 text-xs font-mono font-extrabold rounded-lg disabled:opacity-75 disabled:cursor-not-allowed ${
                                isOverScheduled && !isPaid
                                  ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500"
                                  : ""
                              }`}
                            />
                          </div>
                        </td>

                        <td className="p-2.5">
                          <Input
                            type="text"
                            disabled={isPaid}
                            value={row.notes}
                            onChange={(e) => updateRow(idx, "notes", e.target.value)}
                            placeholder="e.g. Regular EMI"
                            className="h-8.5 text-xs font-sans rounded-lg disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                        </td>

                        <td className="p-2.5 text-center">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              <Lock className="h-3 w-3 text-emerald-600" />
                              {row.status === "partially_paid" ? "PARTIAL" : "PAID"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                              {row.status || "pending"}
                            </span>
                          )}
                        </td>

                        <td className="p-2.5 text-right pr-4">
                          {isPaid ? (
                            <div className="flex justify-center" title="Paid installment locked">
                              <Lock className="h-3.5 w-3.5 text-emerald-600/50" />
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteRow(idx)}
                              className="h-7.5 w-7.5 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 rounded-lg"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-muted/20 flex flex-row items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              className="border-terracotta/40 text-terracotta hover:bg-terracotta/10 gap-1.5 font-bold text-xs shadow-xs rounded-xl"
            >
              <Download className="h-4 w-4" /> Download Statement PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={sendingWhatsAppPDF}
              onClick={handleSendWhatsAppPDF}
              className="border-emerald-700 text-emerald-800 dark:text-emerald-200 bg-emerald-600/15 hover:bg-emerald-600/25 gap-1.5 text-xs font-extrabold shadow-xs rounded-xl"
            >
              <MessageCircle className="h-4 w-4 text-emerald-600 fill-emerald-600/20" />
              {sendingWhatsAppPDF ? "Sending..." : "Send WhatsApp PDF"}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => saveScheduleMutation.mutate()}
              disabled={saveScheduleMutation.isPending || rows.length === 0 || isOverScheduled}
              className={`font-extrabold text-xs gap-1.5 shadow-sm rounded-xl transition-all ${
                isOverScheduled
                  ? "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 cursor-not-allowed opacity-90"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              }`}
              title={isOverScheduled ? "Cannot save: Total scheduled amount exceeds agreement deal price" : ""}
            >
              {isOverScheduled ? (
                <>
                  <AlertCircle className="h-4 w-4 text-rose-600" /> Over-Allocated (Cannot Save)
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {saveScheduleMutation.isPending ? "Saving..." : "Save EMI Schedule"}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
