import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { printElement } from "@/lib/printUtils";
import { 
  Printer, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Briefcase, 
  Calendar, 
  User, 
  Heart, 
  Users, 
  Target, 
  CreditCard, 
  Wallet, 
  Coins, 
  CheckCircle2, 
  ShieldCheck, 
  Crown,
  Pencil,
  Sparkles,
  Landmark
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface BookingPrintFormProps {
  booking: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function money(val: any) {
  return `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function BookingPrintForm({ booking, open, onOpenChange }: BookingPrintFormProps) {
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch real-time EMI schedules for this booking
  const { data: dbSchedules = [] } = useQuery({
    queryKey: ["print_schedules", booking?.id],
    queryFn: async () => {
      if (!booking?.id) return [];
      const { data } = await (supabase as any)
        .from("booking_installment_schedules")
        .select("*")
        .eq("booking_id", booking.id)
        .order("installment_number", { ascending: true });
      return data || [];
    },
    enabled: !!booking?.id && open,
  });

  // Fetch real-time payment ledger entries for this booking
  const { data: actualPayments = [] } = useQuery({
    queryKey: ["print_payments", booking?.id],
    queryFn: async () => {
      if (!booking?.id) return [];
      const { data } = await (supabase as any)
        .from("installment_payments")
        .select("*")
        .eq("booking_id", booking.id)
        .order("paid_on", { ascending: true });
      return data || [];
    },
    enabled: !!booking?.id && open,
  });

  if (!booking) return null;

  const handlePrint = () => {
    printElement(printRef.current, {
      title: `ARK_Plot_Booking_Application_${(customerName || "Customer").replace(/[^a-zA-Z0-9]/g, "_")}`,
      pageSize: "A4 portrait",
      pageMargin: "6mm 8mm",
    });
  };

  const project = booking.plots?.projects || {};
  const plot = booking.plots || {};
  const executive = booking.executive || {};

  // Form Field Extractors
  const customerName = booking.customer_name || "—";
  const address = booking.customer_address || "—";
  const city = booking.city || "Hubballi";
  const pincode = booking.pincode || "580029";
  const mobile = booking.customer_phone || "—";
  const landline = booking.landline || "—";
  const email = booking.customer_email || "—";

  const occupation = booking.occupation || "Business";
  const dob = booking.dob ? formatDate(booking.dob) : "DD/MM/YYYY";
  const age = booking.age ? `${booking.age} Years` : "— Years";
  const gender = booking.gender || "M";
  const isMarried = booking.marital_status ?? true;

  const nominee = booking.nominee_name || "—";
  const nomineeRel = booking.nominee_relationship || "—";
  const buyingPurpose = booking.buying_purpose || "Build Home";

  const installmentCount = Math.max(Number(booking.installment_count) || 12, 1);
  const paymentOption = installmentCount > 1 ? `Installment Plan (${installmentCount} Monthly EMIs)` : "Lump Sum Payment";
  const firstPaymentMode = booking.payment_method || "Cash";
  const advanceAmount = Number(booking.advance_paid || booking.booking_amount || 0);

  const ratePerSqft = booking.rate_per_sqft || (booking.total_price && booking.plot_area ? Math.round(booking.total_price / booking.plot_area) : "—");
  const plotArea = booking.plot_area || plot.area || "1200";

  // Financial Ledger Calculations
  const totalSubsequentPayments = actualPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const totalCollectedSoFar = advanceAmount + totalSubsequentPayments;
  const totalPrice = Number(booking.total_price || 0);
  const remainingOutstanding = Math.max(0, totalPrice - totalCollectedSoFar);
  const percentCollected = totalPrice > 0 ? Math.min(100, Math.round((totalCollectedSoFar / totalPrice) * 100)) : 0;

  // Build Unified Dynamic Installment Schedule Table Rows
  const scheduleRows = Array.from({ length: installmentCount }).map((_, idx) => {
    const instNum = idx + 1;
    const dbItem = dbSchedules.find((s: any) => s.installment_number === instNum);
    const paymentItem = actualPayments[idx];

    let scheduledDateStr = "As per Agreement";
    if (dbItem?.due_date) {
      scheduledDateStr = formatDate(dbItem.due_date);
    } else if (booking.first_installment_due_date) {
      const baseDate = new Date(booking.first_installment_due_date);
      baseDate.setMonth(baseDate.getMonth() + idx);
      scheduledDateStr = formatDate(baseDate.toISOString());
    }

    const scheduledAmt = dbItem?.amount
      ? Number(dbItem.amount)
      : Math.round(Math.max(0, totalPrice - advanceAmount) / installmentCount);

    const paidAmt = dbItem?.paid_amount !== undefined && dbItem?.paid_amount !== null
      ? Number(dbItem.paid_amount)
      : paymentItem?.amount
      ? Number(paymentItem.amount)
      : 0;

    const actualPaidDate = paymentItem?.paid_on
      ? formatDate(paymentItem.paid_on)
      : dbItem?.status === "paid" && dbItem?.updated_at
      ? formatDate(dbItem.updated_at)
      : "—";

    const paymentRef = paymentItem?.reference_number || dbItem?.notes || "—";

    let statusLabel = "Scheduled";
    let statusClass = "text-slate-500 font-medium";

    if (paidAmt >= scheduledAmt && scheduledAmt > 0) {
      statusLabel = "✓ Fully Paid";
      statusClass = "text-emerald-700 font-bold bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300";
    } else if (paidAmt > 0) {
      statusLabel = `⚠️ Partial (${money(paidAmt)})`;
      statusClass = "text-amber-800 font-bold bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300";
    }

    return {
      instNum,
      scheduledDateStr,
      scheduledAmt,
      paidAmt,
      actualPaidDate,
      paymentRef,
      statusLabel,
      statusClass,
    };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[94vh] overflow-y-auto p-0 bg-card border border-border/80 shadow-2xl rounded-2xl">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="print:hidden sticky top-0 z-20 flex items-center justify-between p-4 bg-card/95 backdrop-blur-xl border-b border-border/60 text-foreground">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-terracotta/10 border border-terracotta/30 flex items-center justify-center text-terracotta shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-foreground block tracking-tight">Ark Builders & Developers</span>
              <span className="text-xs text-muted-foreground">Official Application & Financial Dues Ledger (A4 Print View)</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handlePrint}
              className="bg-terracotta hover:bg-terracotta/90 text-white font-bold text-xs px-5 py-2.5 rounded-xl gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" /> Print Application Form (A4)
            </Button>
          </div>
        </div>

        {/* PRINT CONTAINER / PREVIEW AREA */}
        <div className="p-6 bg-slate-200 dark:bg-slate-950 flex justify-center">
          <div
            ref={printRef}
            className="print-document relative bg-white text-slate-900 shadow-2xl w-[210mm] min-h-[297mm] p-[8mm] font-sans leading-relaxed text-xs border border-slate-300 rounded-md space-y-4 overflow-hidden"
          >
            {/* PAGE 1 CONTENT */}
            <div className="space-y-3 relative z-10">
              {/* TOP BRANDING HEADER */}
              <div
                className="border-b-2 border-slate-900 pb-3 flex items-center gap-5 font-sans"
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
                  alt="Ark Builders & Developers Logo"
                  className="h-20 w-auto object-contain shrink-0"
                  style={{
                    height: "75px",
                    width: "auto",
                    maxWidth: "185px",
                    objectFit: "contain",
                    flexShrink: 0,
                    display: "block",
                  }}
                  onError={(e: any) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div className="space-y-1 text-slate-700 flex-1" style={{ flex: "1 1 0%", minWidth: 0 }}>
                  <div className="flex items-center gap-2.5">
                    <h1 className="font-serif font-black text-2xl text-slate-900 tracking-tight leading-none" style={{ margin: 0, fontSize: "22px", fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>
                      ARK BUILDERS & DEVELOPERS
                    </h1>
                  </div>
                  <p className="text-[11px] font-semibold text-amber-800 tracking-wide uppercase" style={{ margin: "2px 0 0 0", fontSize: "11px", fontWeight: 700, color: "#9a3412", letterSpacing: "0.5px" }}>
                    PROMOTERS, BUILDERS & DEVELOPERS
                  </p>
                  <p className="text-[10.5px] text-slate-600 font-medium" style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#475569" }}>
                    #4th Floor, SVB City Center, Above Yes Bank, Club Road, HUBBALLI – 580029
                  </p>
                  <div className="flex items-center gap-4 text-[10px] text-slate-600 font-medium flex-wrap" style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "9.5px", color: "#475569", marginTop: "3px", flexWrap: "wrap" }}>
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-amber-600" /> 0836-4264861</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-amber-600" /> +91-9739 388 839</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-amber-600" /> +91-9844 123 456</span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-slate-600 font-medium flex-wrap" style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "9.5px", color: "#475569", marginTop: "2px" }}>
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-amber-600" /> arkbuilds@gmail.com</span>
                    <span>|</span>
                    <span className="font-semibold text-slate-800" style={{ fontWeight: 600, color: "#1e293b" }}>www.arkbuildersanddevelopers.in</span>
                  </div>
                </div>
              </div>

              {/* FORM TITLE BANNER */}
              <div className="bg-[#0B2545] text-white py-2.5 px-4 rounded-xl shadow-md flex items-center justify-between font-sans border border-blue-900">
                <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-amber-400" /> PLOT BOOKING APPLICATION FORM
                </span>
                <span className="font-mono text-[11px] font-semibold text-amber-300">
                  REF NO : BKG-{(project.code || "PB01").toUpperCase()}-{(plot.plot_number || "P21").toUpperCase()}
                </span>
              </div>

              {/* CUSTOMER NAME & ADDRESS CARD */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-white shadow-xs">
                <div className="grid grid-cols-[1fr_130px] gap-4">
                  <div className="space-y-3">
                    <div className="flex items-baseline border-b border-slate-100 pb-2">
                      <span className="w-36 font-bold text-slate-700 text-[11px]">Customer Name</span>
                      <span className="font-bold text-slate-900 text-sm">{customerName}</span>
                    </div>
                    <div className="flex items-baseline">
                      <span className="w-36 font-bold text-slate-700 text-[11px]">Registered Address</span>
                      <span className="font-medium text-slate-900 flex-1 text-[11.5px]">{address}</span>
                    </div>
                  </div>

                  {/* Photo Frame Box */}
                  <div className="p-1 flex flex-col items-center justify-center text-center bg-slate-50 rounded-xl border border-slate-200">
                    <div className="h-26 w-22 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center p-1 bg-white">
                      <User className="h-7 w-7 text-slate-300 mb-1" />
                      <span className="text-[8px] font-semibold text-slate-400 leading-tight">Affix Passport</span>
                      <span className="text-[8px] font-semibold text-slate-400 leading-tight">Size Photo</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* DEMOGRAPHICS GRID */}
              <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-xs space-y-2">
                <div className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2 text-[11px]">
                    <MapPin className="h-3.5 w-3.5 text-slate-700" />
                    <span className="font-bold text-slate-700 w-28">City / District</span>
                    <span className="font-bold text-slate-900">{city}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <Target className="h-3.5 w-3.5 text-slate-700" />
                    <span className="font-bold text-slate-700 w-24">Pin Code</span>
                    <span className="font-bold text-slate-900">{pincode}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2 text-[11px]">
                    <Phone className="h-3.5 w-3.5 text-slate-700" />
                    <span className="font-bold text-slate-700 w-28">Contact Mobile</span>
                    <span className="font-bold text-slate-900">{mobile}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <Phone className="h-3.5 w-3.5 text-slate-700" />
                    <span className="font-bold text-slate-700 w-24">Landline / Alt Phone</span>
                    <span className="font-semibold text-slate-900">{landline}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] pt-0.5">
                  <Mail className="h-3.5 w-3.5 text-slate-700" />
                  <span className="font-bold text-slate-700 w-28">Email Address</span>
                  <span className="font-bold text-slate-900">{email}</span>
                </div>
              </div>

              {/* OCCUPATION & PERSONAL DETAILS TWO-COLUMN CARDS */}
              <div className="grid grid-cols-2 gap-3">
                {/* Left Card: Occupation */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-slate-700" /> OCCUPATION / EMPLOYMENT CATEGORY
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    {["Private Employee", "Govt. Employee", "Retire Employee", "Business", "Professional", "Others"].map((occ) => {
                      const isSelected = occupation.toLowerCase().includes(occ.toLowerCase());
                      return (
                        <div
                          key={occ}
                          className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-all ${
                            isSelected
                              ? "bg-[#0B2545] text-white border-[#0B2545] font-bold shadow-xs"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}
                        >
                          {occ}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Card: Personal Details */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-xs space-y-2">
                  <div className="grid grid-cols-2 gap-2 border-b border-slate-100 pb-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-700" />
                      <span className="font-bold text-slate-700">Date of Birth</span>
                      <span className="font-semibold text-slate-900 ml-1">{dob}</span>
                    </div>
                    <div className="flex items-center gap-1.5 border-l border-slate-100 pl-2">
                      <User className="h-3.5 w-3.5 text-slate-700" />
                      <span className="font-bold text-slate-700">Age</span>
                      <span className="font-bold text-slate-900 ml-1">{age}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-700" />
                      <span className="font-bold text-slate-700">Gender</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className={`px-3 py-1 rounded-lg border font-bold ${gender === "M" ? "bg-[#0B2545] text-white border-[#0B2545]" : "bg-slate-50 text-slate-600 border-slate-200"}`}>Male</span>
                      <span className={`px-3 py-1 rounded-lg border font-bold ${gender === "F" ? "bg-[#0B2545] text-white border-[#0B2545]" : "bg-slate-50 text-slate-600 border-slate-200"}`}>Female</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Heart className="h-3.5 w-3.5 text-slate-700" />
                      <span className="font-bold text-slate-700">Marital Status</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className={`px-2.5 py-1 rounded-lg border font-bold ${isMarried ? "bg-[#0B2545] text-white border-[#0B2545]" : "bg-slate-50 text-slate-600 border-slate-200"}`}>Married</span>
                      <span className={`px-2.5 py-1 rounded-lg border font-bold ${!isMarried ? "bg-[#0B2545] text-white border-[#0B2545]" : "bg-slate-50 text-slate-600 border-slate-200"}`}>Single / Unmarried</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* NOMINEE & RELATIONSHIP CARD */}
              <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-xs">
                <div className="grid grid-cols-2 gap-4 text-[11px]">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-slate-700" />
                    <span className="font-bold text-slate-700 w-32">Nominee for Plot</span>
                    <span className="font-bold text-slate-900">{nominee}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-slate-700" />
                    <span className="font-bold text-slate-700 w-24">Relationship</span>
                    <span className="font-bold text-slate-900">{nomineeRel}</span>
                  </div>
                </div>
              </div>

              {/* PLOT BUYING PURPOSE & CHOSEN PAYMENT PLAN */}
              <div className="grid grid-cols-2 gap-3">
                {/* Left Card: Plot Buying Purpose */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-1.5">
                    <Target className="h-3.5 w-3.5 text-slate-700" /> PLOT BUYING PURPOSE
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                    {["Build Home", "Investment", "Gift", "Others"].map((purp) => {
                      const isSelected = buyingPurpose.toLowerCase().includes(purp.toLowerCase());
                      return (
                        <div
                          key={purp}
                          className={`py-1.5 px-1 text-center rounded-lg border font-medium transition-all ${
                            isSelected
                              ? "bg-[#0B2545] text-white border-[#0B2545] font-bold shadow-xs"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}
                        >
                          {purp}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Card: Chosen Payment Plan */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-slate-700" /> CHOSEN PAYMENT PLAN
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <div className={`py-1.5 px-2 text-center rounded-lg border font-bold ${installmentCount > 1 ? "bg-[#0B2545] text-white border-[#0B2545]" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                      Installment Plan ({installmentCount} Monthly EMIs)
                    </div>
                    <div className={`py-1.5 px-2 text-center rounded-lg border font-bold ${installmentCount <= 1 ? "bg-[#0B2545] text-white border-[#0B2545]" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                      Lump Sum Payment
                    </div>
                  </div>
                </div>
              </div>

              {/* TOKEN ADVANCE BOOKING PAYMENT BANNER */}
              <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 flex items-center justify-between text-[11px] shadow-xs">
                <span className="font-bold text-emerald-900 uppercase tracking-wider">
                  TOKEN ADVANCE BOOKING PAYMENT :
                </span>
                <div className="flex items-center gap-6">
                  <span className="font-medium text-slate-800">Mode: <strong className="text-slate-900">{firstPaymentMode}</strong></span>
                  <span className="font-bold text-slate-800">
                    Paid Amount: <strong className="text-emerald-700 text-sm font-bold ml-1">{money(advanceAmount)}</strong>
                  </span>
                </div>
              </div>

              {/* PLOT SPECIFICATIONS & FINANCIAL COST BREAKDOWN */}
              <div className="border border-slate-200 rounded-xl bg-white p-3.5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-slate-700" /> PLOT SPECIFICATIONS & FINANCIAL COST BREAKDOWN
                  </span>
                  <span className="font-bold text-amber-700 text-xs tracking-wider uppercase font-serif">
                    {project.name || "ROYAL VILLA PROPERTIES"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-medium block text-[10px]">Layout Project Name</span>
                    <span className="font-bold text-slate-900 text-sm">{project.name || "Royal Villa Properties"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block text-[10px]">Proposed Plot Number</span>
                    <span className="font-bold text-slate-900 text-sm">Plot #{plot.plot_number || "p21"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 items-center pt-0.5">
                  <div className="text-[11px]">
                    <span className="text-slate-500 font-medium block text-[10px]">Rate Per Sq.Ft.</span>
                    <span className="font-bold text-slate-900 text-sm">₹ {ratePerSqft} <span className="text-[10px] font-normal text-slate-600">/ sq.ft</span></span>
                  </div>
                  <div className="text-[11px]">
                    <span className="text-slate-500 font-medium block text-[10px]">Total Plot Area</span>
                    <span className="font-bold text-slate-900 text-sm">{Number(plotArea).toLocaleString("en-IN")} sq.ft <span className="text-[10px] text-slate-500 font-normal">({(Number(plotArea) * 0.092903).toFixed(2)} sq.m)</span></span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-300 text-center">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-900 block">Final Agreed Plot Cost</span>
                    <span className="font-black text-amber-950 text-base font-sans">{money(totalPrice)}</span>
                  </div>
                </div>
              </div>

              {/* DYNAMIC DUES STATEMENT & INSTALLMENT PAYMENT LEDGER */}
              <div className="border border-slate-200 rounded-xl bg-white p-3.5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                    DYNAMIC DUES STATEMENT & INSTALLMENT PAYMENT LEDGER
                  </span>
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                    CUSTOMER: {customerName.toUpperCase()} · PLOT #{plot.plot_number ? plot.plot_number.toUpperCase() : "P21"}
                  </span>
                </div>

                {/* 4 COLOR-CODED METRIC BLOCKS */}
                <div className="grid grid-cols-4 gap-3 text-xs font-sans">
                  {/* Block 1: Total Agreed Cost */}
                  <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-blue-900 block">TOTAL AGREED COST</span>
                      <span className="font-bold text-blue-950 text-sm">{money(totalPrice)}</span>
                    </div>
                  </div>

                  {/* Block 2: Total Collected */}
                  <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Coins className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-900 block">TOTAL COLLECTED</span>
                      <span className="font-bold text-emerald-950 text-sm">{money(totalCollectedSoFar)}</span>
                    </div>
                  </div>

                  {/* Block 3: Remaining Balance */}
                  <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-900 block">REMAINING BALANCE</span>
                      <span className="font-bold text-amber-950 text-sm">{money(remainingOutstanding)}</span>
                    </div>
                  </div>

                  {/* Block 4: EMIs Planned */}
                  <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-200 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-purple-900 block">EMIS PLANNED</span>
                      <span className="font-bold text-purple-950 text-sm">{installmentCount} EMIs</span>
                    </div>
                  </div>
                </div>

                {/* CIRCLE PROGRESS INDICATOR BANNER */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between font-sans">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full border-3 border-emerald-600 flex items-center justify-center text-emerald-800 font-bold text-xs bg-white shadow-xs">
                      {percentCollected}%
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">Overall Payment Completion</span>
                      <span className="text-[11px] font-bold text-emerald-700">{percentCollected}% Collected</span>
                    </div>
                  </div>
                  <div className="text-right text-xs font-bold text-slate-800">
                    {money(totalCollectedSoFar)} of {money(totalPrice)}
                  </div>
                </div>
              </div>
            </div>

            {/* PAGE BREAK FOR PAGE 2 */}
            <div className="page-break pt-6 space-y-4 relative z-10">
              {/* PAGE 2 HEADER */}
              <div className="bg-[#0B2545] text-white py-2 px-4 rounded-xl shadow-md flex items-center justify-between font-sans border border-blue-900">
                <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-amber-400" /> DYNAMIC DUES STATEMENT & INSTALLMENT PAYMENT LEDGER
                </span>
                <span className="text-[10px] font-mono text-amber-300 font-semibold">
                  Customer: {customerName} · Plot #{plot.plot_number}
                </span>
              </div>

              {/* DYNAMIC PAYMENT SCHEDULE TABLE */}
              <div className="space-y-2">
                <div className="flex justify-between items-center font-sans">
                  <p className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                    Dynamic Installment Dues Breakdown ({scheduleRows.length} EMIs)
                  </p>
                  <span className="text-[10px] text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-300 font-medium">
                    Updated dynamically on every payment entry
                  </span>
                </div>

                <table className="w-full border border-slate-300 text-xs text-left font-sans rounded-xl overflow-hidden shadow-xs">
                  <thead className="bg-[#0B2545] text-white border-b border-slate-300 font-bold text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="p-2.5 border-r border-blue-900">Installment #</th>
                      <th className="p-2.5 border-r border-blue-900">Scheduled Due Date</th>
                      <th className="p-2.5 border-r border-blue-900">Scheduled Amt (₹)</th>
                      <th className="p-2.5 border-r border-blue-900">Actual Date Paid</th>
                      <th className="p-2.5 border-r border-blue-900">Actual Amt Paid (₹)</th>
                      <th className="p-2.5">Status & Ref UTR #</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {/* Row 0: Advance Booking Payment */}
                    <tr className="bg-emerald-50/80 font-semibold border-b-2 border-emerald-200">
                      <td className="p-2.5 border-r border-slate-300 font-bold text-slate-900">Token Advance</td>
                      <td className="p-2.5 border-r border-slate-300 text-slate-800">{formatDate(booking.created_at)}</td>
                      <td className="p-2.5 border-r border-slate-300 font-mono">{money(advanceAmount)}</td>
                      <td className="p-2.5 border-r border-slate-300 font-bold text-emerald-900">{formatDate(booking.created_at)}</td>
                      <td className="p-2.5 border-r border-slate-300 font-mono font-black text-emerald-800">{money(advanceAmount)}</td>
                      <td className="p-2.5 text-emerald-800 font-bold">
                        ✓ Received ({firstPaymentMode})
                      </td>
                    </tr>

                    {/* Dynamic Scheduled EMI Rows */}
                    {scheduleRows.map((row) => (
                      <tr key={row.instNum} className={row.paidAmt > 0 ? "bg-emerald-50/30" : "hover:bg-slate-50"}>
                        <td className="p-2.5 border-r border-slate-300 font-bold text-slate-900">EMI #{row.instNum}</td>
                        <td className="p-2.5 border-r border-slate-300 text-slate-800">{row.scheduledDateStr}</td>
                        <td className="p-2.5 border-r border-slate-300 font-mono font-medium">{money(row.scheduledAmt)}</td>
                        <td className="p-2.5 border-r border-slate-300 font-medium text-slate-900">{row.actualPaidDate}</td>
                        <td className="p-2.5 border-r border-slate-300 font-mono font-bold text-slate-900">
                          {row.paidAmt > 0 ? money(row.paidAmt) : "—"}
                        </td>
                        <td className="p-2.5">
                          <span className={row.statusClass}>{row.statusLabel}</span>
                          {row.paymentRef !== "—" && (
                            <span className="block text-[9px] text-slate-600 font-mono mt-0.5">Ref: {row.paymentRef}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* DECLARATIONS & LEGAL TERMS */}
              <div className="border border-slate-200 p-3.5 space-y-4 rounded-xl text-[11px] bg-slate-50/50 shadow-xs">
                <div className="space-y-2">
                  <p className="italic text-slate-800 leading-normal font-serif">
                    "I hereby declare that all the information provided above is true to the best of my knowledge. I agree to abide by the terms and conditions for booking a plot with Ark Builders & Developers, Hubli, as per the details mentioned."
                  </p>
                  <div className="pt-6 flex justify-end">
                    <div className="text-center w-56 border-t border-slate-800 pt-1 font-bold text-xs text-slate-900 font-sans">
                      Customer Signature
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3 space-y-2">
                  <p className="italic text-slate-800 leading-normal font-serif">
                    "In the event of cancellation of the plot, whether before or after execution of the Sale Agreement, I agree to comply with the company's applicable cancellation policy."
                  </p>
                  <div className="pt-6 flex justify-end">
                    <div className="text-center w-56 border-t border-slate-800 pt-1 font-bold text-xs text-slate-900 font-sans">
                      Customer Signature
                    </div>
                  </div>
                </div>
              </div>

              {/* FOR OFFICE USE ONLY SECTION WITH OFFICIAL STAMPS */}
              <div className="space-y-1">
                <div className="bg-[#0B2545] text-white px-3 py-1.5 font-bold text-xs uppercase tracking-wider rounded-t-xl font-sans flex justify-between items-center border-b border-amber-500">
                  <span>FOR OFFICE USE ONLY — OFFICIAL APPROVAL LOG</span>
                  <span className="text-[9px] text-amber-300 font-normal">Internal Audit Record</span>
                </div>
                <div className="border border-slate-200 text-xs p-3.5 space-y-3 bg-white rounded-b-xl shadow-xs">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-b border-slate-200 pb-3 font-sans">
                    <div><span className="font-bold text-slate-800">TC Name :</span> {booking.tc_name || "—"}</div>
                    <div><span className="font-bold text-slate-800">TC Place :</span> {booking.tc_place || "Hubballi"}</div>
                    <div><span className="font-bold text-slate-800">Lead Name :</span> <strong className="text-slate-900">{booking.lead_name || customerName}</strong></div>
                    <div><span className="font-bold text-slate-800">Receipt Date :</span> {booking.receipt_date ? formatDate(booking.receipt_date) : formatDate(booking.created_at)}</div>
                    <div><span className="font-bold text-slate-800">Closer Name :</span> {booking.closer_name || executive.full_name || "Sales Head"}</div>
                    <div><span className="font-bold text-slate-800">Receipt Number :</span> <span className="font-mono font-bold text-slate-900">{booking.receipt_number || `REC-${project.code || 'ARK'}-${plot.plot_number || '101'}`}</span></div>
                    <div><span className="font-bold text-slate-800">Agent Name :</span> {booking.agent_name || "Direct"}</div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-800">Type of Booking :</span>
                      <span className="font-bold text-slate-900 px-2 py-0.5 bg-slate-100 border border-slate-300 rounded-md text-[10px]">{booking.booking_type || "Personal"}</span>
                    </div>
                  </div>

                  {booking.remarks && (
                    <div className="text-[11px] pt-1">
                      <span className="font-bold text-slate-800">Office Remarks : </span>
                      <span className="text-slate-900">{booking.remarks}</span>
                    </div>
                  )}

                  {/* 5-DEPARTMENT OFFICIAL APPROVAL & SIGNATURE STAMPS BOX */}
                  <div className="pt-3 border-t border-slate-200">
                    <p className="font-bold text-[10px] uppercase tracking-wider text-slate-700 mb-3 text-center font-sans">
                      OFFICIAL DEPARTMENT APPROVALS & AUTHORIZED SIGNATURE STAMPS
                    </p>
                    <div className="grid grid-cols-5 gap-2.5 text-center text-[10px] font-sans">
                      <div className="border border-slate-300 p-2 rounded-xl space-y-4 bg-slate-50/50">
                        <span className="font-bold block text-slate-800">BDO Partner</span>
                        <div className="h-7 border-b border-dashed border-slate-400 flex items-center justify-center text-[9px] text-slate-500 font-medium">Signature</div>
                      </div>
                      <div className="border border-emerald-400 p-2 rounded-xl space-y-4 bg-emerald-50/60 shadow-xs">
                        <span className="font-bold block text-emerald-900">Sales Dept.</span>
                        <div className="h-7 border-b border-dashed border-emerald-300 flex items-center justify-center text-emerald-700 font-black text-[9.5px]">✓ Approved</div>
                      </div>
                      <div className="border border-blue-400 p-2 rounded-xl space-y-4 bg-blue-50/60 shadow-xs">
                        <span className="font-bold block text-blue-900">CRM Dept.</span>
                        <div className="h-7 border-b border-dashed border-blue-300 flex items-center justify-center text-blue-700 font-black text-[9.5px]">✓ Verified</div>
                      </div>
                      <div className="border border-teal-400 p-2 rounded-xl space-y-4 bg-teal-50/60 shadow-xs">
                        <span className="font-bold block text-teal-900">Account Dept.</span>
                        <div className="h-7 border-b border-dashed border-teal-300 flex items-center justify-center text-teal-700 font-black text-[9.5px]">✓ Received</div>
                      </div>
                      <div className="border-2 border-slate-900 p-2 rounded-xl space-y-3 bg-gradient-to-br from-amber-100 to-amber-200 shadow-sm">
                        <div className="flex items-center justify-center gap-1 font-black text-[9px] text-slate-900 uppercase">
                          <span>Verified & Approved</span>
                        </div>
                        <div className="pt-2 text-center font-black text-[11px] text-slate-900 border-t border-slate-700">
                          M.D. Signature
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* FOOTER BAR WITH GOLDEN SKYLINE AND TAGLINE */}
              <div className="pt-3 border-t border-amber-300 flex justify-between items-center text-[10px] text-amber-900 font-medium font-sans">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="h-4 w-4 text-amber-600 inline" /> Building Trust. Creating Landmarks. Delivering Value.
                </div>
                <div className="text-slate-500 text-[9px]">
                  Ark Builders & Developers · Official Application Document · Page 1 & 2
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
