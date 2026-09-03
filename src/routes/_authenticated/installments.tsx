import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calculator,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Edit2,
  FileSpreadsheet,
  Lock,
  Plus,
  Search,
  Sparkles,
  WalletCards,
  Download,
  MessageCircle,
  Building2,
  IndianRupee,
  TrendingUp,
  ArrowUpDown,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  SlidersHorizontal,
  HelpCircle,
  MoreHorizontal,
  FileText,
  Zap,
  Activity,
  ArrowUpRight,
  Landmark,
  Layers,
  ChevronDown,
  ArrowRight,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CustomerTallyLedgerModal } from "@/components/analytics/CustomerTallyLedgerModal";
import { EMIScheduleGeneratorDialog } from "@/components/installments/EMIScheduleGeneratorDialog";
import { downloadEMIStatementPDF, uploadEMIStatementPDFToStorage } from "@/lib/emiStatementPDF";
import { sendEMIStatementWhatsApp } from "@/lib/whatsappService";
import { reconcileScheduleRows } from "@/lib/emiReconciliation";
import { syncPaymentToTally, markPaymentSyncedToTally } from "@/lib/tallySync";
import { PaymentReferenceInput, validatePaymentReference } from "@/components/ui/payment-reference-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/installments")({
  component: InstallmentsPage,
});

