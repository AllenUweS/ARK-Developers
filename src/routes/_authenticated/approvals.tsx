import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { postToTallyServerFn, syncBookingToTally, syncPaymentToTally } from "@/lib/tallySync";
import {
  sanitizePhoneInput,
  getPhoneValidationError,
  toE164Phone,
  sanitizeAadhaarNumber,
  sanitizePanNumber,
  getAadhaarValidationError,
  getPanValidationError,
} from "@/lib/formValidation";
import { PhoneInput } from "@/components/ui/phone-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { AadhaarInput } from "@/components/ui/aadhaar-input";
import { PanInput } from "@/components/ui/pan-input";
import {
  CheckCircle2,
  Clock,
  ShieldAlert,
  Landmark,
  FileCheck,
  Sparkles,
  ArrowRight,
  XCircle,
  Building2,
  IndianRupee,
  Phone,
  Loader2,
  History,
  ShieldCheck,
  Lock,
  UserCheck,
  Pencil,
  FileEdit,
  User,
  AlertCircle,
  Eye,
  Filter,
  Printer,
} from "lucide-react";
import { BookingPrintForm } from "@/components/bookings/BookingPrintForm";
import { PaymentReferenceInput, validatePaymentReference } from "@/components/ui/payment-reference-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: ApprovalsWorkspace,
});

type ApprovalStage = "sales_head_approval" | "admin_approval" | "crm_verification" | "accounts_payment" | "completed";

interface BookingApprovalRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_address: string | null;
  aadhaar_number: string | null;
  pan_number: string | null;
  total_price: number;
  advance_paid: number;
  booking_amount: number;
  incentive_amount?: number | null;
  agreed_incentive_amount?: number | null;
  external_bdo_name?: string | null;
  attribution_type?: string | null;
  installment_count?: number | null;
  first_installment_due_date?: string | null;
  payment_method: string | null;
  approval_stage: ApprovalStage | null;
  approval_history: any[] | null;
  status: string;
  created_at: string;
  remarks: string | null;
  plot_id: string;
  sales_executive_id: string | null;
  created_by: string | null;
  plots?: {
    plot_number: string;
    price?: number | null;
    projects?: {
      name: string;
      code: string;
    };
  };
  executive?: {
    full_name: string | null;
    email: string | null;
  };
}

const STAGES: { id: ApprovalStage; label: string; department: string; requiredRole: string; icon: any; color: string }[] = [
  { id: "sales_head_approval", label: "Sales Head Review", department: "Sales Department", requiredRole: "Sales Head (Manager)", icon: ShieldAlert, color: "from-amber-500 to-orange-500" },
  { id: "admin_approval", label: "Admin Pricing Approval", department: "Executive Admin", requiredRole: "Admin / Management", icon: Building2, color: "from-orange-600 to-red-600" },
  { id: "crm_verification", label: "CRM Document Verification", department: "CRM Department", requiredRole: "CRM Department", icon: FileCheck, color: "from-blue-600 to-indigo-600" },
  { id: "accounts_payment", label: "Accounts Payment & EMI", department: "Accounts Department", requiredRole: "Accounts Department", icon: Landmark, color: "from-emerald-600 to-teal-600" },
  { id: "completed", label: "Booking Finalized & Site Booked", department: "Confirmed Deal", requiredRole: "Completed", icon: CheckCircle2, color: "from-green-600 to-emerald-700" },
];

