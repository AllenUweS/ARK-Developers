import { useEffect, useState } from "react";
import { UserCheck, Phone, Mail, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  getPhoneValidationError,
  isValidEmail,
  sanitizePhoneInput,
  sanitizePositiveNumber,
} from "@/lib/formValidation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendBookingConfirmationWhatsApp } from "@/lib/whatsappService";
import { useQueryClient } from "@tanstack/react-query";
import type { PlotRow, PurchaserRecord } from "./types";

interface RecordPurchaserDialogProps {
  open: boolean;
  plot: PlotRow;
  userId: string;
  existingPurchaser?: PurchaserRecord | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RecordPurchaserDialog({
  open,
  plot,
  userId,
  existingPurchaser,
  onOpenChange,
  onSuccess,
}: RecordPurchaserDialogProps) {
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    customer_address: "",
    total_price: "",
    advance_paid: "",
    payment_method: "Bank transfer",
    booking_date: new Date().toISOString().split("T")[0],
    remarks: "",
  });

  useEffect(() => {
    if (open) {
      if (existingPurchaser) {
        setForm({
          customer_name: existingPurchaser.customer_name || "",
          customer_phone: existingPurchaser.customer_phone || "",
          customer_email: existingPurchaser.customer_email || "",
          customer_address: existingPurchaser.customer_address || "",
          total_price: (existingPurchaser.total_price ?? plot.price).toString(),
          advance_paid: (existingPurchaser.advance_paid ?? plot.price).toString(),
          payment_method: existingPurchaser.payment_method || "Bank transfer",
          booking_date: existingPurchaser.booking_date
            ? existingPurchaser.booking_date.split("T")[0]
            : new Date().toISOString().split("T")[0],
          remarks: existingPurchaser.remarks || "",
        });
      } else {
        setForm({
          customer_name: "",
          customer_phone: "",
          customer_email: "",
          customer_address: "",
          total_price: plot.price ? plot.price.toString() : "",
          advance_paid: plot.price ? plot.price.toString() : "",
          payment_method: "Bank transfer",
          booking_date: new Date().toISOString().split("T")[0],
          remarks: "",
        });
      }
    }
  }, [open, plot, existingPurchaser]);

  const set = (key: keyof typeof form, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_name.trim()) return toast.error("Customer name is required");

    const cleanPhone = sanitizePhoneInput(form.customer_phone);
    const phoneErr = getPhoneValidationError(cleanPhone);
    if (phoneErr) return toast.error(phoneErr);

    if (form.customer_email && form.customer_email.trim() && !isValidEmail(form.customer_email)) {
      return toast.error("Please enter a valid email address.");
    }

    setSubmitting(true);
    try {
      const totalPriceNum = parseFloat(form.total_price) || plot.price || 0;
      const advancePaidNum = parseFloat(form.advance_paid) || totalPriceNum;

      if (existingPurchaser?.id) {
        // Update existing booking record
        const { error: bookingErr } = await (supabase as any)
          .from("bookings")
          .update({
            customer_name: form.customer_name.trim(),
            customer_phone: cleanPhone,
            customer_email: form.customer_email.trim() || null,
            customer_address: form.customer_address.trim() || null,
            total_price: totalPriceNum,
            booking_amount: advancePaidNum,
            advance_paid: advancePaidNum,
            payment_method: form.payment_method,
            booking_date: form.booking_date,
            remarks: form.remarks.trim() || null,
          })
          .eq("id", existingPurchaser.id);

        if (bookingErr) throw bookingErr;
      } else {
        // Insert new approved booking for this sold plot
        const { error: bookingErr } = await (supabase as any).from("bookings").insert({
          plot_id: plot.id,
          customer_name: form.customer_name.trim(),
          customer_phone: form.customer_phone.trim(),
          customer_email: form.customer_email.trim() || null,
          customer_address: form.customer_address.trim() || null,
          sales_executive_id: userId,
          created_by: userId,
          total_price: totalPriceNum,
          booking_amount: advancePaidNum,
          advance_paid: advancePaidNum,
          payment_method: form.payment_method,
          booking_date: form.booking_date,
          status: "approved",
          remarks: form.remarks.trim() || "Recorded directly via project site mapper",
        });

        if (bookingErr) throw bookingErr;

        // Ensure plot status is set to 'sold'
        if (plot.status !== "sold") {
          const { error: plotErr } = await supabase
            .from("plots")
            .update({ status: "sold" })
            .eq("id", plot.id);
          if (plotErr) throw plotErr;
        }
      }

      // Sync matching plot_leads so customer details align in Leads tab as well
      const leadIdToUpdate = (existingPurchaser as any)?.lead_id || (existingPurchaser as any)?.lead?.id;
      const { data: existingLeads } = await (supabase as any)
        .from("plot_leads")
        .select("id")
        .or(`plot_id.eq.${plot.id}${leadIdToUpdate ? `,id.eq.${leadIdToUpdate}` : ""},phone.eq.${form.customer_phone.trim()}`);

      if (existingLeads && existingLeads.length > 0) {
        for (const l of existingLeads) {
          await (supabase as any).from("plot_leads").update({
            name: form.customer_name.trim(),
            phone: form.customer_phone.trim(),
            email: form.customer_email.trim() || null,
            plot_id: plot.id,
            project_id: plot.project_id,
            budget: totalPriceNum,
            status: "converted",
          }).eq("id", l.id);
        }
      } else {
        // Create new converted lead record so it appears in Leads tab
        await (supabase as any).from("plot_leads").insert({
          plot_id: plot.id,
          project_id: plot.project_id,
          name: form.customer_name.trim(),
          phone: form.customer_phone.trim(),
          email: form.customer_email.trim() || null,
          budget: totalPriceNum,
          status: "converted",
          source: "Site Mapper Purchaser Record",
          created_by: userId,
          assigned_to: userId,
        });
      }

      // Auto dispatch WhatsApp Booking Confirmation
      try {
        const res = await sendBookingConfirmationWhatsApp({
          customerPhone: form.customer_phone.trim(),
          customerName: form.customer_name.trim(),
          projectName: "Project Plot",
          plotNumber: plot.plot_number,
          totalPrice: totalPriceNum,
          bookingAmountPaid: Number(form.advance_paid) || 0,
        });
        if (res.success) {
          toast.success("WhatsApp Booking Confirmation Sent!");
        } else if (res.deepLink) {
          toast.info("Open WhatsApp to send confirmation", {
            action: {
              label: "Open WhatsApp",
              onClick: () => window.open(res.deepLink, "_blank"),
            },
          });
        }
      } catch (err) {
        console.error("WhatsApp dispatch error:", err);
      }

      toast.success(
        existingPurchaser ? "Purchaser info updated!" : "Purchaser details recorded successfully!"
      );
      // Invalidate all related caches so changes reflect immediately across all tabs
      qc.invalidateQueries({ queryKey: ["plots"] });
      qc.invalidateQueries({ queryKey: ["plots", plot.project_id] });
      qc.invalidateQueries({ queryKey: ["plot-purchaser", plot.id] });
      qc.invalidateQueries({ queryKey: ["project-bookings", plot.project_id] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["all_plot_leads"] });
      qc.invalidateQueries({ queryKey: ["plot-leads"] });
      qc.invalidateQueries({ queryKey: ["installment-bookings"] });
      qc.invalidateQueries({ queryKey: ["installment-payments"] });
      qc.invalidateQueries({ queryKey: ["user-notifications"] });
      qc.invalidateQueries({ queryKey: ["dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["incentives"] });
      qc.invalidateQueries({ queryKey: ["my-incentives"] });
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to record purchaser information");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">
                  {existingPurchaser ? "Edit Purchaser Info" : "Record Purchaser Info"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Plot <span className="font-semibold text-foreground">{plot.plot_number}</span> · Register the owner details for this sold plot.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-3 py-4 text-xs">
            <div>
              <Label className="text-xs font-medium">Customer Full Name *</Label>
              <div className="relative mt-1">
                <Input
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={form.customer_name}
                  onChange={(e) => set("customer_name", e.target.value)}
                  className="pl-8 text-xs"
                />
                <UserCheck className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-medium">Phone Number *</Label>
                <div className="mt-1">
                  <PhoneInput
                    value={form.customer_phone}
                    onChange={(val) => set("customer_phone", val)}
                    placeholder="98765 43210"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium">Email Address</Label>
                <div className="relative mt-1">
                  <Input
                    type="email"
                    placeholder="ramesh@example.com"
                    value={form.customer_email}
                    onChange={(e) => set("customer_email", e.target.value)}
                    className="pl-8 text-xs"
                  />
                  <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Customer Address</Label>
              <div className="relative mt-1">
                <Textarea
                  rows={2}
                  placeholder="Street, City, Pin code"
                  value={form.customer_address}
                  onChange={(e) => set("customer_address", e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-medium">Total Purchase Price (₹)</Label>
                <div className="mt-1">
                  <CurrencyInput
                    placeholder="45,00,000"
                    value={form.total_price}
                    onChange={(val) => set("total_price", val)}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium">Advance Paid (₹)</Label>
                <div className="mt-1">
                  <CurrencyInput
                    placeholder="5,00,000"
                    value={form.advance_paid}
                    onChange={(val) => set("advance_paid", val)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-medium">Payment Method</Label>
                <Select
                  value={form.payment_method}
                  onValueChange={(val) => set("payment_method", val)}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bank transfer" className="text-xs">Bank Transfer (NEFT/RTGS)</SelectItem>
                    <SelectItem value="UPI" className="text-xs">UPI / GPay / PhonePe</SelectItem>
                    <SelectItem value="Cheque" className="text-xs">Cheque</SelectItem>
                    <SelectItem value="Cash" className="text-xs">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium">Sale / Booking Date</Label>
                <div className="relative mt-1">
                  <Input
                    type="date"
                    value={form.booking_date}
                    onChange={(e) => set("booking_date", e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Remarks / Registration Notes</Label>
              <Textarea
                rows={2}
                placeholder="Registration details, deed numbers, or special terms..."
                value={form.remarks}
                onChange={(e) => set("remarks", e.target.value)}
                className="text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? "Saving..." : existingPurchaser ? "Update Owner Details" : "Save Purchaser Info"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
