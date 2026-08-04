import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, BadgeIndianRupee, CalendarDays, CheckCircle2, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { LeadRow } from "@/components/site-mapper/types";

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
    finalPrice: "",
    advancePaid: "",
    installments: "12",
    customInstallments: "",
    firstDueDate: "",
    paymentMethod: "UPI",
    remarks: "",
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

  useEffect(() => {
    if (lead) {
      setForm((current) => ({
        ...current,
        customer_name: lead.name,
        customer_phone: lead.phone,
        customer_email: lead.email ?? "",
        remarks: lead.notes ?? "",
        finalPrice: current.finalPrice || String(plot?.price ?? ""),
      }));
    }
  }, [lead, plot?.price]);

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const listedPrice = Number(plot?.price ?? 0);
  const finalPrice = Number(form.finalPrice || listedPrice);
  const advancePaid = Number(form.advancePaid || 0);
  const bookingAmount = advancePaid; // Booking amount equals advance paid today
  const balance = Math.max(finalPrice - advancePaid, 0);
  const installmentCount = Math.max(Number(form.installments === "custom" ? form.customInstallments : form.installments) || 1, 1);
  const perInstallment = balance / installmentCount;
  const concession = Math.max(listedPrice - finalPrice, 0);
  const incentive = (finalPrice * Number(plot?.incentive_percentage ?? 0)) / 100;

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

      const paymentPlan = `${installmentCount} monthly installments of ${money(perInstallment)}${form.firstDueDate ? `, first due ${form.firstDueDate}` : ""
        }`;

      const { error } = await (supabase as any).from("bookings").insert({
        plot_id: plotId,
        lead_id: lead.id,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email || null,
        customer_address: form.customer_address || null,
        sales_executive_id: ownerId,
        created_by: user.id,
        total_price: finalPrice,
        booking_amount: bookingAmount,
        advance_paid: advancePaid,
        payment_method: form.paymentMethod,
        installment_count: installmentCount,
        installment_amount: perInstallment,
        first_installment_due_date: form.firstDueDate || null,
        incentive_amount: incentive,
        remarks: [form.remarks, `Payment plan: ${paymentPlan}`].filter(Boolean).join("\n\n"),
      });
      if (error) throw error;

      const { error: leadError } = await (supabase as any)
        .from("plot_leads")
        .update({
          status: "converted",
          name: form.customer_name,
          phone: form.customer_phone,
          email: form.customer_email || null,
        })
        .eq("id", lead.id);
      if (leadError) throw leadError;

      await (supabase as any).from("lead_activities").insert({
        lead_id: lead.id,
        activity_type: "converted",
        from_status: lead.status,
        to_status: "converted",
        notes: `Lead successfully converted to booking for Plot #${plot?.plot_number ?? "Site"}${plot?.projects?.name ? ` in ${plot.projects.name}` : ""
          } at final price ₹${finalPrice.toLocaleString("en-IN")}`,
        performed_by: user.id,
      });

      const plotName = plot?.plot_number ? `Plot ${plot.plot_number}` : "a plot";
      const projectName = plot?.projects?.name ? ` in ${plot.projects.name}` : "";
      await (supabase as any).from("user_notifications").insert({
        user_id: ownerId,
        title: "🎉 Lead Booked!",
        message: `Your lead ${form.customer_name} has booked ${plotName}${projectName} for ${money(finalPrice)}!`,
        type: "booking",
        link: "/installments",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Booking created and routed for approval.");
      nav({ to: "/bookings" });
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
        <section className="rounded-2xl border bg-card p-5 overflow-y-auto">
          <div className="grid lg:grid-cols-2 gap-x-5 gap-y-4">
            <div className="lg:col-span-2 flex items-center gap-2 pb-2 border-b">
              <UserRound className="h-4 w-4 text-terracotta" />
              <h2 className="font-semibold">Customer profile</h2>
              <span className="text-xs text-muted-foreground">Auto-filled from selected lead</span>
            </div>

            <Field label="Full name">
              <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
            </Field>

            <Field label="Phone">
              <Input value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} />
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
                onChange={(e) => set("advancePaid", e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 5,00,000"
                className="font-medium"
              />
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

            <Field label="Internal notes" className="lg:col-span-2">
              <Textarea rows={2} placeholder="Optional booking remarks or payment instructions..." value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
            </Field>
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

          <div className="mt-5 pt-5 border-t">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Lead owner · cannot edit</p>
            <div className="mt-3 rounded-xl bg-muted/50 p-3">
              <p className="font-semibold">{owner?.full_name ?? "Loading owner…"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {owner?.job_title ?? "Sales executive"}{owner?.phone && ` · ${owner.phone}`}
              </p>
              <p className="text-xs text-emerald-700 mt-3">
                Will receive {money(incentive)} incentive ({plot?.incentive_percentage ?? 0}% of final price)
              </p>
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
            className="mt-auto w-full bg-terracotta text-accent-foreground hover:bg-terracotta/90"
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