function money(val: number) {
  return `₹${Number(val || 0).toLocaleString("en-IN")}`;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ApprovalsWorkspace() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"action_required" | "all" | "history">("all");
  const [selectedBooking, setSelectedBooking] = useState<BookingApprovalRow | null>(null);
  const [actionModalType, setActionModalType] = useState<ApprovalStage | "reject" | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [printBooking, setPrintBooking] = useState<any | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  // CRM & Accounts Stage Form States
  const [crmForm, setCrmForm] = useState({ aadhaar: "", pan: "", address: "" });
  const [accountsForm, setAccountsForm] = useState({
    paymentMethod: "UPI",
    advancePaid: "",
    transactionRef: "",
    bankAccountId: "",
  });

  // Editable deal parameters inside approval modal
  const [showEditSection, setShowEditSection] = useState(false);
  const [editForm, setEditForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    customerAddress: "",
    totalPrice: "",
    advancePaid: "",
    incentiveAmount: "",
    externalBdoName: "",
    paymentMethod: "UPI",
    aadhaar: "",
    pan: "",
    remarks: "",
  });

  // Fetch Project Bank Accounts for the currently selected booking
  const selectedPlotId = selectedBooking?.plot_id;
  const selectedProjectId =
    (selectedBooking as any)?.plots?.project_id ||
    (selectedBooking as any)?.plots?.projects?.id;

  const { data: projectBankAccounts = [] } = useQuery({
    queryKey: ["project_bank_accounts", selectedProjectId, selectedPlotId],
    enabled: !!(selectedProjectId || selectedPlotId),
    queryFn: async () => {
      let prjId = selectedProjectId;
      if (!prjId && selectedPlotId) {
        const { data: pData } = await supabase
          .from("plots")
          .select("project_id")
          .eq("id", selectedPlotId)
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

  // Auto-default to primary bank account when accountsForm.bankAccountId is empty
  useEffect(() => {
    if (projectBankAccounts.length > 0 && !accountsForm.bankAccountId) {
      const primaryBank = projectBankAccounts.find((b: any) => b.is_primary) || projectBankAccounts[0];
      if (primaryBank) {
        setAccountsForm((curr) => ({ ...curr, bankAccountId: primaryBank.id }));
      }
    }
  }, [projectBankAccounts, accountsForm.bankAccountId]);

  // Get User Role from DB (with smart fallback based on user profile/email)
  const { data: userRole = "employee" } = useQuery({
    queryKey: ["user_role", user.id, user.email],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: user.id });
      let role = (data as string) ?? "employee";

      // If DB role is still default 'employee', check user email/name for role intent
      if (role === "employee" && user?.email) {
        const lower = user.email.toLowerCase();
        if (lower.includes("account")) return "accounts";
        if (lower.includes("crm")) return "crm";
        if (lower.includes("manager") || lower.includes("saleshead")) return "manager";
        if (lower.includes("admin")) return "admin";
      }

      return role;
    },
  });

  const isAdmin = userRole === "admin" || userRole === "super_admin" || userRole === "management";
  const isSalesHead = userRole === "manager" || isAdmin;
  const isCRM = userRole === "crm" || isAdmin;
  const isAccounts = userRole === "accounts" || isAdmin;
  const isExecutive = userRole === "employee" && !isSalesHead && !isCRM && !isAccounts;

  // Check stage permission for logged user
  const checkStagePermission = (stageId: ApprovalStage) => {
    if (isAdmin) return { allowed: true, roleLabel: "Executive Admin" };

    switch (stageId) {
      case "sales_head_approval":
        return { allowed: userRole === "manager", roleLabel: "Sales Head (Manager)" };
      case "admin_approval":
        return { allowed: isAdmin, roleLabel: "Executive Admin" };
      case "crm_verification":
        return { allowed: userRole === "crm", roleLabel: "CRM Department" };
      case "accounts_payment":
        return { allowed: userRole === "accounts", roleLabel: "Accounts Department" };
      default:
        return { allowed: false, roleLabel: "Completed" };
    }
  };

  // Stage active for department queue filtering
  const getRoleStage = (): ApprovalStage | "all" => {
    if (userRole === "manager") return "sales_head_approval";
    if (userRole === "crm") return "crm_verification";
    if (userRole === "accounts") return "accounts_payment";
    if (isAdmin) return "all";
    return "sales_head_approval";
  };

  // Fetch Bookings with Scoping:
  // - Executive: Only their own submitted bookings
  // - Managers / Higher Roles: ALL company pipeline bookings
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["approvals_list", user.id, userRole],
    queryFn: async () => {
      let query = supabase
        .from("bookings")
        .select(`
          *,
          plots(id, plot_number, price, project_id, projects(id, name, code))
        `)
        .order("created_at", { ascending: false });

      // Executive Hierarchy Filter: View ONLY their own created/sales executive bookings
      if (isExecutive) {
        query = query.or(`sales_executive_id.eq.${user.id},created_by.eq.${user.id}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Deduplicate multiple submissions for the same plot, keeping only the latest active booking
      const seenPlots = new Set<string>();
      const deduplicated: any[] = [];
      
      for (const b of (data || [])) {
        if (b.plot_id && b.status !== "cancelled" && b.status !== "rejected") {
          const key = `${b.plot_id}_${(b.customer_name || "").toLowerCase().trim()}`;
          if (seenPlots.has(key)) {
            continue;
          }
          seenPlots.add(key);
        }
        deduplicated.push(b);
      }

      // Fetch executive profile details
      const executiveIds = Array.from(new Set(deduplicated.map((b: any) => b.sales_executive_id).filter(Boolean)));
      let profileMap = new Map();
      if (executiveIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", executiveIds as string[]);
        (profiles || []).forEach((p) => profileMap.set(p.id, p));
      }

      return deduplicated.map((b: any) => ({
        ...b,
        executive: profileMap.get(b.sales_executive_id),
      })) as BookingApprovalRow[];
    },
  });

  // Filter Bookings by Active Tab
  const roleStage = getRoleStage();
  
  const pendingQueue = bookings.filter((b) => {
    const stage = b.approval_stage || "sales_head_approval";
    if (stage === "completed" || b.status === "rejected" || b.status === "cancelled") return false;

    if (activeTab === "action_required") {
      if (roleStage === "all") return true;
      if (isExecutive) return true; // Executives view all active deals in their pipeline
      return stage === roleStage;
    }
    return true; // All active tab
  });

  const historyQueue = bookings.filter((b) => b.approval_stage === "completed" || b.status === "approved" || b.status === "sold");

  // Open modal & populate edit fields
  const openApprovalModal = (booking: BookingApprovalRow) => {
    setSelectedBooking(booking);
    const stage = booking.approval_stage || "sales_head_approval";
    setActionModalType(stage);
    setApprovalNotes("");
    setShowEditSection(false);

    setCrmForm({
      aadhaar: booking.aadhaar_number || "",
      pan: booking.pan_number || "",
      address: booking.customer_address || "",
    });

    setAccountsForm({
      paymentMethod: booking.payment_method || "UPI",
      advancePaid: String(booking.advance_paid || booking.booking_amount || ""),
      transactionRef: "",
      bankAccountId: (booking as any).bank_account_id || "",
    });

    setEditForm({
      customerName: booking.customer_name || "",
      customerPhone: booking.customer_phone || "",
      customerEmail: booking.customer_email || "",
      customerAddress: booking.customer_address || "",
      totalPrice: String(booking.total_price || ""),
      advancePaid: String(booking.advance_paid || booking.booking_amount || ""),
      incentiveAmount: String(booking.agreed_incentive_amount ?? booking.incentive_amount ?? ""),
      externalBdoName: booking.external_bdo_name || "",
      paymentMethod: booking.payment_method || "UPI",
      aadhaar: booking.aadhaar_number || "",
      pan: booking.pan_number || "",
      remarks: booking.remarks || "",
    });
  };

  // Handle Approval Stage Advancement with Parameter Diff Tracking
  const handleAdvanceApproval = async (nextStage: ApprovalStage, actionLabel: string) => {
    if (!selectedBooking) return;
    try {
      setActionLoading(true);

      const isFinalStep = nextStage === "completed";
      const newStatus = isFinalStep ? "approved" : selectedBooking.status;

      // 🔍 DETECT & RECORD EXACT PARAMETER CHANGES
      const changeLogs: string[] = [];

      if (editForm.customerName && editForm.customerName !== selectedBooking.customer_name) {
        changeLogs.push(`Customer Name updated from "${selectedBooking.customer_name}" to "${editForm.customerName}"`);
      }
      if (editForm.customerPhone && editForm.customerPhone !== selectedBooking.customer_phone) {
        const phoneErr = getPhoneValidationError(editForm.customerPhone);
        if (phoneErr) {
          toast.error(`Invalid Customer Phone: ${phoneErr}`);
          setActionLoading(false);
          return;
        }
        changeLogs.push(`Phone updated from "${selectedBooking.customer_phone}" to "${editForm.customerPhone}"`);
      }
      if (editForm.totalPrice && Number(editForm.totalPrice) !== selectedBooking.total_price) {
        changeLogs.push(`Agreed Price modified from ${money(selectedBooking.total_price)} to ${money(Number(editForm.totalPrice))}`);
      }
      if (editForm.advancePaid && Number(editForm.advancePaid) !== selectedBooking.advance_paid) {
        changeLogs.push(`Advance Paid adjusted from ${money(selectedBooking.advance_paid)} to ${money(Number(editForm.advancePaid))}`);
      }
      if (editForm.incentiveAmount !== undefined && editForm.incentiveAmount !== "" && Number(editForm.incentiveAmount) !== Number(selectedBooking.agreed_incentive_amount ?? selectedBooking.incentive_amount ?? 0)) {
        changeLogs.push(`Agreed Incentive modified to ${money(Number(editForm.incentiveAmount))}`);
      }
      if (editForm.externalBdoName && editForm.externalBdoName !== selectedBooking.external_bdo_name) {
        changeLogs.push(`External Partner Name updated to "${editForm.externalBdoName}"`);
      }
      if (editForm.paymentMethod && editForm.paymentMethod !== selectedBooking.payment_method) {
        changeLogs.push(`Payment Method changed from "${selectedBooking.payment_method || 'N/A'}" to "${editForm.paymentMethod}"`);
      }
      if (editForm.aadhaar && editForm.aadhaar !== selectedBooking.aadhaar_number) {
        const cleanAadh = sanitizeAadhaarNumber(editForm.aadhaar);
        const aadhErr = getAadhaarValidationError(cleanAadh, false);
        if (aadhErr) {
          toast.error(`Invalid Aadhaar: ${aadhErr}`);
          setActionLoading(false);
          return;
        }
        changeLogs.push(`Aadhaar updated to ${cleanAadh}`);
      }
      if (editForm.pan && editForm.pan !== selectedBooking.pan_number) {
        const cleanPan = sanitizePanNumber(editForm.pan);
        const panErr = getPanValidationError(cleanPan, false);
        if (panErr) {
          toast.error(`Invalid PAN: ${panErr}`);
          setActionLoading(false);
          return;
        }
        changeLogs.push(`PAN updated to ${cleanPan}`);
      }
      if (editForm.customerAddress && editForm.customerAddress !== selectedBooking.customer_address) {
        changeLogs.push(`Address updated to "${editForm.customerAddress}"`);
      }

      // Validate payment reference in accounts approval stage
      if (selectedBooking.approval_stage === "accounts_payment") {
        const method = accountsForm.paymentMethod || editForm.paymentMethod || "UPI";
        const ref = accountsForm.transactionRef || "";
        const finalAdvAmount = editForm.advancePaid ? Number(editForm.advancePaid) : (selectedBooking.advance_paid || selectedBooking.booking_amount || 0);

        if (finalAdvAmount > 0) {
          const valRes = validatePaymentReference(method, ref);
          if (!valRes.isValid) {
            toast.error(valRes.error || "Please provide a valid payment reference number.");
            setActionLoading(false);
            return;
          }
        }
      }

      const isAccounts = selectedBooking.approval_stage === "accounts_payment";
      const chosenBank = projectBankAccounts.find((b: any) => b.id === accountsForm.bankAccountId);

      const currentHistory = Array.isArray(selectedBooking.approval_history) ? selectedBooking.approval_history : [];
      const updatedHistory = [
        ...currentHistory,
        {
          stage: selectedBooking.approval_stage || "sales_head_approval",
          action: actionLabel,
          next_stage: nextStage,
          timestamp: new Date().toISOString(),
          actor_id: user.id,
          actor_role: userRole,
          notes: approvalNotes || `Approved & forwarded by ${userRole.toUpperCase()}`,
          changes_made: changeLogs,
          bank_account_id: isAccounts ? (accountsForm.bankAccountId || null) : null,
          bank_name: isAccounts ? (chosenBank?.bank_name || null) : null,
          bank_account_number: isAccounts ? (chosenBank?.account_number || null) : null,
          payment_method: isAccounts ? (accountsForm.paymentMethod || editForm.paymentMethod || "UPI") : undefined,
          transaction_ref: isAccounts ? (accountsForm.transactionRef || null) : undefined,
        },
      ];

      const finalTot = editForm.totalPrice ? Number(editForm.totalPrice) : selectedBooking.total_price;
      const finalAdv = editForm.advancePaid ? Number(editForm.advancePaid) : (selectedBooking.advance_paid || selectedBooking.booking_amount);
      const finalInc = editForm.incentiveAmount !== undefined && editForm.incentiveAmount !== "" ? Number(editForm.incentiveAmount) : (selectedBooking.agreed_incentive_amount ?? selectedBooking.incentive_amount);

      const updateData: Record<string, any> = {
        approval_stage: nextStage,
        approval_history: updatedHistory,
        status: newStatus,

        // Apply updated form fields directly across all interconnected modules
        customer_name: editForm.customerName || selectedBooking.customer_name,
        customer_phone: editForm.customerPhone || selectedBooking.customer_phone,
        customer_email: editForm.customerEmail || selectedBooking.customer_email,
        customer_address: editForm.customerAddress || selectedBooking.customer_address,
        total_price: finalTot,
        advance_paid: finalAdv,
        booking_amount: finalAdv,
        incentive_amount: finalInc,
        agreed_incentive_amount: finalInc,
        payment_method: (isAccounts && accountsForm.paymentMethod) || editForm.paymentMethod || selectedBooking.payment_method,
        aadhaar_number: editForm.aadhaar || selectedBooking.aadhaar_number,
        pan_number: editForm.pan || selectedBooking.pan_number,
        remarks: editForm.remarks || selectedBooking.remarks,
      };

      if (editForm.externalBdoName && editForm.externalBdoName.trim()) {
        updateData.external_bdo_name = editForm.externalBdoName.trim();
        updateData.attribution_type = "manual_external";
      }

      if (selectedBooking.approval_stage === "accounts_payment") {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user.id;
      }

      const { error } = await (supabase as any).from("bookings").update(updateData).eq("id", selectedBooking.id);
      if (error) throw error;

      // 🏆 CRITICAL: ONLY WHEN ACCOUNTS / FINAL PAYMENT IS CONFIRMED -> SITE GETS BOOKED & EMI RECALCULATED!
      if (isFinalStep && selectedBooking.plot_id) {
        const { error: plotErr } = await supabase.from("plots").update({ status: "booked" }).eq("id", selectedBooking.plot_id);
        if (plotErr) console.error("Failed to update plot status:", plotErr);

        // Recalculate EMI Installment Schedule based on net balance (total_price - advance_paid)
        try {
          const finalBal = Math.max(0, finalTot - finalAdv);
          const count = selectedBooking.installment_count || 12;
          const perInst = Math.round(finalBal / count);

          await (supabase as any)
            .from("booking_installment_schedules")
            .delete()
            .eq("booking_id", selectedBooking.id)
            .eq("status", "pending");

          const newSchedules: any[] = [];
          const firstDate = selectedBooking.first_installment_due_date ? new Date(selectedBooking.first_installment_due_date) : new Date();

          for (let i = 0; i < count; i++) {
            const d = new Date(firstDate);
            d.setMonth(d.getMonth() + i);
            newSchedules.push({
              booking_id: selectedBooking.id,
              installment_number: i + 1,
              due_date: d.toISOString().split("T")[0],
              amount: perInst,
              notes: `Scheduled EMI #${i + 1}`,
              status: "pending",
            });
          }
          if (newSchedules.length > 0) {
            await (supabase as any).from("booking_installment_schedules").insert(newSchedules);
          }
        } catch (recalcErr) {
          console.warn("EMI recalculation warning:", recalcErr);
        }

        // Attempt Tally Prime posting on Port 9000 (Sales Invoice + Receipt Voucher with selected Bank Ledger)
        try {
          const selectedBank = projectBankAccounts.find((b: any) => b.id === accountsForm.bankAccountId);
          const prjName = (selectedBooking as any).plots?.projects?.name || "Project";
          const prjCode = ((selectedBooking as any).plots?.projects?.code || "PRJ").toUpperCase();
          const plotNo = String((selectedBooking as any).plots?.plot_number || "101");
          const bkgRef = `BKG-${prjCode}-${plotNo}`;

          // 1. Sync Sales Voucher
          await syncBookingToTally({
            customerName: editForm.customerName || selectedBooking.customer_name,
            customerPhone: (editForm.customerPhone || selectedBooking.customer_phone) || undefined,
            customerAddress: (editForm.customerAddress || selectedBooking.customer_address) || undefined,
            plotNumber: plotNo,
            projectName: prjName,
            projectCode: prjCode,
            totalPrice: finalTot,
            bookingRef: bkgRef,
          });

          // 2. Sync Advance Payment Receipt Voucher
          if (finalAdv > 0) {
            await syncPaymentToTally({
              customerName: editForm.customerName || selectedBooking.customer_name,
              customerPhone: (editForm.customerPhone || selectedBooking.customer_phone) || undefined,
              plotNumber: plotNo,
              projectName: prjName,
              projectCode: prjCode,
              amount: finalAdv,
              paymentMode: accountsForm.paymentMethod || editForm.paymentMethod,
              paymentDate: new Date().toISOString().slice(0, 10),
              paymentRef: accountsForm.transactionRef || `REC-${prjCode}-${plotNo}-ADV`,
              bankName: selectedBank?.bank_name || undefined,
              accountNumber: selectedBank?.account_number || undefined,
              ifscCode: selectedBank?.ifsc_code || undefined,
              bankLedger: selectedBank
                ? `${selectedBank.bank_name} - ${selectedBank.account_number.slice(-4)}`
                : undefined,
            });
          }
        } catch (tallyErr) {
          console.warn("Tally sync non-blocking error:", tallyErr);
        }
      }

      // Send notifications
      const plotName = selectedBooking.plots?.plot_number ? `Plot #${selectedBooking.plots.plot_number}` : "Site";
      const notifyMessage = isFinalStep
        ? `🎉 Booking for ${editForm.customerName || selectedBooking.customer_name} (${plotName}) has been CONFIRMED by Accounts! Plot status is now BOOKED globally.`
        : `Booking for ${editForm.customerName || selectedBooking.customer_name} (${plotName}) was approved by ${userRole.toUpperCase()} and moved to ${STAGES.find((s) => s.id === nextStage)?.label}. ${changeLogs.length > 0 ? `(${changeLogs.length} parameters modified)` : ""}`;

      if (selectedBooking.sales_executive_id) {
        await (supabase as any).from("user_notifications").insert({
          user_id: selectedBooking.sales_executive_id,
          title: isFinalStep ? "🎉 Plot Booked & Deal Completed!" : "📋 Booking Pipeline Update",
          message: notifyMessage,
          type: "booking",
          link: "/approvals",
        });
      }

      toast.success(
        isFinalStep
          ? "🎉 Payment Confirmed & Plot Booked Globally!"
          : `Approved & Forwarded to ${STAGES.find((s) => s.id === nextStage)?.label}${changeLogs.length > 0 ? ` (${changeLogs.length} edits logged)` : ""}`
      );

      qc.invalidateQueries();
      setSelectedBooking(null);
      setActionModalType(null);
      setApprovalNotes("");
      setShowEditSection(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update approval stage");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectBooking = async () => {
    if (!selectedBooking) return;
    try {
      setActionLoading(true);

      const currentHistory = Array.isArray(selectedBooking.approval_history) ? selectedBooking.approval_history : [];
      const updatedHistory = [
        ...currentHistory,
        {
          stage: selectedBooking.approval_stage || "sales_head_approval",
          action: "rejected",
          timestamp: new Date().toISOString(),
          actor_id: user.id,
          actor_role: userRole,
          notes: approvalNotes || "Booking rejected during review.",
        },
      ];

      const { error } = await supabase
        .from("bookings")
        .update({
          status: "rejected",
          approval_history: updatedHistory,
        })
        .eq("id", selectedBooking.id);

      if (error) throw error;

      if (selectedBooking.sales_executive_id) {
        await (supabase as any).from("user_notifications").insert({
          user_id: selectedBooking.sales_executive_id,
          title: "⚠️ Booking Review Returned",
          message: `Booking for ${selectedBooking.customer_name} was returned/rejected by ${userRole.toUpperCase()}. Reason: ${approvalNotes || "No notes provided"}`,
          type: "booking",
          link: "/bookings",
        });
      }

      toast.info("Booking marked as returned/rejected.");
      qc.invalidateQueries();
      setSelectedBooking(null);
      setActionModalType(null);
      setApprovalNotes("");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to reject booking");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-terracotta/10 text-terracotta border border-terracotta/20">
              <Sparkles className="h-3 w-3" /> Live Multi-Department Deal Pipeline
            </span>
          </div>
          <h1 className="text-display text-3xl sm:text-4xl mt-2 font-bold tracking-tight">
            {isExecutive ? "My Bookings Pipeline" : "Booking Approvals Hub"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {isExecutive ? (
              <>Live tracking of your submitted plot deals across <strong className="text-amber-600">Sales Head Review</strong> ➔ <strong className="text-orange-600">Admin Pricing</strong> ➔ <strong className="text-blue-600">CRM KYC</strong> ➔ <strong className="text-emerald-600">Accounts Payment</strong>.</>
            ) : (
              <>Company-wide deal pipeline oversight. Strict role gating: <strong className="text-amber-600">Sales Head</strong> ➔ <strong className="text-orange-600">Admin</strong> ➔ <strong className="text-blue-600">CRM Verification</strong> ➔ <strong className="text-emerald-600">Accounts Payment</strong>.</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3.5 py-1.5 text-xs font-semibold bg-terracotta/[0.06] text-terracotta border-terracotta/30 rounded-xl gap-1.5">
            <UserCheck className="h-3.5 w-3.5" /> Department: {userRole.toUpperCase().replace("_", " ")}
          </Badge>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-border/50 pb-3">
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full md:w-auto">
          <TabsList className="bg-card border border-border/60 p-1 rounded-2xl">
            <TabsTrigger value="action_required" className="rounded-xl text-xs font-semibold px-4 py-2 gap-2">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              {isExecutive ? "My Active Pipeline" : "Action Required Queue"} ({pendingQueue.length})
            </TabsTrigger>
            {!isExecutive && (
              <TabsTrigger value="all" className="rounded-xl text-xs font-semibold px-4 py-2 gap-2">
                <Building2 className="h-3.5 w-3.5" /> All Active Pipeline ({bookings.filter(b => b.approval_stage !== 'completed').length})
              </TabsTrigger>
            )}
            <TabsTrigger value="history" className="rounded-xl text-xs font-semibold px-4 py-2 gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Approved & Booked Sites ({historyQueue.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Visibility Scope Badge */}
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
          <Eye className="h-3.5 w-3.5 text-terracotta" />
          {isExecutive ? "Viewing your assigned plot bookings" : "Viewing company-wide active deal pipeline"}
        </div>
      </div>

      {/* Main Content List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mr-3 text-terracotta" /> Loading bookings pipeline...
        </div>
      ) : (
        <div className="space-y-4">
          {(activeTab === "history" ? historyQueue : pendingQueue).length === 0 ? (
            <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border p-8">
              <CheckCircle2 className="h-12 w-12 text-emerald-500/40 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground">No bookings in this queue!</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {isExecutive
                  ? "You have no active plot bookings currently in the approval pipeline. Create a new booking checkout from the Site Mapper."
                  : `All deal approvals for ${userRole.toUpperCase()} department action are up to date.`}
              </p>

              {activeTab === "action_required" && !isExecutive && bookings.filter((b) => b.approval_stage !== "completed").length > 0 && (
                <div className="mt-4">
                  <Button
                    size="sm"
                    onClick={() => setActiveTab("all")}
                    className="bg-gradient-to-r from-terracotta to-amber-600 hover:from-terracotta/90 hover:to-amber-600/90 text-white rounded-xl text-xs font-semibold px-4 py-2 gap-1.5 shadow-md cursor-pointer"
                  >
                    <Building2 className="h-3.5 w-3.5" /> View All Active Pipeline ({bookings.filter((b) => b.approval_stage !== "completed").length})
                  </Button>
                </div>
              )}
            </div>
          ) : (
            (activeTab === "history" ? historyQueue : pendingQueue).map((booking) => {
              const currentStageId = booking.approval_stage || "sales_head_approval";
              const currentStageIndex = STAGES.findIndex((s) => s.id === currentStageId);
              const currentStageConfig = STAGES[currentStageIndex] || STAGES[0];

              const perm = checkStagePermission(currentStageId);

              return (
                <div
                  key={booking.id}
                  className="group rounded-2xl border border-border/60 bg-card p-6 shadow-sm hover:shadow-md transition-all hover:border-terracotta/30 space-y-5"
                >
                  {/* Top Header Bar */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/40 pb-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <Avatar className="h-11 w-11 border-2 border-terracotta/20 font-bold shrink-0">
                        <AvatarFallback className="bg-terracotta/10 text-terracotta">
                          {booking.customer_name?.charAt(0).toUpperCase() || "C"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-foreground truncate">{booking.customer_name}</h3>
                          <Badge variant="outline" className="text-xs font-semibold bg-terracotta/[0.06] text-terracotta border-terracotta/30">
                            {booking.plots?.projects?.name || "Project"} · Plot #{booking.plots?.plot_number || "Site"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                          <span>Submitted {formatDate(booking.created_at)}</span>
                          <span>•</span>
                          <span>Executive: <strong className="text-foreground">{booking.executive?.full_name || booking.executive?.email || "Sales Executive"}</strong></span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Deal Total</p>
                        <p className="text-lg font-bold text-foreground">{money(booking.total_price)}</p>
                      </div>

                      {/* ACTION BUTTON VS WAITING LOCK BADNER */}
                      {booking.approval_stage !== "completed" && (
                        perm.allowed ? (
                          <div className="flex flex-col items-end gap-1">
                            <Button
                              onClick={() => openApprovalModal(booking)}
                              className="bg-gradient-to-r from-terracotta to-amber-600 hover:from-terracotta/90 hover:to-amber-600/90 text-white shadow-md font-semibold text-xs rounded-xl h-10 px-5 gap-2 cursor-pointer"
                            >
                              <FileEdit className="h-4 w-4" />
                              {currentStageId === "sales_head_approval" && "Review, Edit & Approve (Sales Head)"}
                              {currentStageId === "admin_approval" && "Review, Edit & Approve (Admin Pricing)"}
                              {currentStageId === "crm_verification" && "Verify KYC & Handover (CRM)"}
                              {currentStageId === "accounts_payment" && "Confirm Payment & Book Site (Accounts)"}
                            </Button>
                            {isAdmin && currentStageId !== "admin_approval" && (
                              <span className="text-[10px] font-semibold text-amber-500 flex items-center gap-1">
                                👑 Admin Override Access Enabled
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="px-3 py-2 text-xs font-semibold bg-amber-500/10 text-amber-600 border-amber-500/30 rounded-xl gap-1.5">
                            <Lock className="h-3.5 w-3.5 text-amber-500" />
                            Waiting for {currentStageConfig.requiredRole}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>

                  {/* 🔒 CLEAR STAGE WAITING STATUS BANNER */}
                  {booking.approval_stage !== "completed" && (
                    <div className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium ${
                      perm.allowed
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                        : "bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <Clock className={`h-4 w-4 shrink-0 ${perm.allowed ? "text-emerald-600" : "text-amber-500 animate-pulse"}`} />
                        <span>
                          {perm.allowed ? (
                            <><strong>Ready for your department review:</strong> Step {currentStageIndex + 1} ({currentStageConfig.label})</>
                          ) : (
                            <>⏳ <strong>Currently waiting for approval from {currentStageConfig.requiredRole}</strong> at Step {currentStageIndex + 1} ({currentStageConfig.label})</>
                          )}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold border-border bg-card">
                        Step {currentStageIndex + 1} of 5
                      </Badge>
                    </div>
                  )}

                  {/* Interactive Visual Stepper Progress Bar */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-terracotta" /> Live 5-Stage Approval Pipeline Progress
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {STAGES.map((st, idx) => {
                        const isDone = idx < currentStageIndex || booking.approval_stage === "completed";
                        const isCurrent = idx === currentStageIndex && booking.approval_stage !== "completed";
                        const Icon = st.icon;

                        return (
                          <div
                            key={st.id}
                            className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                              isDone
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                                : isCurrent
                                ? "bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/20"
                                : "bg-muted/30 border-border/40 text-muted-foreground opacity-60"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider">Step {idx + 1}</span>
                              <Icon className={`h-4 w-4 ${isDone ? "text-emerald-600" : isCurrent ? "text-amber-600 animate-pulse" : "text-muted-foreground"}`} />
                            </div>
                            <p className="text-xs font-bold truncate">{st.label}</p>
                            <p className="text-[10px] opacity-80 mt-0.5 truncate">{st.requiredRole}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Audit Diff Highlights if Edits Occurred */}
                  {Array.isArray(booking.approval_history) &&
                    booking.approval_history.some((h: any) => h.changes_made && h.changes_made.length > 0) && (
                      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs space-y-1.5">
                        <p className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                          <Pencil className="h-3.5 w-3.5" /> Parameter Modifications Logged
                        </p>
                        <ul className="list-disc list-inside text-[11px] text-muted-foreground space-y-0.5">
                          {booking.approval_history
                            .filter((h: any) => h.changes_made && h.changes_made.length > 0)
                            .flatMap((h: any) => h.changes_made)
                            .map((change: string, idx: number) => (
                              <li key={idx} className="font-medium text-foreground">{change}</li>
                            ))}
                        </ul>
                      </div>
                    )}

                  {/* Key Deal Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/20 p-3.5 rounded-xl border border-border/40 text-xs">
                    <div>
                      <span className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</span>
                      <p className="font-semibold text-foreground mt-0.5">{booking.customer_phone}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground flex items-center gap-1"><IndianRupee className="h-3 w-3" /> Advance Paid</span>
                      <p className="font-semibold text-emerald-600 mt-0.5">{money(booking.advance_paid || booking.booking_amount)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground flex items-center gap-1"><Landmark className="h-3 w-3" /> Payment Method</span>
                      <p className="font-semibold text-foreground mt-0.5">{booking.payment_method || "UPI / Transfer"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> KYC Status</span>
                      <p className="font-semibold text-foreground mt-0.5">
                        {booking.aadhaar_number && booking.pan_number ? "✅ Verified" : "⚠️ Pending KYC"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Stage Action & Deal Parameter Editor Modal */}
      {selectedBooking && actionModalType && (
        <Dialog open={!!actionModalType} onOpenChange={() => { setActionModalType(null); setSelectedBooking(null); setShowEditSection(false); }}>
          <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl rounded-2xl">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-terracotta to-amber-600 text-white flex items-center justify-center shadow-md shrink-0">
                  <FileCheck className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-display">
                    {actionModalType === "sales_head_approval" && "Sales Head Deal Review"}
                    {actionModalType === "admin_approval" && "Admin Pricing & Discount Approval"}
                    {actionModalType === "crm_verification" && "CRM Customer KYC & Document Verification"}
                    {actionModalType === "accounts_payment" && "Accounts Payment & EMI Confirmation"}
                    {actionModalType === "reject" && "Reject / Return Booking"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Customer: <strong className="text-foreground">{selectedBooking.customer_name}</strong> · Plot #{selectedBooking.plots?.plot_number}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-2 text-xs">
              {/* Deal Overview Card */}
              <div className="p-4 rounded-xl bg-terracotta/[0.05] border border-terracotta/20 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Registered Plot Price:</span>
                  <span className="font-semibold text-foreground">{money(selectedBooking.plots?.price || selectedBooking.total_price)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Agreed Plot Price:</span>
                  <span className="font-bold text-sm text-foreground">{money(Number(editForm.totalPrice) || selectedBooking.total_price)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Advance Paid Today:</span>
                  <span className="font-bold text-emerald-600">{money(Number(editForm.advancePaid) || selectedBooking.advance_paid || selectedBooking.booking_amount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Incentive Allotted (₹):</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">
                    {money(Number(editForm.incentiveAmount !== "" ? editForm.incentiveAmount : (selectedBooking.agreed_incentive_amount ?? selectedBooking.incentive_amount ?? 0)))}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Deal Sourced By (Channel):</span>
                  <span className="font-semibold text-foreground">
                    {editForm.externalBdoName
                      ? `${editForm.externalBdoName} (Manual External)`
                      : selectedBooking.attribution_type === "bdo" && selectedBooking.external_bdo_name
                      ? `${selectedBooking.external_bdo_name} (BDO Partner)`
                      : selectedBooking.executive?.full_name || selectedBooking.executive?.email || "Internal Executive"}
                  </span>
                </div>
              </div>

              {/* ✏️ PARAMETER EDIT COLLAPSIBLE */}
              <div className="border border-border/60 rounded-xl overflow-hidden bg-card">
                <button
                  type="button"
                  onClick={() => setShowEditSection(!showEditSection)}
                  className="w-full flex items-center justify-between p-3 bg-muted/40 hover:bg-muted/60 transition-colors font-bold text-xs cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Pencil className="h-3.5 w-3.5 text-terracotta" /> Modify Deal Parameters & Booking Form Details
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-terracotta/10 text-terracotta border-terracotta/30">
                    {showEditSection ? "Hide Editor" : "Click to Edit Form"}
                  </Badge>
                </button>

                {showEditSection && (
                  <div className="p-4 space-y-3 bg-background border-t border-border/50">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Customer Name</Label>
                        <Input
                          value={editForm.customerName}
                          onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Customer Phone</Label>
                        <PhoneInput
                          value={editForm.customerPhone}
                          onChange={(val) => setEditForm({ ...editForm, customerPhone: val })}
                          placeholder="98765 43210"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Agreed Total Price (₹)</Label>
                        <CurrencyInput
                          value={editForm.totalPrice}
                          onChange={(val) => setEditForm({ ...editForm, totalPrice: val })}
                          placeholder="e.g. 50,00,000"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Advance Paid Today (₹)</Label>
                        <CurrencyInput
                          value={editForm.advancePaid}
                          onChange={(val) => setEditForm({ ...editForm, advancePaid: val })}
                          placeholder="e.g. 5,00,000"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Incentive Allotted (₹)</Label>
                        <CurrencyInput
                          placeholder="e.g. 25,000"
                          value={editForm.incentiveAmount}
                          onChange={(val) => setEditForm({ ...editForm, incentiveAmount: val })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Sourced By (Manual External BDO)</Label>
                        <Input
                          placeholder="e.g. Vinayak Patil"
                          value={editForm.externalBdoName}
                          onChange={(e) => setEditForm({ ...editForm, externalBdoName: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Aadhaar Number (12 Digits)</Label>
                        <AadhaarInput
                          placeholder="e.g. 5432 1098 7654"
                          value={editForm.aadhaar}
                          onChange={(val) => setEditForm({ ...editForm, aadhaar: val })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">PAN Number (10 Characters)</Label>
                        <PanInput
                          placeholder="e.g. ABCDE1234F"
                          value={editForm.pan}
                          onChange={(val) => setEditForm({ ...editForm, pan: val })}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px]">Registered Address</Label>
                      <Textarea
                        rows={2}
                        value={editForm.customerAddress}
                        onChange={(e) => setEditForm({ ...editForm, customerAddress: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Stage Specific Form Fields */}
              {actionModalType === "crm_verification" && (
                <div className="space-y-3 bg-muted/30 p-3.5 rounded-xl border border-border/50">
                  <p className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                    <FileCheck className="h-4 w-4 text-blue-600" /> Verify Customer KYC Documents
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Aadhaar Number (12 Digits)</Label>
                      <AadhaarInput
                        placeholder="e.g. 5432 1098 7654"
                        value={crmForm.aadhaar || editForm.aadhaar}
                        onChange={(val) => {
                          setCrmForm({ ...crmForm, aadhaar: val });
                          setEditForm({ ...editForm, aadhaar: val });
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">PAN Number (10 Characters)</Label>
                      <PanInput
                        placeholder="e.g. ABCDE1234F"
                        value={crmForm.pan || editForm.pan}
                        onChange={(val) => {
                          setCrmForm({ ...crmForm, pan: val });
                          setEditForm({ ...editForm, pan: val });
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {actionModalType === "accounts_payment" && (
                <div className="space-y-3 bg-muted/30 p-3.5 rounded-xl border border-border/50">
                  <p className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                    <Landmark className="h-4 w-4 text-emerald-600" /> Accounts Payment & Receipt Details
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Payment Method</Label>
                      <Select
                        value={accountsForm.paymentMethod}
                        onValueChange={(val) => {
                          setAccountsForm({ ...accountsForm, paymentMethod: val });
                          setEditForm({ ...editForm, paymentMethod: val });
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UPI">UPI</SelectItem>
                          <SelectItem value="Bank transfer">Bank Transfer / NEFT</SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Advance Amount Received</Label>
                      <CurrencyInput
                        placeholder="Amount ₹"
                        value={accountsForm.advancePaid || editForm.advancePaid}
                        onChange={(val) => {
                          setAccountsForm({ ...accountsForm, advancePaid: val });
                          setEditForm({ ...editForm, advancePaid: val });
                        }}
                      />
                    </div>
                  </div>

                  {/* Target Project Bank Account Selection */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                        <Landmark className="h-3.5 w-3.5 text-terracotta" />
                        {accountsForm.paymentMethod === "Cash" ? "Receipt Account" : "Deposit To Project Bank Account"}
                      </Label>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Syncs directly to Tally Prime
                      </span>
                    </div>

                    {accountsForm.paymentMethod === "Cash" ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-xl border border-input text-xs font-semibold text-foreground">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                          Cash-in-Hand
                        </span>
                        <span>Company Cash Receipt Vault</span>
                      </div>
                    ) : (
                      <Select
                        value={accountsForm.bankAccountId || (projectBankAccounts[0]?.id ?? "default_project_account")}
                        onValueChange={(val) =>
                          setAccountsForm({
                            ...accountsForm,
                            bankAccountId: val === "default_project_account" ? "" : val,
                          })
                        }
                      >
                        <SelectTrigger className="h-10 bg-background">
                          <SelectValue placeholder="Choose project bank account..." />
                        </SelectTrigger>
                        <SelectContent>
                          {projectBankAccounts.length > 0 ? (
                            projectBankAccounts.map((acc: any) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="font-bold text-foreground">{acc.bank_name}</span>
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
                                      Primary Escrow
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="default_project_account">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-bold text-foreground">
                                  {(selectedBooking as any)?.plots?.projects?.name || "Project"} Primary Collection Bank A/c
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
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-foreground">
                      {(accountsForm.paymentMethod || editForm.paymentMethod) === "Cheque"
                        ? "Cheque Number (6 Digits) & Issuing Bank"
                        : (accountsForm.paymentMethod || editForm.paymentMethod) === "Cash"
                        ? "Cash Receipt / Voucher Ref Number"
                        : (accountsForm.paymentMethod || editForm.paymentMethod) === "Bank transfer"
                        ? "Bank UTR / NEFT / RTGS Reference"
                        : "UPI Transaction ID / 12-Digit Reference Number"}
                    </Label>
                    <PaymentReferenceInput
                      method={accountsForm.paymentMethod || editForm.paymentMethod || "UPI"}
                      value={accountsForm.transactionRef}
                      onChange={(val) => setAccountsForm({ ...accountsForm, transactionRef: val })}
                    />
                  </div>
                </div>
              )}

              {/* Approval Notes Input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Review & Verification Notes</Label>
                <Textarea
                  rows={2}
                  placeholder="Enter optional notes for the next department..."
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>

              {/* Audit History Timeline */}
              {Array.isArray(selectedBooking.approval_history) && selectedBooking.approval_history.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <History className="h-3 w-3" /> Audit History Trail & Parameter Log
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedBooking.approval_history.map((h: any, i: number) => (
                      <div key={i} className="text-[11px] p-2.5 rounded-lg bg-muted/40 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-foreground">{h.action || h.stage}</span>
                          <span className="text-[10px] text-muted-foreground">{formatDate(h.timestamp)}</span>
                        </div>
                        {h.notes && <p className="text-muted-foreground">{h.notes}</p>}
                        {Array.isArray(h.changes_made) && h.changes_made.length > 0 && (
                          <div className="pt-1 border-t border-border/40 text-blue-600 dark:text-blue-400 font-medium">
                            {h.changes_made.map((c: string, cIdx: number) => (
                              <div key={cIdx} className="flex items-center gap-1 text-[10px]">
                                <Pencil className="h-2.5 w-2.5" /> {c}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActionModalType("reject")}
                disabled={actionLoading}
                className="rounded-xl text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
              >
                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject Deal
              </Button>

              {actionModalType === "reject" ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleRejectBooking}
                  disabled={actionLoading}
                  className="rounded-xl text-xs font-semibold"
                >
                  {actionLoading && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                  Confirm Rejection
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    if (actionModalType === "sales_head_approval") handleAdvanceApproval("admin_approval", "Sales Head Approved");
                    if (actionModalType === "admin_approval") handleAdvanceApproval("crm_verification", "Admin Approved");
                    if (actionModalType === "crm_verification") handleAdvanceApproval("accounts_payment", "CRM Verified");
                    if (actionModalType === "accounts_payment") handleAdvanceApproval("completed", "Accounts Payment Confirmed");
                  }}
                  disabled={actionLoading}
                  className="bg-gradient-to-r from-terracotta to-amber-600 hover:from-terracotta/90 hover:to-amber-600/90 text-white rounded-xl text-xs font-semibold shadow-md gap-1.5"
                >
                  {actionLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>
                        {actionModalType === "sales_head_approval" && "Approve & Send to Admin"}
                        {actionModalType === "admin_approval" && "Approve & Send to CRM"}
                        {actionModalType === "crm_verification" && "Verify & Send to Accounts"}
                        {actionModalType === "accounts_payment" && "Confirm Payment & Book Site"}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
