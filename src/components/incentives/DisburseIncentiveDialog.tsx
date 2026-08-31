import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Landmark, ArrowRight, ShieldCheck, Wallet, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
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

interface DisburseIncentiveDialogProps {
  booking: any | null;
  executiveName?: string;
  totalDisbursed: number;
  existingCount: number;
  user: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DisburseIncentiveDialog({
  booking,
  executiveName,
  totalDisbursed,
  existingCount,
  user,
  open,
  onOpenChange,
  onSuccess,
}: DisburseIncentiveDialogProps) {
  const queryClient = useQueryClient();

  const [disburseAmount, setDisburseAmount] = useState<string>("");
  const [milestoneName, setMilestoneName] = useState<string>("50% Advance Release");
  const [paymentMethod, setPaymentMethod] = useState<string>("Bank Transfer");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const agreedTotal = Number(booking?.agreed_incentive_amount ?? booking?.incentive_amount ?? 0);
  const isAdvancePaid = Boolean(
    booking && (Number(booking.advance_paid || 0) >= Number(booking.booking_amount || 0) || booking.status === "approved")
  );

  const initial50Pct = Math.round(agreedTotal * 0.5);
  const remainingMax = Math.max(0, agreedTotal - totalDisbursed);
  const isFirstDisbursal = existingCount === 0;

  useEffect(() => {
    if (booking && open) {
      if (isFirstDisbursal) {
        setDisburseAmount(String(initial50Pct > 0 ? initial50Pct : remainingMax));
        setMilestoneName("50% Advance Release");
      } else {
        setDisburseAmount(String(remainingMax));
        setMilestoneName(`Installment ${existingCount + 1}`);
      }
      setPaymentMethod("Bank Transfer");
      setReferenceNumber("");
      setNotes("");
    }
  }, [booking, open, existingCount, initial50Pct, remainingMax, isFirstDisbursal]);

  const disburseMutation = useMutation({
    mutationFn: async () => {
      if (!booking?.id) throw new Error("No booking selected");
      if (!booking.sales_executive_id) throw new Error("No sales executive assigned to this booking");
      if (!isAdvancePaid) throw new Error("Advance payment must be completed before disbursing incentives");

      const amt = Number(disburseAmount);
      if (isNaN(amt) || amt <= 0) throw new Error("Please enter a valid disbursal amount");
      if (amt > remainingMax) {
        throw new Error(`Amount cannot exceed remaining balance of ₹${remainingMax.toLocaleString("en-IN")}`);
      }

      // 1. Insert into incentive_disbursals
      const { error: disburseError } = await (supabase as any)
        .from("incentive_disbursals")
        .insert({
          booking_id: booking.id,
          employee_id: booking.sales_executive_id,
          amount: amt,
          installment_number: existingCount + 1,
          milestone_name: milestoneName.trim() || `Installment ${existingCount + 1}`,
          payment_method: paymentMethod,
          reference_number: referenceNumber.trim() || null,
          notes: notes.trim() || null,
          disbursed_by: user.id,
        });

      if (disburseError) throw disburseError;

      // 2. Also insert into legacy incentive_grants table if first grant for backwards compatibility
      if (isFirstDisbursal) {
        const { data: existingGrant } = await (supabase as any)
          .from("incentive_grants")
          .select("id")
          .eq("booking_id", booking.id)
          .maybeSingle();

        if (!existingGrant) {
          await (supabase as any).from("incentive_grants").insert({
            booking_id: booking.id,
            employee_id: booking.sales_executive_id,
            amount: amt,
            notes: notes.trim() || "First Installment Disbursal",
            granted_by: user.id,
          });
        }
      }
    },
    onSuccess: () => {
      toast.success(`Disbursed ₹${Number(disburseAmount).toLocaleString("en-IN")} incentive installment!`);
      queryClient.invalidateQueries({ queryKey: ["incentive-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["incentive-disbursals"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to disburse incentive");
    },
  });

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Landmark className="h-5 w-5 text-emerald-600" />
            Disburse Incentive Installment
          </DialogTitle>
          <DialogDescription className="text-xs mt-1">
            Record manual installment payout to executive <strong>{executiveName || "Executive"}</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Lock Warning if Advance Unpaid */}
        {!isAdvancePaid ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1 my-2">
            <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400">
              <Lock className="h-4 w-4 shrink-0" /> Advance Payment Pending
            </div>
            <p className="text-muted-foreground">
              Incentives can only be disbursed once customer completes advance payment (Current: ₹{Number(booking.advance_paid || 0).toLocaleString("en-IN")} / ₹{Number(booking.booking_amount || 0).toLocaleString("en-IN")}).
            </p>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1.5 my-1">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Advance Payment Verified
              </span>
              <span className="font-mono text-xs">50% Unlocked</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
              <div>
                <span className="text-[10px] uppercase text-muted-foreground block">Agreed Total</span>
                <span className="font-bold text-foreground">₹{agreedTotal.toLocaleString("en-IN")}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-muted-foreground block">Already Paid</span>
                <span className="font-bold text-emerald-600">₹{totalDisbursed.toLocaleString("en-IN")}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-muted-foreground block">Max Remaining</span>
                <span className="font-bold text-amber-600">₹{remainingMax.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3.5 my-2">
          {/* Row 1: Amount & Milestone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="disburse-amt" className="text-xs font-semibold text-foreground">
                Installment Amount (₹) *
              </Label>
              <CurrencyInput
                id="disburse-amt"
                value={disburseAmount}
                onChange={setDisburseAmount}
                disabled={!isAdvancePaid}
                placeholder={`Max: ${remainingMax.toLocaleString("en-IN")}`}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="milestone" className="text-xs font-semibold text-foreground">
                Milestone Name *
              </Label>
              <Input
                id="milestone"
                placeholder="e.g. 50% Advance Release"
                value={milestoneName}
                onChange={(e) => setMilestoneName(e.target.value)}
                disabled={!isAdvancePaid}
                className="text-xs"
              />
            </div>
          </div>

          {/* Quick preset buttons if 50% is available */}
          {isAdvancePaid && isFirstDisbursal && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground font-medium">Quick Preset:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10"
                onClick={() => {
                  setDisburseAmount(String(initial50Pct));
                  setMilestoneName("50% Advance Release");
                }}
              >
                50% Release (₹{initial50Pct.toLocaleString("en-IN")})
              </Button>
            </div>
          )}

          {/* Row 2: Payment Method & Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pay-method" className="text-xs font-semibold text-foreground">
                Payment Method
              </Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={!isAdvancePaid}>
                <SelectTrigger id="pay-method" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank Transfer">Bank Transfer (NEFT/RTGS)</SelectItem>
                  <SelectItem value="UPI">UPI / GPay / PhonePe</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="ref-no" className="text-xs font-semibold text-foreground">
                Transaction / Ref No
              </Label>
              <Input
                id="ref-no"
                placeholder="e.g. UTR12345678"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                disabled={!isAdvancePaid}
                className="h-9 font-mono text-xs"
              />
            </div>
          </div>

          {/* Row 3: Notes */}
          <div className="space-y-1">
            <Label htmlFor="disburse-notes" className="text-xs font-semibold text-foreground">
              Remarks / Disbursal Notes
            </Label>
            <Input
              id="disburse-notes"
              placeholder="e.g. Approved by Sales Head upon booking advance confirmation"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!isAdvancePaid}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => disburseMutation.mutate()}
            disabled={disburseMutation.isPending || !isAdvancePaid || Number(disburseAmount) <= 0}
            className="bg-emerald-600 text-white hover:bg-emerald-700 font-semibold gap-1.5"
          >
            <Wallet className="h-4 w-4" />
            {disburseMutation.isPending ? "Disbursing..." : "Confirm & Disburse"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