const money = (value: number) =>
  `₹${Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const localDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

function paymentHealth(booking: any, ledger: any[], schedules: any[]) {
  const totalPrice = Number(booking.total_price ?? 0);
  const ledgerSum = (ledger || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  const paid = Math.max(Number(booking.advance_paid ?? 0), ledgerSum);
  const remaining = Math.max(0, totalPrice - paid);
  const plannedInstallments = Math.max(1, Number(booking.installment_count ?? 1));
  const recordedCount = ledger.length;
  const hasSavedSchedule = schedules && schedules.length > 0;

  // 1. FULLY PAID / COMPLETED
  if (remaining <= 0) {
    return {
      overdue: 0,
      dueCount: plannedInstallments,
      expected: totalPrice,
      nextDue: null,
      scheduled: hasSavedSchedule,
      planExhausted: true,
      recordedCount,
      status: "fully_paid",
      statusLabel: "Fully paid",
      subtext: "All payments received · Plot fully settled",
    };
  }

  // 2. NO SAVED SCHEDULE YET
  if (!hasSavedSchedule) {
    return {
      overdue: 0,
      dueCount: 0,
      expected: paid,
      nextDue: null,
      scheduled: false,
      planExhausted: false,
      recordedCount,
      status: "schedule_needed",
      statusLabel: "Schedule Required",
      subtext: "EMI installment schedule must be configured before collecting payments",
    };
  }

  // 3. WITH SAVED SCHEDULES (Run FIFO allocation simulation to calculate exact status)
  let fundPool = paid;
  let settledCount = 0;
  let overdueTotal = 0;
  let overdueCount = 0;
  let nextDueObj: any = null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sortedSchedules = [...schedules].sort(
    (a: any, b: any) => (a.installment_number || 0) - (b.installment_number || 0)
  );

  sortedSchedules.forEach((s: any) => {
    const emiAmt = Number(s.amount) || 0;
    let isSettled = false;

    if (fundPool >= emiAmt && emiAmt > 0) {
      isSettled = true;
      settledCount++;
      fundPool -= emiAmt;
    } else if (s.status === "paid" || Number(s.paid_amount || 0) >= emiAmt) {
      isSettled = true;
      settledCount++;
    }

    if (!isSettled) {
      if (!nextDueObj) nextDueObj = s;
      if (s.due_date) {
        const dueDate = localDate(s.due_date);
        if (dueDate < today) {
          const unpaid = Math.max(0, emiAmt - fundPool);
          overdueTotal += unpaid;
          overdueCount++;
        }
      }
      fundPool = 0;
    }
  });

  const nextDueDate = nextDueObj?.due_date ? localDate(nextDueObj.due_date) : null;
  const pendingCount = Math.max(0, sortedSchedules.length - settledCount);

  if (overdueTotal > 0) {
    return {
      overdue: overdueTotal,
      dueCount: overdueCount,
      expected: paid + overdueTotal,
      nextDue: nextDueDate,
      scheduled: true,
      planExhausted: pendingCount === 0,
      recordedCount,
      status: "overdue",
      statusLabel: `Overdue (${overdueCount} EMI${overdueCount > 1 ? "s" : ""})`,
      subtext: `${money(overdueTotal)} overdue across ${overdueCount} installment${overdueCount > 1 ? "s" : ""}`,
    };
  }

  return {
    overdue: 0,
    dueCount: settledCount,
    expected: paid,
    nextDue: nextDueDate,
    scheduled: true,
    planExhausted: pendingCount === 0,
    recordedCount,
    status: "on_track",
    statusLabel: "On Track",
    subtext: `${settledCount} of ${sortedSchedules.length} EMIs settled · ${money(remaining)} remaining`,
  };
}

function InstallmentsPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();

  // Payment Recording State
  const [activeBooking, setActiveBooking] = useState<any | null>(null);

  const [payment, setPayment] = useState({
    amount: "",
    paid_on: new Date().toISOString().slice(0, 10),
    payment_method: "UPI",
    reference_number: "",
    bank_account_id: "",
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "overdue" | "on_track" | "fully_paid" | "schedule_needed"
  >("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("largest_balance");

  // Fetch Project Bank Accounts for the currently selected booking
  const activePlotId = activeBooking?.plot_id;
  const activeProjectId =
    (activeBooking as any)?.plots?.project_id ||
    (activeBooking as any)?.plots?.projects?.id;

  const { data: installmentBankAccounts = [] } = useQuery({
    queryKey: ["project_bank_accounts", activeProjectId, activePlotId],
    enabled: !!(activeProjectId || activePlotId),
    queryFn: async () => {
      let prjId = activeProjectId;
      if (!prjId && activePlotId) {
        const { data: pData } = await supabase
          .from("plots")
          .select("project_id")
          .eq("id", activePlotId)
          .maybeSingle();
        prjId = pData?.project_id;
      }
      if (!prjId) return [];

      const { data, error } = await (supabase as any)
        .from("project_bank_accounts")
        .select("*")
        .eq("project_id", prjId)
        .eq("is_active", true)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-default to primary bank account when payment.bank_account_id is empty
  useEffect(() => {
    if (installmentBankAccounts.length > 0 && !payment.bank_account_id) {
      const primaryBank = installmentBankAccounts.find((b: any) => b.is_primary) || installmentBankAccounts[0];
      if (primaryBank) {
        setPayment((curr) => ({ ...curr, bank_account_id: primaryBank.id }));
      }
    }
  }, [installmentBankAccounts, payment.bank_account_id]);

  // Modals & Dialogs
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [selectedTallyModalBooking, setSelectedTallyModalBooking] = useState<any | null>(null);

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedScheduleBooking, setSelectedScheduleBooking] = useState<any | null>(null);

  const [scheduleGateAlertBooking, setScheduleGateAlertBooking] = useState<any | null>(null);
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
    queryFn: async () =>
      ((await supabase.rpc("get_primary_role", { _user_id: user.id })).data as string) ?? "employee",
  });
  const isAdmin = role === "admin" || role === "super_admin" || role === "manager";

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["installment-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, plots(plot_number, area_sqft, project_id, projects(id, name, code))")
        .in("status", ["pending", "approved", "on_hold"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["installment-payments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("installment_payments")
        .select("*")
        .order("paid_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allSchedules = [] } = useQuery({
    queryKey: ["all-booking-schedules"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("booking_installment_schedules")
        .select("*")
        .order("installment_number", { ascending: true });
      if (error) return [];
      return data ?? [];
    },
  });

  const schedulesByBooking = useMemo(() => {
    const map = new Map<string, any[]>();
    allSchedules.forEach((item: any) =>
      map.set(item.booking_id, [...(map.get(item.booking_id) ?? []), item]),
    );
    return map;
  }, [allSchedules]);

  const paymentsByBooking = useMemo(() => {
    const map = new Map<string, any[]>();
    payments.forEach((item: any) =>
      map.set(item.booking_id, [...(map.get(item.booking_id) ?? []), item]),
    );
    return map;
  }, [payments]);

  // Projects list
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

  // Payment Recording Mutation (With Strict FIFO Sequencing & Auto-Rebalancing)
  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!activeBooking) return;
      const amountNum = Number(payment.amount);
      if (isNaN(amountNum) || amountNum <= 0) throw new Error("Please enter a valid payment amount");

      // STRICT CONSTRAINT CHECK: Must have at least 1 saved schedule
      const bookingSchedules = schedulesByBooking.get(activeBooking.id) ?? [];
      if (bookingSchedules.length === 0) {
        throw new Error("EMI Schedule Required: Please save the installment schedule before recording payments.");
      }

      const pendingSchedules = bookingSchedules.filter(
        (s: any) => s.status !== "paid" && Number(s.amount) - Number(s.paid_amount || 0) > 0,
      );

      if (pendingSchedules.length === 0) {
        throw new Error("All scheduled installments for this booking are already settled.");
      }

      // Validate payment reference format based on payment method
      if (payment.payment_method !== "Cash") {
        const valRes = validatePaymentReference(payment.payment_method, payment.reference_number);
        if (!valRes.isValid) {
          throw new Error(valRes.error || "Please provide a valid payment reference.");
        }
      }

      // 1. Insert installment payment voucher with dynamic schema fallback
      const insertPayload: any = {
        booking_id: activeBooking.id,
        amount: amountNum,
        paid_on: payment.paid_on,
        payment_method: payment.payment_method,
        reference_number: payment.reference_number || null,
        created_by: user.id,
      };
      if (payment.bank_account_id) {
        insertPayload.bank_account_id = payment.bank_account_id;
      }

      let newPaymentVoucher: any = null;
      const { data: voucherRes, error: pError } = await (supabase as any)
        .from("installment_payments")
        .insert(insertPayload)
        .select()
        .maybeSingle();

      if (pError) {
        const isRlsError = pError.message?.includes("row-level security") || pError.code === "42501";
        
        if (isRlsError) {
          console.warn("RLS restriction encountered on direct insert, attempting record_installment_payment_v2 RPC...");
          const selectedBank = installmentBankAccounts.find((b: any) => b.id === payment.bank_account_id);
          const bankRef = selectedBank ? ` [Deposit Bank: ${selectedBank.bank_name} ••••${selectedBank.account_number?.slice(-4)}]` : "";

          const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc("record_installment_payment_v2", {
            _booking_id: activeBooking.id,
            _amount: amountNum,
            _paid_on: payment.paid_on,
            _payment_method: payment.payment_method,
            _reference_number: payment.reference_number || null,
            _bank_account_id: payment.bank_account_id || null,
            _notes: bankRef ? bankRef.trim() : null,
          });

          if (!rpcErr && rpcRes && rpcRes.success) {
            newPaymentVoucher = {
              id: rpcRes.id,
              booking_id: activeBooking.id,
              amount: amountNum,
              paid_on: payment.paid_on,
              payment_method: payment.payment_method,
              reference_number: payment.reference_number,
              created_by: user.id,
            };
          } else {
            throw pError;
          }
        } else if (pError.message?.includes("bank_account_id") || pError.code === "PGRST204" || pError.message?.includes("schema cache")) {
          console.warn("installment_payments.bank_account_id column not in schema cache, using core payload fallback:", pError.message);
          const selectedBank = installmentBankAccounts.find((b: any) => b.id === payment.bank_account_id);
          const bankRef = selectedBank ? ` [Deposit Bank: ${selectedBank.bank_name} ••••${selectedBank.account_number?.slice(-4)}]` : "";

          const corePayload: any = {
            booking_id: activeBooking.id,
            amount: amountNum,
            paid_on: payment.paid_on,
            payment_method: payment.payment_method,
            reference_number: payment.reference_number ? `${payment.reference_number}${bankRef}` : bankRef ? bankRef.trim() : null,
            notes: bankRef ? bankRef.trim() : null,
            created_by: user.id,
          };

          const { data: fallbackVoucher, error: fallbackError } = await (supabase as any)
            .from("installment_payments")
            .insert(corePayload)
            .select()
            .maybeSingle();

          if (fallbackError) {
            if (fallbackError.message?.includes("row-level security") || fallbackError.code === "42501") {
              const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc("record_installment_payment_v2", {
                _booking_id: activeBooking.id,
                _amount: amountNum,
                _paid_on: payment.paid_on,
                _payment_method: payment.payment_method,
                _reference_number: payment.reference_number || null,
                _bank_account_id: payment.bank_account_id || null,
                _notes: bankRef ? bankRef.trim() : null,
              });

              if (!rpcErr && rpcRes && rpcRes.success) {
                newPaymentVoucher = {
                  id: rpcRes.id,
                  booking_id: activeBooking.id,
                  amount: amountNum,
                  paid_on: payment.paid_on,
                  payment_method: payment.payment_method,
                  reference_number: payment.reference_number,
                  created_by: user.id,
                };
              } else {
                throw fallbackError;
              }
            } else {
              throw fallbackError;
            }
          } else {
            newPaymentVoucher = fallbackVoucher;
          }
        } else {
          throw pError;
        }
      } else {
        newPaymentVoucher = voucherRes;
      }

      // 2. Full Schedule Reconciliation with Actual Payment Receipts
      const existingPayments = paymentsByBooking.get(activeBooking.id) ?? [];
      const allPayments = [...existingPayments, newPaymentVoucher || {
        amount: amountNum,
        paid_on: payment.paid_on,
        payment_method: payment.payment_method,
        reference_number: payment.reference_number,
        bank_account_id: payment.bank_account_id,
      }];
      const totalCollected = allPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const totalPrice = Number(activeBooking.total_price ?? 0);

      try {
        const reconciled = reconcileScheduleRows({
          rows: bookingSchedules,
          payments: allPayments,
          totalPrice,
          totalCollected,
          startDate: activeBooking.first_installment_due_date,
          autoRebalancePending: true,
        });

        // Replace schedules in Supabase
        await (supabase as any)
          .from("booking_installment_schedules")
          .delete()
          .eq("booking_id", activeBooking.id);

        const payload = reconciled.reconciledRows.map((r, i) => ({
          booking_id: activeBooking.id,
          installment_number: i + 1,
          due_date: r.due_date,
          amount: Number(r.amount),
          paid_amount: Number(r.paid_amount || 0),
          status: r.status || "pending",
          notes: r.notes || `Scheduled EMI #${i + 1}`,
        }));

        await (supabase as any)
          .from("booking_installment_schedules")
          .insert(payload);
      } catch (schErr) {
        console.warn("Schedule auto-allocation error:", schErr);
      }

      // 3. Update booking advance_paid & status if fully paid
      const isFullyPaid = totalCollected >= totalPrice;

      const bookingUpdate: any = {
        advance_paid: totalCollected,
      };
      if (isFullyPaid) {
        bookingUpdate.status = "approved";
      }

      const { error: bError } = await supabase
        .from("bookings")
        .update(bookingUpdate)
        .eq("id", activeBooking.id);
      if (bError) throw bError;

      // 4. Mark plot sold if fully paid
      if (isFullyPaid && activeBooking.plot_id) {
        await supabase.from("plots").update({ status: "sold" }).eq("id", activeBooking.plot_id);
      }

      // 5. Notification
      if (activeBooking.sales_executive_id) {
        const plotInfo = activeBooking.plots?.plot_number
          ? ` (Plot #${activeBooking.plots.plot_number})`
          : "";
        await (supabase as any).from("user_notifications").insert({
          user_id: activeBooking.sales_executive_id,
          title: "💳 Installment Payment Collected",
          message: `${money(amountNum)} recorded for ${activeBooking.customer_name}${plotInfo}.`,
          type: "payment_received",
          link: "/installments",
        });
      }
    },
    onSuccess: () => {
      toast.success("Installment payment recorded & schedule auto-recalculated successfully.");
      setActiveBooking(null);
      setPayment({
        amount: "",
        paid_on: new Date().toISOString().slice(0, 10),
        payment_method: "UPI",
        reference_number: "",
        bank_account_id: "",
      });
      qc.invalidateQueries();
    },
    onError: (error: any) => toast.error(error.message ?? "Could not record payment"),
  });

  // Auto-Reconcile Individual Booking Schedule Mutation
  const autoReconcileBooking = useMutation({
    mutationFn: async (bookingToReconcile: any) => {
      const bSchedules = schedulesByBooking.get(bookingToReconcile.id) ?? [];
      const bPayments = paymentsByBooking.get(bookingToReconcile.id) ?? [];
      const totalRecorded = bPayments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      const totalCollected = Math.max(Number(bookingToReconcile.advance_paid || 0), totalRecorded);
      const totalPrice = Number(bookingToReconcile.total_price || 0);

      const reconciled = reconcileScheduleRows({
        rows: bSchedules,
        payments: bPayments,
        totalPrice,
        totalCollected,
        startDate: bookingToReconcile.first_installment_due_date,
        autoRebalancePending: true,
      });

      await (supabase as any)
        .from("booking_installment_schedules")
        .delete()
        .eq("booking_id", bookingToReconcile.id);

      const payload = reconciled.reconciledRows.map((r, i) => ({
        booking_id: bookingToReconcile.id,
        installment_number: i + 1,
        due_date: r.due_date,
        amount: Number(r.amount),
        paid_amount: Number(r.paid_amount || 0),
        status: r.status || "pending",
        notes: r.notes || `Scheduled EMI #${i + 1}`,
      }));

      await (supabase as any)
        .from("booking_installment_schedules")
        .insert(payload);

      // Also synchronize advance_paid
      await supabase
        .from("bookings")
        .update({ advance_paid: totalCollected })
        .eq("id", bookingToReconcile.id);

      return { reconciled, customerName: bookingToReconcile.customer_name };
    },
    onSuccess: ({ customerName }) => {
      toast.success(`Everything is done! Schedule updated for ${customerName}.`);
      qc.invalidateQueries();
    },
    onError: (err: any) => toast.error(err.message || "Failed to auto-reconcile schedule"),
  });

  // Global Auto-Reconcile All Bookings
  const autoReconcileAllBookings = useMutation({
    mutationFn: async () => {
      let count = 0;
      for (const b of bookings) {
        const bSchedules = schedulesByBooking.get(b.id) ?? [];
        const bPayments = paymentsByBooking.get(b.id) ?? [];
        if (bSchedules.length > 0 || bPayments.length > 0) {
          const totalRecorded = bPayments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
          const totalCollected = Math.max(Number(b.advance_paid || 0), totalRecorded);
          const totalPrice = Number(b.total_price || 0);

          const reconciled = reconcileScheduleRows({
            rows: bSchedules,
            payments: bPayments,
            totalPrice,
            totalCollected,
            startDate: (b as any).first_installment_due_date || b.booking_date,
            autoRebalancePending: true,
          });

          await (supabase as any)
            .from("booking_installment_schedules")
            .delete()
            .eq("booking_id", b.id);

          const payload = reconciled.reconciledRows.map((r, i) => ({
            booking_id: b.id,
            installment_number: i + 1,
            due_date: r.due_date,
            amount: Number(r.amount),
            paid_amount: Number(r.paid_amount || 0),
            status: r.status || "pending",
            notes: r.notes || `Scheduled EMI #${i + 1}`,
          }));

          await (supabase as any)
            .from("booking_installment_schedules")
            .insert(payload);

          if (totalCollected !== Number(b.advance_paid || 0)) {
            await supabase.from("bookings").update({ advance_paid: totalCollected }).eq("id", b.id);
          }
          count++;
        }
      }
      return count;
    },
    onSuccess: () => {
      toast.success("Everything is done! All customer accounts updated.");
      qc.invalidateQueries();
    },
    onError: (err: any) => toast.error(err.message || "Failed to reconcile all schedules"),
  });

  // Gated payment trigger with Strict FIFO initialization
  const handleOpenRecordPayment = (booking: any) => {
    const bookingSchs = schedulesByBooking.get(booking.id) ?? [];

    // CONSTRAINT CHECK: If schedule does NOT exist, open constraint prompt
    if (bookingSchs.length === 0) {
      setScheduleGateAlertBooking(booking);
      return;
    }

    setActiveBooking(booking);

    const pendingSchs = bookingSchs.filter(
      (s: any) => s.status !== "paid" && Number(s.amount) - Number(s.paid_amount || 0) > 0,
    );

    const rem = Math.max(Number(booking.total_price) - Number(booking.advance_paid), 0);

    if (pendingSchs.length > 0) {
      const nextDue = pendingSchs[0]; // Strict FIFO: Earliest pending EMI
      const dueAmt = Math.round(Number(nextDue.amount) - Number(nextDue.paid_amount || 0));
      setPayment({
        amount: String(Math.min(dueAmt, rem)),
        paid_on: new Date().toISOString().slice(0, 10),
        payment_method: "UPI",
        reference_number: "",
        bank_account_id: (booking as any).bank_account_id || "",
      });
    } else {
      setPayment({
        amount: String(rem),
        paid_on: new Date().toISOString().slice(0, 10),
        payment_method: "UPI",
        reference_number: "",
        bank_account_id: (booking as any).bank_account_id || "",
      });
    }
  };

  // Overall Financial Aggregates
  const metrics = useMemo(() => {
    let collected = 0;
    let target = 0;
    let outstandingVal = 0;
    let overdueVal = 0;

    bookings.forEach((b: any) => {
      const ledger = paymentsByBooking.get(b.id) ?? [];
      const schs = schedulesByBooking.get(b.id) ?? [];
      const health = paymentHealth(b, ledger, schs);

      collected += Number(b.advance_paid || 0);
      target += Number(b.total_price || 0);
      outstandingVal += Math.max(0, Number(b.total_price || 0) - Number(b.advance_paid || 0));
      overdueVal += health.overdue;
    });

    const realizationPct = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 100;

    return {
      collected,
      target,
      outstanding: outstandingVal,
      overdue: overdueVal,
      realizationPct,
    };
  }, [bookings, paymentsByBooking, schedulesByBooking]);

  const scheduledPlansCount = bookings.filter(
    (b: any) => (schedulesByBooking.get(b.id) ?? []).length > 0,
  ).length;
  const unscheduledPlansCount = bookings.length - scheduledPlansCount;

  // Filtered Bookings List
  const filteredBookings = useMemo(() => {
    return bookings
      .filter((booking: any) => {
        const schs = schedulesByBooking.get(booking.id) ?? [];
        const ledger = paymentsByBooking.get(booking.id) ?? [];
        const health = paymentHealth(booking, ledger, schs);
        const isFullyPaid =
          Number(booking.total_price) - Number(booking.advance_paid) <= 0 ||
          health.status === "fully_paid";

        // Project filter
        if (selectedProject !== "all" && booking.plots?.projects?.id !== selectedProject) {
          return false;
        }

        // Status Filter
        const matchesFilter =
          filter === "all" ||
          (filter === "overdue" && health.overdue > 0 && !isFullyPaid) ||
          (filter === "on_track" &&
            health.status === "on_track" &&
            health.overdue <= 0 &&
            !isFullyPaid) ||
          (filter === "fully_paid" && isFullyPaid) ||
          (filter === "schedule_needed" && !health.scheduled && !isFullyPaid);

        // Search Query
        const terms = `${booking.customer_name} ${booking.customer_phone} ${booking.plots?.projects?.name ?? ""} ${booking.plots?.plot_number ?? ""} ${booking.plots?.projects?.code ?? ""}`.toLowerCase();
        return matchesFilter && terms.includes(search.trim().toLowerCase());
      })
      .sort((a: any, b: any) => {
        const remA = Math.max(0, Number(a.total_price || 0) - Number(a.advance_paid || 0));
        const remB = Math.max(0, Number(b.total_price || 0) - Number(b.advance_paid || 0));
        const healthA = paymentHealth(a, paymentsByBooking.get(a.id) ?? [], schedulesByBooking.get(a.id) ?? []);
        const healthB = paymentHealth(b, paymentsByBooking.get(b.id) ?? [], schedulesByBooking.get(b.id) ?? []);

        if (sortBy === "largest_balance") return remB - remA;
        if (sortBy === "most_overdue") return healthB.overdue - healthA.overdue;
        if (sortBy === "highest_collected") return Number(b.advance_paid || 0) - Number(a.advance_paid || 0);
        if (sortBy === "newest") {
          return new Date(b.created_at || b.booking_date).getTime() - new Date(a.created_at || a.booking_date).getTime();
        }
        if (sortBy === "name_asc") return (a.customer_name || "").localeCompare(b.customer_name || "");
        return 0;
      });
  }, [bookings, filter, search, selectedProject, sortBy, schedulesByBooking, paymentsByBooking]);

  const activeRemaining = activeBooking
    ? Math.max(Number(activeBooking.total_price) - Number(activeBooking.advance_paid), 0)
    : 0;

  const handleWhatsAppEMIInstallments = async (booking: any, health: any, ledger: any[]) => {
    const toastId = toast.loading(`Generating PDF & sending WhatsApp EMI Statement to ${booking.customer_name}...`);
    try {
      const totalPrice = Number(booking.total_price || 0);
      const advancePaid = Number(booking.advance_paid || 0);
      const totalCount = Math.max(1, Number(booking.installment_count || 12));
      const realizedCount = ledger.length;

      const schs = schedulesByBooking.get(booking.id) ?? [];
      const prjCode = (booking.plots?.projects?.code || "PRJ").toUpperCase();
      const prjName = booking.plots?.projects?.name || "Project";
      const plotNo = String(booking.plots?.plot_number || "101");
      const pendingDues = Math.max(0, totalPrice - advancePaid);

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
        govtAmount: Number(booking.govt_amount || 0),
        companyAmount: 0,
        installmentCount: schs.length || totalCount,
        scheduleRows: schs,
        recordedPayments: ledger,
      });

      const dueDateStr =
        health.nextDue instanceof Date
          ? health.nextDue.toISOString().slice(0, 10)
          : booking.first_installment_due_date || new Date().toISOString().slice(0, 10);

      const dueAmountVal =
        Number(booking.installment_amount || 0) ||
        (pendingDues > 0
          ? Math.round(pendingDues / Math.max(totalCount - realizedCount, 1))
          : 0);

      const res = await sendEMIStatementWhatsApp({
        customerName: booking.customer_name || "Customer",
        customerPhone: booking.customer_phone || "",
        unitProjectDetails: `${prjName ? prjName.slice(0, 18) : "Project"} • Plot #${plotNo}`,
        totalContractPrice: totalPrice,
        totalAmountRealized: advancePaid,
        remainingBalance: pendingDues,
        paidInstallmentsText: `${realizedCount} of ${totalCount} EMIs`,
        pendingInstallmentsText: `${Math.max(totalCount - realizedCount, 0)} EMIs remaining`,
        nextDueDate: dueDateStr,
        nextDueAmount: dueAmountVal,
        pdfDocumentUrl: pdfUrl || undefined,
        pdfFileName: `EMI_Statement_Plot_${plotNo}.pdf`,
      });

      toast.dismiss(toastId);
      if (res.success) {
        toast.success(res.message);
      } else if (res.mode === "deeplink" && res.deepLink) {
        toast.info(`📱 WhatsApp API credentials not set. Open WhatsApp Web to send:`, {
          action: {
            label: "Open WhatsApp",
            onClick: () => window.open(res.deepLink, "_blank"),
          },
        });
      } else {
        const isAuthErr = res.message?.includes("190") || res.message?.includes("Authentication");
        const displayMsg = isAuthErr
          ? "WhatsApp Meta Token Expired / Outdated in Browser. Please hard-refresh your browser page (Ctrl + Shift + R)."
          : res.message || "Failed to send WhatsApp EMI Statement";

        toast.error(`WhatsApp Meta API Error: ${displayMsg}`, {
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
    }
  };

  const exportTreasuryCSV = () => {
    if (filteredBookings.length === 0) {
      toast.error("No installment plans to export");
      return;
    }
    const headers = [
      "Customer Name",
      "Phone",
      "Project",
      "Project Code",
      "Plot Number",
      "Total Price",
      "Advance Paid",
      "Outstanding Balance",
      "Govt Valuation",
      "Schedule Status",
      "Overdue Amount",
    ];
    const rows = filteredBookings.map((b: any) => {
      const schs = schedulesByBooking.get(b.id) ?? [];
      const ledger = paymentsByBooking.get(b.id) ?? [];
      const health = paymentHealth(b, ledger, schs);
      return [
        `"${b.customer_name || ""}"`,
        `"${b.customer_phone || ""}"`,
        `"${b.plots?.projects?.name || ""}"`,
        b.plots?.projects?.code || "",
        b.plots?.plot_number || "",
        b.total_price || 0,
        b.advance_paid || 0,
        Math.max(0, Number(b.total_price || 0) - Number(b.advance_paid || 0)),
        b.govt_amount || 0,
        health.statusLabel,
        health.overdue,
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
      `installment_treasury_export_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Installment Treasury CSV exported successfully");
  };

  const getInitials = (name: string) => {
    if (!name) return "CU";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 pb-16 max-w-[1600px] mx-auto">
        {/* ========================================================================= */}
        {/* TOP HERO TREASURY COCKPIT                                                 */}
        {/* ========================================================================= */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card to-terracotta/[0.04] border border-border/80 p-6 sm:p-8 shadow-sm">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-terracotta/10 via-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-terracotta/10 text-terracotta border border-terracotta/20 shadow-2xs">
                  <WalletCards className="size-3 text-terracotta" />
                  Treasury & EMI Reconciliation Engine
                </span>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  FIFO Sequential Protocol Active
                </span>
              </div>

              <div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground font-display">
                  Installments & Collections
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">
                  Strict sequential EMI schedule progression, real-time lump-sum auto-rebalancing engine, project-wise collections, and WhatsApp statement dispatch.
                </p>
              </div>
            </div>

            {/* ACTION CONTROLS */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => {
                  const activeTarget = bookings.find((b: any) => Number(b.total_price) - Number(b.advance_paid) > 0) || bookings[0];
                  if (activeTarget) handleOpenRecordPayment(activeTarget);
                  else toast.info("No active customer deals available for payment recording.");
                }}
                className="h-9 px-4 text-xs font-extrabold gap-1.5 rounded-xl bg-terracotta hover:bg-terracotta/90 text-white shadow-xs transition-all hover:scale-101 active:scale-95"
              >
                <Plus className="size-4" />
                Record Payment
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={autoReconcileAllBookings.isPending}
                onClick={() => autoReconcileAllBookings.mutate()}
                className="h-9 px-3.5 text-xs font-bold gap-1.5 rounded-xl border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 shadow-2xs"
              >
                <Zap className="size-3.5 text-emerald-600 fill-emerald-600/20" />
                {autoReconcileAllBookings.isPending ? "Reconciling..." : "⚡ Auto-Reconcile All"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={exportTreasuryCSV}
                className="h-9 px-3.5 text-xs font-bold gap-1.5 rounded-xl border-border/90 hover:bg-muted/80 shadow-2xs"
              >
                <Download className="size-3.5 text-muted-foreground" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4 ELEVATED INTERACTIVE KPI COMMAND CARDS                                  */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Realized Collections */}
          <div className="group rounded-2xl p-5 border border-border/80 bg-card/90 backdrop-blur-md hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Total Collections
              </span>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-transform group-hover:scale-110">
                <IndianRupee className="size-4" />
              </div>
            </div>
            <div className="mt-3.5">
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                {money(metrics.collected)}
              </div>
              <div className="mt-2.5 space-y-1.5">
                <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                  <span>Collection realization</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {metrics.realizationPct}%
                  </span>
                </div>
                <Progress
                  value={metrics.realizationPct}
                  className="h-1.5 bg-muted"
                />
              </div>
            </div>
          </div>

          {/* 2. Total Outstanding */}
          <div className="group rounded-2xl p-5 border border-border/80 bg-card/90 backdrop-blur-md hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Total Outstanding
              </span>
              <div className="p-2.5 rounded-xl bg-terracotta/10 text-terracotta group-hover:scale-110 transition-transform">
                <WalletCards className="size-4" />
              </div>
            </div>
            <div className="mt-3.5">
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                {money(metrics.outstanding)}
              </div>
              <p className="text-xs text-muted-foreground mt-2 font-medium">
                Remaining customer receivables across plans
              </p>
            </div>
          </div>

          {/* 3. Overdue Alert Card */}
          <div
            onClick={() => setFilter("overdue")}
            className={`group cursor-pointer transition-all duration-300 rounded-2xl p-5 border bg-card/90 backdrop-blur-md hover:-translate-y-1 hover:shadow-lg ${
              filter === "overdue"
                ? "ring-2 ring-rose-500/50 border-rose-500 bg-rose-500/5 shadow-md"
                : metrics.overdue > 0
                  ? "border-rose-500/40 bg-rose-500/5"
                  : "border-border/80"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                Overdue Collections
              </span>
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 animate-pulse">
                <AlertTriangle className="size-4" />
              </div>
            </div>
            <div className="mt-3.5">
              <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">
                {money(metrics.overdue)}
              </div>
              <div className="text-xs text-rose-700/90 dark:text-rose-300/90 font-semibold mt-2 flex items-center justify-between">
                <span>Delayed installments</span>
                <span className="text-[11px] underline font-bold">Filter overdue →</span>
              </div>
            </div>
          </div>

          {/* 4. Schedule Compliance Status */}
          <div
            onClick={() => setFilter("schedule_needed")}
            className={`group cursor-pointer transition-all duration-300 rounded-2xl p-5 border bg-card/90 backdrop-blur-md hover:-translate-y-1 hover:shadow-lg ${
              filter === "schedule_needed"
                ? "ring-2 ring-amber-500/50 border-amber-500 bg-amber-500/5 shadow-md"
                : unscheduledPlansCount > 0
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-border/80"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                EMI Schedule Status
              </span>
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Calculator className="size-4" />
              </div>
            </div>
            <div className="mt-3.5">
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                {scheduledPlansCount}{" "}
                <span className="text-sm font-semibold text-muted-foreground">
                  / {bookings.length} Plans
                </span>
              </div>
              <div className="text-xs font-semibold mt-2 flex items-center justify-between">
                {unscheduledPlansCount > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                    ⚠️ {unscheduledPlansCount} plans need schedule
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    ✓ 100% EMI schedules active
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {((scheduledPlansCount / (bookings.length || 1)) * 100).toFixed(0)}%
                </span>
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 text-xs bg-background/50 border-border/80 focus:ring-terracotta rounded-xl"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
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
                <SelectTrigger className="w-[185px] h-10 text-xs bg-background/50 font-bold rounded-xl">
                  <ArrowUpDown className="size-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="largest_balance" className="text-xs font-medium">Largest Balance Due</SelectItem>
                  <SelectItem value="most_overdue" className="text-xs font-medium">Most Overdue Amount</SelectItem>
                  <SelectItem value="highest_collected" className="text-xs font-medium">Highest Amount Paid</SelectItem>
                  <SelectItem value="newest" className="text-xs font-medium">Newest Booking First</SelectItem>
                  <SelectItem value="name_asc" className="text-xs font-medium">Customer Name (A-Z)</SelectItem>
                </SelectContent>
              </Select>

              {(search || filter !== "all" || selectedProject !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
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
              { id: "all", label: "All Plans", count: bookings.length },
              {
                id: "on_track",
                label: "Scheduled & On Track",
                count: bookings.filter((b: any) => {
                  const schs = schedulesByBooking.get(b.id) ?? [];
                  const ledger = paymentsByBooking.get(b.id) ?? [];
                  const h = paymentHealth(b, ledger, schs);
                  const isPaid = Number(b.total_price) - Number(b.advance_paid) <= 0;
                  return !isPaid && h.status === "on_track";
                }).length,
                badgeColor: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
              },
              {
                id: "overdue",
                label: "Overdue Dues",
                count: bookings.filter((b: any) => {
                  const schs = schedulesByBooking.get(b.id) ?? [];
                  const ledger = paymentsByBooking.get(b.id) ?? [];
                  const isPaid = Number(b.total_price) - Number(b.advance_paid) <= 0;
                  return !isPaid && paymentHealth(b, ledger, schs).overdue > 0;
                }).length,
                badgeColor: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
              },
              {
                id: "schedule_needed",
                label: "Needs Schedule Setup",
                count: bookings.filter((b: any) => {
                  const schs = schedulesByBooking.get(b.id) ?? [];
                  const isPaid = Number(b.total_price) - Number(b.advance_paid) <= 0;
                  return !isPaid && schs.length === 0;
                }).length,
                badgeColor: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
              },
              {
                id: "fully_paid",
                label: "Fully Settled",
                count: bookings.filter(
                  (b: any) => Number(b.advance_paid) >= Number(b.total_price),
                ).length,
                badgeColor: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
              },
            ].map((tab) => {
              const isSelected = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id as any)}
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
        {/* CONTENT: LIST OF MASTERPIECE PAYMENT PLAN CARDS                           */}
        {/* ========================================================================= */}
        {isLoading ? (
          <div className="bg-card border border-border/80 rounded-3xl p-16 text-center text-muted-foreground space-y-4 shadow-sm">
            <RefreshCw className="size-8 animate-spin mx-auto text-terracotta" />
            <div className="space-y-1">
              <p className="font-bold text-foreground text-base">Loading Installment Plans</p>
              <p className="text-xs text-muted-foreground">Calculating EMI schedules and ledger receipts...</p>
            </div>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-card border border-border/80 rounded-3xl p-16 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
              <WalletCards className="size-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-lg text-foreground">No Matching Payment Plans</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                No installment records match your search or filter criteria. Try resetting filters.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking: any) => {
              const schs = schedulesByBooking.get(booking.id) ?? [];
              const ledger = paymentsByBooking.get(booking.id) ?? [];
              const paid = Number(booking.advance_paid);
              const total = Number(booking.total_price);
              const remaining = Math.max(total - paid, 0);
              const progress = total ? Math.min((paid / total) * 100, 100) : 0;
              const completed = remaining <= 0;
              const health = paymentHealth(booking, ledger, schs);
              const hasSavedSchedule = schs.length > 0;

              return (
                <div
                  key={booking.id}
                  className={`rounded-3xl border bg-card p-5 sm:p-6 shadow-sm hover:shadow-lg transition-all duration-300 space-y-4 ${
                    !hasSavedSchedule && !completed
                      ? "border-amber-500/40 bg-amber-500/[0.02]"
                      : health.overdue > 0
                        ? "border-rose-500/30 bg-rose-500/[0.02]"
                        : "border-border/80"
                  }`}
                >
                  {/* Top Bar: Property, Customer, Schedule Health & Action Hub */}
                  <div className="grid gap-5 lg:grid-cols-[1.1fr_1.1fr_0.8fr_auto] lg:items-center">
                    {/* 1. Property & Customer Info */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-gradient-to-br from-terracotta/20 via-amber-500/20 to-terracotta/10 text-terracotta font-extrabold text-xs flex items-center justify-center shrink-0 border border-terracotta/30 shadow-2xs">
                          {getInitials(booking.customer_name)}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-foreground text-base truncate">
                              {booking.customer_name}
                            </span>
                            {completed && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shadow-2xs">
                                <CheckCircle2 className="size-3" /> Fully Paid
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                            <span>{booking.customer_phone}</span>
                            {booking.customer_phone && (
                              <button
                                type="button"
                                onClick={(e) => handleCopyPhone(booking.id, booking.customer_phone, e)}
                                className="text-muted-foreground/60 hover:text-foreground p-0.5 rounded transition-colors"
                                title="Copy phone"
                              >
                                {copiedPhoneId === booking.id ? (
                                  <Check className="size-3 text-emerald-600" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap pt-0.5">
                        <span className="font-extrabold text-foreground">
                          {booking.plots?.projects?.name || "Project"}
                        </span>
                        {booking.plots?.projects?.code && (
                          <Badge variant="outline" className="text-[10px] font-extrabold px-1.5 py-0">
                            {booking.plots.projects.code}
                          </Badge>
                        )}
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-extrabold bg-terracotta/10 text-terracotta border border-terracotta/20 shadow-2xs">
                          Plot #{booking.plots?.plot_number ?? "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* 2. Financial Progress */}
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-3.5 space-y-2.5 shadow-2xs">
                      <div className="flex items-baseline justify-between text-xs">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-extrabold text-foreground text-sm font-mono">
                            {money(paid)}
                          </span>
                          <span className="text-[10px] uppercase font-extrabold text-muted-foreground">
                            paid ({progress.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-terracotta text-sm font-mono">
                            {money(remaining)}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground ml-1">
                            balance
                          </span>
                        </div>
                      </div>

                      {/* Wide Progress Bar */}
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden p-0.5 border border-border/40">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300 shadow-xs"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-0.5">
                        <span className="text-muted-foreground font-mono">
                          Deal: <strong>{money(total)}</strong>
                        </span>
                        {booking.govt_amount && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold text-[10px] border border-blue-500/20 shadow-2xs">
                            🏛️ Govt: {money(Number(booking.govt_amount))}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 3. Schedule Health Card */}
                    <div
                      className={`rounded-2xl border p-3.5 flex flex-col justify-between shadow-2xs ${
                        !hasSavedSchedule && !completed
                          ? "border-amber-500/30 bg-amber-500/5"
                          : health.overdue > 0
                            ? "border-rose-500/30 bg-rose-500/5"
                            : "border-emerald-500/20 bg-emerald-500/5"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-extrabold">
                          {!hasSavedSchedule && !completed ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <Sparkles className="size-3.5" /> EMI Schedule Required
                            </span>
                          ) : health.overdue > 0 ? (
                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                              <AlertTriangle className="size-3.5" /> {health.statusLabel}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="size-3.5" /> {completed ? "Fully Settled" : "Schedule Active"}
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed font-medium">
                          {!hasSavedSchedule && !completed
                            ? "Set up installment plan to enable payment recording."
                            : health.subtext}
                        </p>
                      </div>

                      {hasSavedSchedule && health.nextDue && !completed && (
                        <div className="pt-2 mt-2 border-t border-border/40 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-semibold">
                            <CalendarDays className="size-3 text-terracotta" /> Next Due:
                          </span>
                          <span className="font-extrabold text-foreground text-[11px]">
                            {health.nextDue.toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 4. SYMMETRICAL 2-TIER ACTION HUB WITH CONSTRAINT ENFORCEMENT */}
                    <div className="flex flex-col gap-2 w-[220px]">
                      {!completed && (
                        hasSavedSchedule ? (
                          /* SCHEDULE IS CONFIGURED -> UNLOCKED PRIMARY BUTTON */
                          <Button
                            onClick={() => handleOpenRecordPayment(booking)}
                            className="w-full h-8.5 text-xs font-extrabold gap-1.5 rounded-xl bg-terracotta hover:bg-terracotta/90 text-white shadow-xs transition-all hover:scale-101 active:scale-95"
                          >
                            <Plus className="size-4" />
                            Record Payment
                          </Button>
                        ) : (
                          /* NO SCHEDULE CONFIGURED -> ENFORCED CONSTRAINT ACTION */
                          <Button
                            onClick={() => {
                              setSelectedScheduleBooking(booking);
                              setScheduleModalOpen(true);
                            }}
                            className="w-full h-8.5 text-xs font-extrabold gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs animate-pulse transition-all hover:scale-101 active:scale-95"
                          >
                            <Sparkles className="size-3.5" />
                            ⚡ Generate EMI Schedule
                          </Button>
                        )
                      )}

                      {/* Secondary Symmetrical 3-Button Action Toolbar */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {/* 1. Schedule Generator / View */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedScheduleBooking(booking);
                                setScheduleModalOpen(true);
                              }}
                              className={`h-8 px-1.5 text-[11px] font-extrabold gap-1 rounded-xl shadow-2xs justify-center ${
                                hasSavedSchedule
                                  ? "border-terracotta/30 text-terracotta hover:bg-terracotta/10"
                                  : "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10"
                              }`}
                            >
                              <Calculator className="size-3.5" />
                              <span>Plan</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Configure or preview EMI schedule breakdown</p>
                          </TooltipContent>
                        </Tooltip>

                        {/* 2. Customer Ledger Statement */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedTallyModalBooking(booking);
                                setLedgerModalOpen(true);
                              }}
                              className="h-8 px-1.5 text-[11px] font-extrabold gap-1 rounded-xl border-border/80 hover:bg-muted shadow-2xs justify-center text-foreground"
                            >
                              <FileSpreadsheet className="size-3.5 text-muted-foreground" />
                              <span>Ledger</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Open full Customer Tally Ledger & vouchers sheet</p>
                          </TooltipContent>
                        </Tooltip>

                        {/* 3. WhatsApp Dispatcher */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleWhatsAppEMIInstallments(booking, health, ledger)}
                              className="h-8 px-1.5 text-[11px] font-extrabold gap-1 rounded-xl border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 shadow-2xs justify-center"
                            >
                              <MessageCircle className="size-3.5 text-emerald-600" />
                              <span>Share</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Dispatch WhatsApp EMI Statement PDF</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>

                  {/* Recorded Installment Receipts History Table */}
                  {ledger.length > 0 && (
                    <div className="pt-3 border-t border-border/60 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-muted-foreground uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                          <FileSpreadsheet className="size-3.5 text-terracotta" />
                          Payment Collection Receipts ({ledger.length} Vouchers)
                        </span>
                      </div>

                      <div className="rounded-2xl border border-border/60 overflow-hidden bg-background/50 shadow-2xs">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/40 border-b border-border/60 text-left text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider">
                              <th className="py-2.5 px-3.5">Date Paid</th>
                              <th className="py-2.5 px-3.5">Method</th>
                              <th className="py-2.5 px-3.5">Reference / UTR</th>
                              <th className="py-2.5 px-3.5 text-right">Amount Collected</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                            {ledger.map((entry: any) => {
                              return (
                                <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="py-2.5 px-3.5 font-sans text-muted-foreground whitespace-nowrap">
                                    {new Date(`${entry.paid_on}T00:00:00`).toLocaleDateString("en-IN", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </td>
                                  <td className="py-2.5 px-3.5 font-sans font-medium text-foreground">
                                    {entry.payment_method ?? "UPI"}
                                  </td>
                                  <td className="py-2.5 px-3.5 font-bold text-foreground">
                                    {entry.reference_number || `REC-${entry.id.slice(0, 6)}`}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                                    {money(Number(entry.amount))}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* CONSTRAINT GUARD DIALOG                                                   */}
        {/* ========================================================================= */}
        <Dialog
          open={!!scheduleGateAlertBooking}
          onOpenChange={(open) => !open && setScheduleGateAlertBooking(null)}
        >
          <DialogContent className="max-w-md p-6 space-y-4 rounded-3xl shadow-2xl">
            <DialogHeader className="space-y-2 text-center items-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-2xs">
                <ShieldAlert className="size-7" />
              </div>
              <DialogTitle className="text-xl font-extrabold text-foreground font-display">
                EMI Schedule Required First
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed font-medium">
                Before recording installment payments for <strong>{scheduleGateAlertBooking?.customer_name}</strong> (Plot #{scheduleGateAlertBooking?.plots?.plot_number}), you must configure and save their structured EMI payment schedule.
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 text-xs space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-muted-foreground">Contract Price:</span>
                <span className="text-foreground font-mono font-bold">{money(scheduleGateAlertBooking?.total_price)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span className="text-muted-foreground">Advance Paid:</span>
                <span className="text-emerald-600 font-mono font-extrabold">{money(scheduleGateAlertBooking?.advance_paid)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold border-t pt-2">
                <span className="text-muted-foreground">Outstanding Balance:</span>
                <span className="text-terracotta font-mono font-extrabold">
                  {money(
                    Math.max(
                      0,
                      Number(scheduleGateAlertBooking?.total_price || 0) -
                        Number(scheduleGateAlertBooking?.advance_paid || 0),
                    ),
                  )}
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScheduleGateAlertBooking(null)}
                className="rounded-xl font-bold"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const b = scheduleGateAlertBooking;
                  setScheduleGateAlertBooking(null);
                  setSelectedScheduleBooking(b);
                  setScheduleModalOpen(true);
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold gap-1.5 shadow-xs rounded-xl"
              >
                <Sparkles className="size-4" />
                Configure EMI Schedule Now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* RE-ENGINEERED RECORD INSTALLMENT PAYMENT DIALOG (STRICT FIFO & REBALANCE) */}
        {/* ========================================================================= */}
        <Dialog open={!!activeBooking} onOpenChange={(open) => !open && setActiveBooking(null)}>
          <DialogContent className="w-[96vw] max-w-3xl max-h-[92vh] overflow-y-auto p-6 sm:p-7 shadow-2xl rounded-3xl">
            <DialogHeader className="pb-3 border-b">
              <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold text-foreground font-display">
                <Plus className="size-6 text-terracotta" /> Record Installment Payment
              </DialogTitle>
              <DialogDescription className="text-xs mt-1 font-medium">
                Customer: <strong>{activeBooking?.customer_name}</strong> · Plot{" "}
                <strong>#{activeBooking?.plots?.plot_number}</strong> ({activeBooking?.plots?.projects?.name})
              </DialogDescription>
            </DialogHeader>

            {activeBooking && (() => {
              const bookingSchedules = schedulesByBooking.get(activeBooking.id) ?? [];
              const paidSchedules = bookingSchedules.filter(
                (s: any) => s.status === "paid" || Number(s.paid_amount || 0) >= Number(s.amount),
              );
              const pendingSchedules = bookingSchedules.filter(
                (s: any) => s.status !== "paid" && Number(s.amount) - Number(s.paid_amount || 0) > 0,
              );

              const nextDueSchedule = pendingSchedules[0]; // Strict FIFO: Must be earliest unpaid EMI
              const currentDueAmount = nextDueSchedule
                ? Math.round(Number(nextDueSchedule.amount) - Number(nextDueSchedule.paid_amount || 0))
                : 0;

              const enteredAmountNum = Number(payment.amount.replace(/[^0-9]/g, "")) || 0;
              const isExcess = enteredAmountNum > currentDueAmount;
              const excessAmount = Math.max(0, enteredAmountNum - currentDueAmount);

              // Auto-Rebalancing Calculation:
              // If buyer pays excess, remaining balance is recalculated & divided equally among remaining future EMIs
              const futureUnpaidSchedules = pendingSchedules.slice(1);
              const newRemainingAfterPayment = Math.max(0, activeRemaining - enteredAmountNum);
              const rebalancedMonthlyEMI =
                futureUnpaidSchedules.length > 0
                  ? Math.round(newRemainingAfterPayment / futureUnpaidSchedules.length)
                  : 0;
              const originalFutureEMI =
                futureUnpaidSchedules.length > 0 ? Number(futureUnpaidSchedules[0].amount || 0) : 0;
              const monthlySavings = Math.max(0, originalFutureEMI - rebalancedMonthlyEMI);

              return (
                <div className="space-y-5 pt-2">
                  {/* Top Balance Summary Card */}
                  <div className="rounded-3xl border border-terracotta/20 bg-terracotta/[0.08] p-5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-extrabold">
                          Remaining Total Due
                        </p>
                        <p className="text-3xl font-extrabold text-foreground font-mono mt-0.5">
                          {money(activeRemaining)}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-2xs">
                        <Sparkles className="size-3.5" /> {paidSchedules.length} of {bookingSchedules.length} EMIs Settled
                      </span>
                    </div>

                    <div className="pt-2 border-t border-terracotta/20 flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span>Total Agreement: <strong className="text-foreground">{money(Number(activeBooking.total_price))}</strong></span>
                      <span>Total Paid: <strong className="text-emerald-600">{money(Number(activeBooking.advance_paid))}</strong></span>
                    </div>
                  </div>

                  {/* STRICT SEQUENTIAL ACTIVE EMI DISPLAY */}
                  {nextDueSchedule && (
                    <div className="p-4 rounded-3xl border border-terracotta/30 bg-terracotta/5 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="size-7 rounded-full bg-terracotta text-white text-xs font-extrabold flex items-center justify-center shadow-xs">
                            #{nextDueSchedule.installment_number}
                          </span>
                          <div>
                            <span className="font-extrabold text-foreground text-sm block">
                              Immediate Active Installment: EMI #{nextDueSchedule.installment_number}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-medium">
                              Due Date:{" "}
                              {new Date(`${nextDueSchedule.due_date}T00:00:00`).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                            Installment Due
                          </span>
                          <span className="text-lg font-extrabold text-terracotta font-mono">
                            {money(currentDueAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Sequential Lock Guidance */}
                      <div className="pt-2 border-t border-terracotta/20 flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                        <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="size-3.5" />
                          Strict FIFO: EMI #{nextDueSchedule.installment_number} must be settled first
                        </span>
                        <span>
                          {futureUnpaidSchedules.length} future EMIs queued
                        </span>
                      </div>
                    </div>
                  )}

                  {/* DYNAMIC LUMPSUM AUTO-REBALANCING SIMULATION BOX (TRIGGERS AUTOMATICALLY ON MANUAL EXCESS ENTRY) */}
                  {isExcess && futureUnpaidSchedules.length > 0 && (
                    <div className="p-4.5 rounded-3xl border border-blue-500/30 bg-blue-500/[0.06] space-y-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400">
                            <Calculator className="size-4" />
                          </span>
                          <div>
                            <span className="text-xs font-extrabold text-foreground block">
                              Smart Prepayment Auto-Rebalancing Active
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              Paying {money(excessAmount)} extra: automatically divided across {futureUnpaidSchedules.length} future installments
                            </span>
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-500/30">
                          <TrendingDown className="size-3" /> Auto-Dividing
                        </span>
                      </div>

                      {/* Rebalancing Metric Comparison */}
                      <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                        <div className="p-3 rounded-2xl bg-background/80 border border-border/80">
                          <span className="text-muted-foreground text-[10px] uppercase font-bold block">
                            Old Monthly EMI
                          </span>
                          <span className="text-sm font-bold text-muted-foreground line-through font-mono">
                            {money(originalFutureEMI)} / mo
                          </span>
                          <span className="text-[10px] text-muted-foreground block mt-0.5">
                            Across {futureUnpaidSchedules.length} remaining EMIs
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-2xs">
                          <span className="text-emerald-700 dark:text-emerald-300 text-[10px] uppercase font-extrabold block">
                            ✨ New Reduced Monthly EMI
                          </span>
                          <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">
                            {money(rebalancedMonthlyEMI)} / mo
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 block mt-0.5">
                            Saves {money(monthlySavings)} / mo for customer!
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Form Inputs Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <Field label="Amount received (₹)">
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-sm font-bold text-muted-foreground">₹</span>
                        <Input
                          type="text"
                          placeholder="e.g. 3,00,000"
                          value={
                            payment.amount
                              ? (
                                  Number(payment.amount.replace(/[^0-9]/g, "")) || 0
                                ).toLocaleString("en-IN")
                              : ""
                          }
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const rawDigits = e.target.value.replace(/[^0-9]/g, "");
                            setPayment({ ...payment, amount: rawDigits });
                          }}
                          className="pl-7 font-mono font-extrabold text-base h-11 rounded-xl w-full"
                        />
                      </div>
                    </Field>

                    <Field label="Received on">
                      <Input
                        type="date"
                        className="h-11 text-xs font-bold rounded-xl w-full"
                        value={payment.paid_on}
                        onChange={(e) => setPayment({ ...payment, paid_on: e.target.value })}
                      />
                    </Field>

                    <Field label="Payment method">
                      <Select
                        value={payment.payment_method}
                        onValueChange={(value) =>
                          setPayment({ ...payment, payment_method: value })
                        }
                      >
                        <SelectTrigger className="h-11 text-xs font-bold rounded-xl w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="UPI">UPI</SelectItem>
                          <SelectItem value="Bank transfer">Bank transfer</SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label={payment.payment_method === "Cash" ? "Receipt Vault" : "Deposit To Bank Account"}>
                      {payment.payment_method === "Cash" ? (
                        <div className="flex items-center gap-2 px-3 h-11 bg-muted/40 rounded-xl border text-xs font-semibold text-foreground">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            Cash-in-Hand
                          </span>
                          <span>Company Cash Vault</span>
                        </div>
                      ) : (
                        <Select
                          value={payment.bank_account_id || (installmentBankAccounts[0]?.id ?? "default_project_account")}
                          onValueChange={(val) =>
                            setPayment({
                              ...payment,
                              bank_account_id: val === "default_project_account" ? "" : val,
                            })
                          }
                        >
                          <SelectTrigger className="h-11 text-xs font-semibold rounded-xl w-full">
                            <SelectValue placeholder="Choose project bank account..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {installmentBankAccounts.length > 0 ? (
                              installmentBankAccounts.map((acc: any) => (
                                <SelectItem key={acc.id} value={acc.id}>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="font-bold">{acc.bank_name}</span>
                                    <span className="font-mono text-muted-foreground">
                                      ••••{acc.account_number?.slice(-4) || "0000"}
                                    </span>
                                    {acc.ifsc_code && (
                                      <span className="font-mono text-[10px] text-muted-foreground/80">
                                        ({acc.ifsc_code})
                                      </span>
                                    )}
                                    {acc.is_primary && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                        Primary
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="default_project_account">
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="font-bold text-foreground">
                                    {(activeBooking as any)?.plots?.projects?.name || "Project"} Collection Bank A/c
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                                    Project Default
                                  </span>
                                </div>
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </Field>

                    <div className="sm:col-span-2">
                      <Field
                        label={
                          payment.payment_method === "Cheque"
                            ? "Cheque Number (6 Digits) & Issuing Bank"
                            : payment.payment_method === "Cash"
                            ? "Cash Receipt / Voucher Ref Number"
                            : payment.payment_method === "Bank transfer"
                            ? "Bank UTR / NEFT Reference Number"
                            : "UPI Transaction ID / 12-Digit Reference Number"
                        }
                      >
                        <PaymentReferenceInput
                          method={payment.payment_method}
                          value={payment.reference_number}
                          onChange={(val) =>
                            setPayment({ ...payment, reference_number: val })
                          }
                        />
                      </Field>
                    </div>
                  </div>

                  {/* Confirmation Button */}
                  <Button
                    disabled={
                      recordPayment.isPending ||
                      Number(payment.amount) <= 0 ||
                      Number(payment.amount) > activeRemaining
                    }
                    onClick={() => recordPayment.mutate()}
                    className="w-full bg-terracotta hover:bg-terracotta/90 text-white text-base font-extrabold h-12 mt-2 shadow-lg rounded-2xl transition-all hover:scale-101 active:scale-95"
                  >
                    {recordPayment.isPending
                      ? "Recording Payment..."
                      : isExcess && futureUnpaidSchedules.length > 0
                        ? `Confirm Payment of ${money(enteredAmountNum)} & Rebalance Future EMIs to ${money(rebalancedMonthlyEMI)}/mo`
                        : `Confirm Payment of ${money(enteredAmountNum)}`}
                  </Button>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* EMI & Payment Schedule Planner Dialog */}
        <EMIScheduleGeneratorDialog
          booking={selectedScheduleBooking}
          open={scheduleModalOpen}
          onOpenChange={setScheduleModalOpen}
          onSuccess={() => {
            qc.invalidateQueries();
          }}
        />

        {/* Customer Tally Ledger Breakdown Modal */}
        <CustomerTallyLedgerModal
          booking={selectedTallyModalBooking}
          open={ledgerModalOpen}
          onOpenChange={setLedgerModalOpen}
        />
      </div>
    </TooltipProvider>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 flex flex-col justify-end w-full">
      <Label className="text-[10px] sm:text-[11px] text-muted-foreground font-extrabold uppercase tracking-wider h-4 flex items-center whitespace-nowrap truncate">
        {label}
      </Label>
      <div className="w-full">{children}</div>
    </div>
  );
}
