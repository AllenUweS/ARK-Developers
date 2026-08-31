import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, BadgeIndianRupee, CalendarDays, CheckCircle2, ShieldCheck, UserRound, FileText, Building, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  sanitizePhoneInput,
  getPhoneValidationError,
  isValid10DigitPhone,
  isValidEmail,
  toE164Phone,
  sanitizePositiveNumber,
  sanitizeAadhaarNumber,
  sanitizePanNumber,
  getAadhaarValidationError,
  getPanValidationError,
} from "@/lib/formValidation";
import { PhoneInput } from "@/components/ui/phone-input";
import { AadhaarInput } from "@/components/ui/aadhaar-input";
import { PanInput } from "@/components/ui/pan-input";
import { sendBookingConfirmationWhatsApp } from "@/lib/whatsappService";
import type { LeadRow } from "@/components/site-mapper/types";
import { AttributionSelector, AttributionValue } from "@/components/common/AttributionSelector";

export const Route = createFileRoute("/_authenticated/plots/$plotId/book/checkout")({
  validateSearch: (search: Record<string, unknown>): { leadId?: string } => ({
    leadId: typeof search.leadId === "string" ? search.leadId : undefined,
  }),
  component: BookingCheckout,
});

function BookingCheckout() {
  const { plotId } = Route.useParams();
  const { leadId } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    customer_address: "",
    city: "Hubballi",
    pincode: "580029",
    landline: "",
    occupation: "Business",
    aadhaar_number: "",
    pan_number: "",
    dob: "",
    age: "",
    gender: "M",
    marital_status: "Married",
    nominee_name: "",
    nominee_relationship: "",
    buying_purpose: "Build Home",
    rate_per_sqft: "",
    plot_area: "",
    tc_name: "",
    tc_place: "",
    lead_name: "",
    closer_name: "",
    agent_name: "",
    receipt_number: "",
    receipt_date: new Date().toISOString().split("T")[0],
    booking_type: "Personal",
    finalPrice: "",
    advancePaid: "",
    installments: "12",
    customInstallments: "",
    firstDueDate: "",
    paymentMethod: "UPI",
    incentive_amount: "",
    remarks: "",
  });

  const [attribution, setAttribution] = useState<AttributionValue>({
    attributionType: "internal",
  });

  const { data: plot } = useQuery({
    queryKey: ["plot", plotId],
    queryFn: async () =>
      (await supabase.from("plots").select("*, projects(name, code)").eq("id", plotId).maybeSingle()).data as any,
  });

  const { data: lead } = useQuery({
    queryKey: ["lead", leadId],
    enabled: !!leadId,
    queryFn: async () =>
      (await (supabase as any).from("plot_leads").select("*").eq("id", leadId).maybeSingle()).data as LeadRow | null,
  });

  const ownerId = lead?.created_by ?? lead?.assigned_to;
  const { data: owner } = useQuery({
    queryKey: ["booking-owner", ownerId],
    enabled: !!ownerId,
    queryFn: async () =>
      (await supabase.from("profiles").select("id, full_name, phone, email, job_title").eq("id", ownerId!).maybeSingle()).data,
  });

  const effectiveExecutiveId =
    attribution.attributionType === "internal" && attribution.internalExecutiveId
      ? attribution.internalExecutiveId
      : ownerId;

  const { data: effectiveExecutive } = useQuery({
    queryKey: ["booking-effective-executive", effectiveExecutiveId],
    enabled: !!effectiveExecutiveId,
    queryFn: async () =>
      (await supabase.from("profiles").select("id, full_name, phone, email, job_title").eq("id", effectiveExecutiveId!).maybeSingle()).data,
  });

  const { data: selectedBdo } = useQuery({
    queryKey: ["booking-selected-bdo", attribution.bdoId],
    enabled: attribution.attributionType === "bdo" && !!attribution.bdoId,
    queryFn: async () =>
      (
        await (supabase as any)
          .from("bdo_partners")
          .select("id, name, agency_name, phone, commission_rate, bdo_code")
          .eq("id", attribution.bdoId!)
          .maybeSingle()
      ).data,
  });

  useEffect(() => {
    if (lead) {
      setForm((current) => ({
        ...current,
        customer_name: lead.name,
        customer_phone: lead.phone,
        customer_email: lead.email ?? "",
        customer_address: current.customer_address || (lead as any)?.address || "",
        remarks: lead.notes ?? "",
        finalPrice: current.finalPrice || String(plot?.price ?? ""),
        rate_per_sqft: String(plot?.rate_per_sqft ?? (plot?.price && (plot?.area_sqft || plot?.area) ? Math.round(plot.price / (plot.area_sqft || plot.area)) : "")),
        plot_area: String(plot?.area_sqft || plot?.area || "1200"),
        lead_name: current.lead_name || lead.name,
      }));

      if ((lead as any)?.attribution_type) {
        setAttribution({
          attributionType: (lead as any).attribution_type,
          internalExecutiveId: lead.assigned_to || ownerId || undefined,
          bdoId: (lead as any).bdo_id || undefined,
          externalBdoName: (lead as any).external_bdo_name || undefined,
        });
      } else {
        setAttribution({
          attributionType: "internal",
          internalExecutiveId: ownerId || undefined,
        });
      }
    }
  }, [lead, plot?.price, plot?.area, plot?.rate_per_sqft, ownerId]);

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const listedPrice = Number(plot?.price ?? 0);
  const finalPrice = Number(form.finalPrice || listedPrice);
  const advancePaid = Number(form.advancePaid || 0);
  const bookingAmount = advancePaid;
  const balance = Math.max(finalPrice - advancePaid, 0);
  const installmentCount = Math.max(Number(form.installments === "custom" ? form.customInstallments : form.installments) || 1, 1);
  const perInstallment = balance / installmentCount;
  const concession = Math.max(listedPrice - finalPrice, 0);
  const calculatedIncentive = (finalPrice * Number(plot?.incentive_percentage ?? 0)) / 100;
  const incentive = form.incentive_amount !== "" ? Number(form.incentive_amount) : calculatedIncentive;

  const calculateAge = (dobString: string): string => {
    if (!dobString) return "";
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return "";
    const today = new Date();
    if (birthDate > today) return "";
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? String(age) : "";
  };

  const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const formatINRInput = (val: string | number) => {
    if (val === "" || val === null || val === undefined) return "";
    const numStr = String(val).replace(/[^0-9]/g, "");
    if (!numStr) return "";
    const num = parseInt(numStr, 10);
    if (isNaN(num)) return "";
    return num.toLocaleString("en-IN");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!lead || !ownerId) throw new Error("This lead has no recorded owner. Assign an employee before booking.");

      if (!form.customer_name.trim()) {
        throw new Error("Customer Full Name is required.");
      }

      const cleanPhone = sanitizePhoneInput(form.customer_phone);
      const phoneErr = getPhoneValidationError(cleanPhone);
      if (phoneErr) {
        throw new Error(`Customer Phone: ${phoneErr}`);
      }

      if (form.customer_email && form.customer_email.trim() && !isValidEmail(form.customer_email)) {
        throw new Error("Please enter a valid customer email address.");
      }

      if (finalPrice <= 0) {
        throw new Error("Agreed final plot price must be greater than ₹0.");
      }

      if (advancePaid > finalPrice) {
        throw new Error(
          `Paid today amount (${money(advancePaid)}) cannot exceed the total agreed price (${money(finalPrice)}).`
        );
      }

      // Safeguard: Check if an active/pending booking pipeline already exists for this plot
      const { data: existingActive } = await (supabase as any)
        .from("bookings")
        .select("id, status, customer_name, created_at")
        .eq("plot_id", plotId)
        .in("status", ["pending", "approved", "booked"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingActive) {
        throw new Error(
          `An active booking pipeline already exists for this plot (Customer: ${existingActive.customer_name}, Status: ${existingActive.status.toUpperCase()}). Please review it under Approvals.`
        );
      }

      const paymentPlan = `${installmentCount} monthly installments of ${money(perInstallment)}${
        form.firstDueDate ? `, first due ${form.firstDueDate}` : ""
      }`;

      const initialHistory = [{
        stage: "sales_head_approval",
        status: "submitted",
        timestamp: new Date().toISOString(),
        actor_id: user.id,
        actor_name: user.email || "Executive",
        notes: "Booking submitted by Executive, pending Sales Head review.",
      }];

      if (form.aadhaar_number && form.aadhaar_number.trim()) {
        const cleanAadh = sanitizeAadhaarNumber(form.aadhaar_number);
        const aadhErr = getAadhaarValidationError(cleanAadh, false);
        if (aadhErr) throw new Error(`Invalid Aadhaar Number: ${aadhErr}`);
      }

      if (form.pan_number && form.pan_number.trim()) {
        const cleanPan = sanitizePanNumber(form.pan_number);
        const panErr = getPanValidationError(cleanPan, false);
        if (panErr) throw new Error(`Invalid PAN Number: ${panErr}`);
      }

      const fullPayload: any = {
        plot_id: plotId,
        lead_id: lead.id,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email || null,
        customer_address: form.customer_address || null,
        city: form.city || "Hubballi",
        pincode: form.pincode || "580029",
        landline: form.landline || null,
        occupation: form.occupation || "Business",
        aadhaar_number: form.aadhaar_number ? sanitizeAadhaarNumber(form.aadhaar_number) : null,
        pan_number: form.pan_number ? sanitizePanNumber(form.pan_number) : null,
        dob: form.dob || null,
        age: form.age ? Number(form.age) : null,
        gender: form.gender || "M",
        marital_status: form.marital_status === "Married",
        nominee_name: form.nominee_name || null,
        nominee_relationship: form.nominee_relationship || null,
        buying_purpose: form.buying_purpose || "Build Home",
        rate_per_sqft: form.rate_per_sqft ? Number(form.rate_per_sqft) : null,
        plot_area: form.plot_area ? Number(form.plot_area) : null,
        tc_name: form.tc_name || null,
        tc_place: form.tc_place || null,
        lead_name: form.lead_name || form.customer_name,
        closer_name: form.closer_name || null,
        agent_name: form.agent_name || null,
        receipt_number: form.receipt_number || null,
        receipt_date: form.receipt_date || null,
        booking_type: form.booking_type || "Personal",
        sales_executive_id: effectiveExecutiveId || ownerId,
        bdo_id: attribution.attributionType === "bdo" ? attribution.bdoId : null,
        external_bdo_name: attribution.attributionType === "manual_external" ? attribution.externalBdoName : null,
        attribution_type: attribution.attributionType,
        created_by: user.id,
        total_price: finalPrice,
        booking_amount: bookingAmount,
        advance_paid: advancePaid,
        payment_method: form.paymentMethod,
        installment_count: installmentCount,
        installment_amount: perInstallment,
        first_installment_due_date: form.firstDueDate || null,
        incentive_amount: incentive,
        agreed_incentive_amount: incentive,
        remarks: [form.remarks, `Payment plan: ${paymentPlan}`].filter(Boolean).join("\n\n"),
        approval_stage: "sales_head_approval",
        approval_history: initialHistory,
        status: "pending",
      };

      let newBooking: any = null;
      const { data: resData, error: firstErr } = await (supabase as any)
        .from("bookings")
        .insert(fullPayload)
        .select("id")
        .maybeSingle();

      if (firstErr) {
        console.warn("Full booking insert warning, trying core schema fallback:", firstErr);
        const extendedNotes = [
          form.remarks,
          `Payment plan: ${paymentPlan}`,
          `[Customer Profile] Age: ${form.age || "N/A"}, Gender: ${form.gender || "M"}, City: ${form.city || "Hubballi"}, Nominee: ${form.nominee_name || "N/A"}`,
          `[For Office Use Only] Lead: ${form.lead_name || lead.name}, TC: ${form.tc_name || "N/A"} (${form.tc_place || "N/A"}), Receipt: ${form.receipt_number || "N/A"} (Date: ${form.receipt_date || "N/A"}), Closer: ${form.closer_name || "N/A"}, Agent: ${form.agent_name || "N/A"}, Booking Type: ${form.booking_type || "Personal"}`
        ].filter(Boolean).join("\n\n");

        const corePayload: any = {
          plot_id: plotId,
          lead_id: lead.id,
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_email: form.customer_email || null,
          customer_address: form.customer_address || null,
          sales_executive_id: effectiveExecutiveId || ownerId,
          created_by: user.id,
          total_price: finalPrice,
          booking_amount: bookingAmount,
          advance_paid: advancePaid,
          payment_method: form.paymentMethod,
          installment_count: installmentCount,
          installment_amount: perInstallment,
          first_installment_due_date: form.firstDueDate || null,
          incentive_amount: incentive,
          agreed_incentive_amount: incentive,
          remarks: extendedNotes,
          approval_stage: "sales_head_approval",
          approval_history: initialHistory,
          status: "pending",
        };

        const { data: coreData, error: coreErr } = await (supabase as any)
          .from("bookings")
          .insert(corePayload)
          .select("id")
          .single();

        if (coreErr) throw coreErr;
        newBooking = coreData;
      } else {
        newBooking = resData;
      }

      // Auto-generate initial scheduled EMI line items
      if (newBooking?.id && installmentCount > 0 && finalPrice > advancePaid) {
        try {
          const netPrincipal = finalPrice - advancePaid;
          const baseShare = Math.floor(netPrincipal / installmentCount);
          const remainder = netPrincipal - baseShare * installmentCount;
          const startDateStr = form.firstDueDate || new Date().toISOString().slice(0, 10);
          
          const scheduleRows = [];
          for (let i = 0; i < installmentCount; i++) {
            const isLast = i === installmentCount - 1;
            const amt = isLast ? baseShare + remainder : baseShare;
            
            const [y, m, d] = startDateStr.split("-").map(Number);
            const targetMonth = m - 1 + i;
            const newYear = y + Math.floor(targetMonth / 12);
            const newMonth = (targetMonth % 12 + 12) % 12;
            const maxDays = new Date(newYear, newMonth + 1, 0).getDate();
            const finalDay = Math.min(d, maxDays);
            const dueDateStr = `${newYear}-${String(newMonth + 1).padStart(2, "0")}-${String(finalDay).padStart(2, "0")}`;

            scheduleRows.push({
              booking_id: newBooking.id,
              installment_number: i + 1,
              due_date: dueDateStr,
              amount: amt,
              notes: `Scheduled EMI #${i + 1}`,
              status: "pending"
            });
          }
          await (supabase as any).from("booking_installment_schedules").insert(scheduleRows);
        } catch (schErr) {
          console.warn("Initial schedule generation warning:", schErr);
        }
      }

      try {
        const { error: fullLeadErr } = await (supabase as any)
          .from("plot_leads")
          .update({
            status: "converted",
            name: form.customer_name,
            phone: form.customer_phone,
            email: form.customer_email || null,
            address: form.customer_address || null,
          })
          .eq("id", lead.id);
        if (fullLeadErr) throw fullLeadErr;
      } catch (err: any) {
        console.warn("Updating lead with address failed, executing schema fallback without address column:", err);
        const { error: fallbackLeadErr } = await (supabase as any)
          .from("plot_leads")
          .update({
            status: "converted",
            name: form.customer_name,
            phone: form.customer_phone,
            email: form.customer_email || null,
          })
          .eq("id", lead.id);
        if (fallbackLeadErr) {
          console.warn("Lead fallback update warning:", fallbackLeadErr);
        }
      }

      await (supabase as any).from("lead_activities").insert({
        lead_id: lead.id,
        activity_type: "converted",
        from_status: lead.status,
        to_status: "converted",
        notes: `Lead successfully converted to booking for Plot #${plot?.plot_number ?? "Site"}${
          plot?.projects?.name ? ` in ${plot.projects.name}` : ""
        } at final price ₹${finalPrice.toLocaleString("en-IN")}`,
        performed_by: user.id,
      });

      const plotName = plot?.plot_number ? `Plot ${plot.plot_number}` : "a plot";
      const projectName = plot?.projects?.name ? ` in ${plot.projects.name}` : "";

      await (supabase as any).from("user_notifications").insert({
        user_id: ownerId,
        title: "🎉 Booking Submitted!",
        message: `Your booking for ${form.customer_name} (${plotName}${projectName}) has been submitted and sent to Sales Head for approval.`,
        type: "booking",
        link: "/approvals",
      });

      // Auto dispatch WhatsApp confirmation
      try {
        const res = await sendBookingConfirmationWhatsApp({
          customerPhone: form.customer_phone.trim(),
          customerName: form.customer_name.trim(),
          projectName: plot?.projects?.name || "Project",
          plotNumber: plot?.plot_number || "Plot",
          totalPrice: finalPrice,
          bookingAmountPaid: advancePaid,
          bookingDate: new Date().toISOString(),
        });
        if (res.success) {
          toast.success("WhatsApp confirmation sent to customer!");
        } else if (res.deepLink) {
          toast.info("Open WhatsApp to send customer confirmation", {
            action: {
              label: "Open WhatsApp",
              onClick: () => window.open(res.deepLink, "_blank"),
            },
          });
        }
      } catch (err) {
        console.error("WhatsApp checkout dispatch error:", err);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Booking created & sent to Sales Head for approval!");
      nav({ to: "/approvals" });
    },
    onError: (error: any) => toast.error(error.message ?? "Unable to create booking"),
  });

  if (!leadId) {
    nav({ to: "/plots/$plotId/book", params: { plotId }, replace: true });
    return null;
  }

  return (
    <div className="h-[calc(100vh-5rem)] min-h-[650px] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between pb-5 shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/plots/$plotId/book" params={{ plotId }} className="rounded-lg border p-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Booking studio · Step 2 of 2</p>
            <h1 className="text-display text-3xl mt-1">Confirm the deal</h1>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-emerald-700">
          <ShieldCheck className="h-4 w-4" /> Lead ownership protected
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_385px] gap-5 flex-1 min-h-0">
        <section className="rounded-2xl border bg-card p-5 overflow-y-auto space-y-6">
          {/* Section 0: Attribution Selector */}
          <AttributionSelector
            value={attribution}
            onChange={setAttribution}
            defaultExecutiveId={ownerId || undefined}
            label="Deal Sourced By / Incentive Allotted To (Executive / BDO Partner)"
          />

          {/* Section 1: Customer Profile */}
          <div className="grid lg:grid-cols-2 gap-x-5 gap-y-4">
            <div className="lg:col-span-2 flex items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-terracotta" />
                <h2 className="font-semibold">Customer Profile</h2>
                <span className="text-xs text-muted-foreground">Auto-filled from selected lead</span>
              </div>
            </div>

            <Field label="Full name *">
              <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
            </Field>

            <Field label="Phone *">
              <PhoneInput
                value={form.customer_phone}
                onChange={(val) => set("customer_phone", val)}
                placeholder="98765 43210"
                required
              />
            </Field>

            <Field label="Email">
              <Input value={form.customer_email} onChange={(e) => set("customer_email", e.target.value)} />
            </Field>

            <Field label="Payment method">
              <Select value={form.paymentMethod} onValueChange={(value) => set("paymentMethod", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Bank transfer">Bank transfer</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Address" className="lg:col-span-2">
              <Textarea rows={2} value={form.customer_address} onChange={(e) => set("customer_address", e.target.value)} />
            </Field>

            <Field label="City">
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Hubballi" />
            </Field>

            <Field label="Pin Code (6 Digits)">
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="e.g. 580029"
                value={form.pincode}
                onChange={(e) => {
                  const rawDigits = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                  set("pincode", rawDigits);
                }}
                className="font-mono tracking-wider"
              />
            </Field>

            <Field label="Landline Contact (Optional)">
              <Input
                type="text"
                inputMode="tel"
                placeholder="e.g. 0836-224455"
                value={form.landline}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^0-9-]/g, "").slice(0, 15);
                  set("landline", clean);
                }}
                className="font-mono"
              />
            </Field>
          </div>

          {/* Section 2: Application Form Demographics */}
          <div className="grid lg:grid-cols-2 gap-x-5 gap-y-4 pt-3 border-t">
            <div className="lg:col-span-2 flex items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-terracotta" />
                <h2 className="font-semibold text-base">Application Form Demographics</h2>
                <span className="text-xs text-muted-foreground">Pre-fills Official Printed Document</span>
              </div>
            </div>

            <Field label="Occupation">
              <Select value={form.occupation} onValueChange={(val) => set("occupation", val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Private Employee">Private Employee</SelectItem>
                  <SelectItem value="Govt. Employee">Govt. Employee</SelectItem>
                  <SelectItem value="Retire Employee">Retire Employee</SelectItem>
                  <SelectItem value="Business">Business</SelectItem>
                  <SelectItem value="Professional">Professional</SelectItem>
                  <SelectItem value="Others">Others</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Aadhaar Number (12 Digits)">
              <AadhaarInput
                placeholder="e.g. 5432 1098 7654"
                value={form.aadhaar_number}
                onChange={(val) => set("aadhaar_number", val)}
              />
            </Field>

            <Field label="PAN Number (10 Characters)">
              <PanInput
                placeholder="e.g. ABCDE1234F"
                value={form.pan_number}
                onChange={(val) => set("pan_number", val)}
              />
            </Field>

            <Field label="Date of Birth (DOB)">
              <Input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.dob}
                onChange={(e) => {
                  const dobVal = e.target.value;
                  const todayStr = new Date().toISOString().slice(0, 10);
                  if (dobVal && dobVal > todayStr) {
                    toast.error("Date of Birth cannot be a future date.");
                    return;
                  }
                  const computedAge = calculateAge(dobVal);
                  setForm((current) => ({
                    ...current,
                    dob: dobVal,
                    age: computedAge || current.age,
                  }));
                }}
              />
            </Field>

            <Field label="Age (Auto-calculated)">
              <Input
                type="number"
                placeholder="Years (e.g. 35)"
                value={form.age}
                onChange={(e) => set("age", e.target.value)}
              />
              {form.dob && form.age && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                  ✓ Auto-computed from DOB ({form.age} years old)
                </p>
              )}
            </Field>

            <Field label="Gender">
              <Select value={form.gender} onValueChange={(val) => set("gender", val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Male</SelectItem>
                  <SelectItem value="F">Female</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Marital Status">
              <Select value={form.marital_status} onValueChange={(val) => set("marital_status", val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Married">Married</SelectItem>
                  <SelectItem value="Single">Single / Unmarried</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Plot Buying Purpose">
              <Select value={form.buying_purpose} onValueChange={(val) => set("buying_purpose", val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Build Home">Build Home</SelectItem>
                  <SelectItem value="Investment">Investment</SelectItem>
                  <SelectItem value="Gift">Gift</SelectItem>
                  <SelectItem value="Others">Others</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Nominee for Plot">
              <Input placeholder="Nominee full name" value={form.nominee_name} onChange={(e) => set("nominee_name", e.target.value)} />
            </Field>

            <Field label="Nominee Relationship">
              <Input placeholder="e.g. Spouse, Son, Daughter" value={form.nominee_relationship} onChange={(e) => set("nominee_relationship", e.target.value)} />
            </Field>

            <Field label="Rate Per Sq.Ft (₹) (Master Locked)">
              <Input
                type="text"
                value={
                  form.rate_per_sqft
                    ? `₹${Number(form.rate_per_sqft).toLocaleString("en-IN")}/sq.ft`
                    : plot?.rate_per_sqft
                      ? `₹${Number(plot.rate_per_sqft).toLocaleString("en-IN")}/sq.ft`
                      : plot?.price && plot?.area_sqft
                        ? `₹${Math.round(plot.price / plot.area_sqft).toLocaleString("en-IN")}/sq.ft`
                        : "—"
                }
                readOnly
                className="bg-muted text-muted-foreground cursor-not-allowed font-mono font-bold"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                🔒 Registered Master Layout Rate
              </p>
            </Field>

            <Field label="Plot Area (Sq.Ft) (Master Locked)">
              <Input
                type="text"
                value={
                  form.plot_area
                    ? `${Number(form.plot_area).toLocaleString("en-IN")} Sq.Ft`
                    : plot?.area_sqft
                      ? `${Number(plot.area_sqft).toLocaleString("en-IN")} Sq.Ft`
                      : "—"
                }
                readOnly
                className="bg-muted text-muted-foreground cursor-not-allowed font-mono font-bold"
              />
              {Number(form.plot_area || plot?.area_sqft) > 0 && (
                <p className="text-[11px] font-semibold text-terracotta mt-1 flex items-center gap-1">
                  📐 Equivalent Area: <strong>{(Number(form.plot_area || plot?.area_sqft) * 0.092903).toFixed(2)} sq.m</strong> (sq.meters)
                </p>
              )}
            </Field>
          </div>

          {/* Section 3: Price & Payment Plan */}
          <div className="grid lg:grid-cols-2 gap-x-5 gap-y-4">
            <div className="lg:col-span-2 flex items-center gap-2 pt-3 pb-2 border-b">
              <BadgeIndianRupee className="h-4 w-4 text-terracotta" />
              <h2 className="font-semibold">Price & payment plan</h2>
            </div>

            <Field label="Registered plot price">
              <Input
                type="text"
                value={listedPrice ? formatINRInput(listedPrice) : "0"}
                readOnly
                className="bg-muted text-muted-foreground cursor-not-allowed font-medium"
              />
            </Field>

            <Field label="Negotiated final price">
              <Input
                type="text"
                value={formatINRInput(form.finalPrice)}
                onChange={(e) => set("finalPrice", e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 5,40,00,000"
                className="font-medium"
              />
            </Field>

            <Field label="Concession made">
              <Input
                value={concession ? money(concession) : "No concession"}
                readOnly
                className={
                  concession
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 cursor-not-allowed font-medium"
                    : "bg-muted text-muted-foreground cursor-not-allowed font-medium"
                }
              />
            </Field>

            <Field label="Paid today / Booking Amount">
              <Input
                type="text"
                value={formatINRInput(form.advancePaid)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  const num = raw ? parseInt(raw, 10) : 0;
                  if (finalPrice > 0 && num > finalPrice) {
                    toast.warning(`Paid today cannot exceed the total plot price of ${money(finalPrice)}`);
                    set("advancePaid", String(finalPrice));
                  } else {
                    set("advancePaid", raw);
                  }
                }}
                placeholder="e.g. 5,00,000"
                className={`font-medium ${advancePaid > finalPrice ? "border-destructive ring-1 ring-destructive" : ""}`}
              />
              {advancePaid > finalPrice && (
                <p className="text-[11px] text-destructive font-semibold mt-1">
                  Paid today cannot exceed the total agreed price of {money(finalPrice)}
                </p>
              )}
            </Field>

            <Field label="Installments">
              <Select value={form.installments} onValueChange={(value) => set("installments", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 3, 6, 9, 12, 18, 24, 36].map((count) => (
                    <SelectItem key={count} value={String(count)}>
                      {count} {count === 1 ? "installment" : "installments"}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom amount…</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {form.installments === "custom" && (
              <Field label="Desired installments">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 15"
                  value={form.customInstallments}
                  onChange={(e) => set("customInstallments", e.target.value.replace(/[^0-9]/g, ""))}
                />
              </Field>
            )}

            <Field label="First installment due (Optional)">
              <Input type="date" value={form.firstDueDate} onChange={(e) => set("firstDueDate", e.target.value)} />
              <p className="text-[11px] text-muted-foreground mt-1">
                Set first due date now, or leave blank to configure later.
              </p>
            </Field>

            <Field label="Incentive Allotted (₹)">
              <Input
                type="text"
                value={form.incentive_amount !== "" ? formatINRInput(form.incentive_amount) : (calculatedIncentive ? formatINRInput(calculatedIncentive) : "")}
                onChange={(e) => set("incentive_amount", e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 50,000"
                className="font-medium text-emerald-700 dark:text-emerald-400"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Manager/Accountant allotted deal incentive amount.
              </p>
            </Field>
          </div>

          {/* Section 4: FOR OFFICE USE ONLY */}
          <div className="border-2 border-dashed border-terracotta/40 rounded-2xl p-5 bg-terracotta/[0.02] dark:bg-terracotta/[0.04] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-terracotta" />
                <h2 className="font-bold tracking-wide text-base text-foreground uppercase">
                  For Office Use Only
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-md bg-terracotta/10 text-terracotta border border-terracotta/20">
                  Internal Management & Audit
                </span>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-x-5 gap-y-4">
              {/* Lead Name (Auto-generated from lead) */}
              <Field label="Lead Name (Auto-generated from lead)">
                <Input
                  value={form.lead_name || lead?.name || form.customer_name}
                  onChange={(e) => set("lead_name", e.target.value)}
                  className="bg-muted/60 font-medium"
                />
                <p className="text-[11px] text-muted-foreground mt-0.5">Auto-populated from selected lead record</p>
              </Field>

              {/* TC Name (Telecaller) */}
              <Field label="TC Name (Telecaller)">
                <Input
                  placeholder="Telecaller full name"
                  value={form.tc_name}
                  onChange={(e) => set("tc_name", e.target.value)}
                />
              </Field>

              {/* TC Place / Location */}
              <Field label="TC Place / Location">
                <Input
                  placeholder="e.g. Hubballi Branch / Call Center A"
                  value={form.tc_place}
                  onChange={(e) => set("tc_place", e.target.value)}
                />
              </Field>

              {/* Receipt Date */}
              <Field label="Receipt Date">
                <Input
                  type="date"
                  value={form.receipt_date}
                  onChange={(e) => set("receipt_date", e.target.value)}
                />
              </Field>

              {/* Closer Name */}
              <Field label="Closer Name">
                <Input
                  placeholder="Deal closer executive name"
                  value={form.closer_name}
                  onChange={(e) => set("closer_name", e.target.value)}
                />
              </Field>

              {/* Receipt Number */}
              <Field label="Receipt Number">
                <Input
                  placeholder="e.g. REC-2026-0891"
                  value={form.receipt_number}
                  onChange={(e) => set("receipt_number", e.target.value)}
                />
              </Field>

              {/* Agent Name */}
              <Field label="Agent Name">
                <Input
                  placeholder="Assigned agent name"
                  value={form.agent_name}
                  onChange={(e) => set("agent_name", e.target.value)}
                />
              </Field>

              {/* Type of Booking */}
              <Field label="Type of Booking">
                <Select value={form.booking_type} onValueChange={(val) => set("booking_type", val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Personal">Personal</SelectItem>
                    <SelectItem value="Process">Process</SelectItem>
                    <SelectItem value="Corporate">Corporate / Bulk</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {/* Office Notes & Remarks */}
              <Field label="Office Notes & Remarks" className="lg:col-span-2">
                <Textarea
                  rows={3}
                  placeholder="Internal office remarks, payment verification notes, approval conditions..."
                  value={form.remarks}
                  onChange={(e) => set("remarks", e.target.value)}
                />
              </Field>
            </div>
          </div>
        </section>

        <aside className="rounded-2xl border bg-card p-5 flex flex-col overflow-y-auto">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-terracotta" />
            <p className="font-semibold">Deal summary</p>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <Summary label="Plot" value={`${plot?.projects?.name ?? "Project"} · ${plot?.plot_number ?? ""}`} />
            <Summary label="Registered price" value={money(listedPrice)} />
            <Summary label="Concession" value={concession ? `− ${money(concession)}` : "—"} highlight={concession > 0} />
            <div className="rounded-xl bg-terracotta/[0.07] p-3">
              <p className="text-xs text-muted-foreground">Final agreed price</p>
              <p className="text-2xl text-display mt-1">{money(finalPrice)}</p>
            </div>
            <Summary label="Paid today" value={money(advancePaid)} />
            <Summary label="Balance" value={money(balance)} />
            <div className="rounded-xl border border-dashed p-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-terracotta" />
                <div>
                  <p className="text-xs text-muted-foreground">Installment plan</p>
                  <p className="font-medium mt-0.5">
                    {installmentCount} × {money(perInstallment)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.14em] font-semibold text-muted-foreground">Deal Sourced By / Incentive</p>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  attribution.attributionType === "bdo"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : attribution.attributionType === "manual_external"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : "bg-terracotta/10 text-terracotta border-terracotta/20"
                }`}
              >
                {attribution.attributionType === "bdo"
                  ? "BDO Partner"
                  : attribution.attributionType === "manual_external"
                  ? "External Referral"
                  : attribution.internalExecutiveId && attribution.internalExecutiveId !== ownerId
                  ? "Selected Executive"
                  : "Lead Owner (Default)"}
              </span>
            </div>

            <div className="rounded-xl bg-muted/50 p-3 space-y-1">
              {attribution.attributionType === "bdo" ? (
                <>
                  <p className="font-semibold text-foreground">{selectedBdo?.name || "Selected BDO Partner"}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedBdo?.agency_name ? `Agency: ${selectedBdo.agency_name}` : "Outsourced BDO Partner"}
                    {selectedBdo?.bdo_code ? ` · ${selectedBdo.bdo_code}` : ""}
                    {selectedBdo?.phone ? ` · ${selectedBdo.phone}` : ""}
                  </p>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 pt-2">
                    Will receive {money(incentive)} incentive
                  </p>
                </>
              ) : attribution.attributionType === "manual_external" ? (
                <>
                  <p className="font-semibold text-foreground">{attribution.externalBdoName || "Manual External Entry"}</p>
                  <p className="text-xs text-muted-foreground">External Agent / Independent Partner</p>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 pt-2">
                    Will receive {money(incentive)} incentive
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-foreground">{effectiveExecutive?.full_name ?? owner?.full_name ?? "Loading executive…"}</p>
                  <p className="text-xs text-muted-foreground">
                    {effectiveExecutive?.job_title ?? owner?.job_title ?? "Sales executive"}
                    {(effectiveExecutive?.phone || owner?.phone) && ` · ${effectiveExecutive?.phone || owner?.phone}`}
                  </p>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 pt-2">
                    Will receive {money(incentive)} incentive
                  </p>
                </>
              )}
            </div>
          </div>

          <Button
            disabled={
              mutation.isPending ||
              !lead ||
              !ownerId ||
              !form.customer_name ||
              finalPrice <= 0 ||
              (form.installments === "custom" && !form.customInstallments)
            }
            onClick={() => mutation.mutate()}
            className="mt-auto w-full bg-terracotta text-accent-foreground hover:bg-terracotta/90 cursor-pointer"
          >
            {mutation.isPending ? "Creating booking…" : "Create booking"}
          </Button>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Summary({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "text-emerald-700 font-medium" : "font-medium text-right"}>{value}</span>
    </div>
  );
}
