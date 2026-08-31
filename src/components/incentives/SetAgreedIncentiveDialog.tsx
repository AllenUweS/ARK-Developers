import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, IndianRupee, User, Building2 } from "lucide-react";
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
import { toast } from "sonner";

interface SetAgreedIncentiveDialogProps {
  booking: any | null;
  executiveName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SetAgreedIncentiveDialog({
  booking,
  executiveName,
  open,
  onOpenChange,
  onSuccess,
}: SetAgreedIncentiveDialogProps) {
  const queryClient = useQueryClient();
  const [agreedAmount, setAgreedAmount] = useState<string>("");
  const [externalName, setExternalName] = useState<string>("");

  useEffect(() => {
    if (booking) {
      setAgreedAmount(
        String(booking.agreed_incentive_amount ?? booking.incentive_amount ?? "")
      );
      setExternalName(booking.external_bdo_name || "");
    }
  }, [booking, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!booking?.id) return;
      const numAmt = Number(agreedAmount);
      if (isNaN(numAmt) || numAmt < 0) {
        throw new Error("Please enter a valid agreed incentive amount.");
      }

      const updatePayload: any = {
        agreed_incentive_amount: numAmt,
        incentive_amount: numAmt,
        updated_at: new Date().toISOString(),
      };

      if (externalName.trim()) {
        updatePayload.external_bdo_name = externalName.trim();
        updatePayload.attribution_type = "manual_external";
      }

      const { error } = await (supabase as any)
        .from("bookings")
        .update(updatePayload)
        .eq("id", booking.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agreed incentive details updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["incentive-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update agreed incentive");
    },
  });

  if (!booking) return null;

  const currentAgreed = Number(booking.agreed_incentive_amount ?? booking.incentive_amount ?? 0);
  const unlock50Pct = Math.round(currentAgreed * 0.5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Sparkles className="h-5 w-5 text-terracotta" />
            Set Agreed Sales Incentive
          </DialogTitle>
          <DialogDescription className="text-xs mt-1">
            Manually configure or edit the agreed incentive recipient and structure for this deal.
          </DialogDescription>
        </DialogHeader>

        {/* Booking Summary Box */}
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1.5 text-xs my-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-terracotta" /> {executiveName || "Sales Executive"}
            </span>
            <span className="font-mono font-medium text-muted-foreground">
              Plot {booking.plots?.plot_number ?? "—"}
            </span>
          </div>
          <p className="text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" /> Project:{" "}
            <strong className="text-foreground">{booking.plots?.projects?.name || "Project"}</strong>
          </p>
          <p className="text-muted-foreground">
            Customer: <strong className="text-foreground">{booking.customer_name}</strong>
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ext-name" className="text-xs font-semibold text-foreground">
              Recipient Name (Manual BDO / External Partner)
            </Label>
            <Input
              id="ext-name"
              placeholder="e.g. Vinayak Patil (External Partner)"
              value={externalName}
              onChange={(e) => setExternalName(e.target.value)}
              className="text-xs font-medium"
            />
            <p className="text-[11px] text-muted-foreground">
              Specify or update manual external partner name, or leave as internal executive.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agreed-amt" className="text-xs font-semibold text-foreground">
              Agreed Incentive Amount (₹) *
            </Label>
            <CurrencyInput
              id="agreed-amt"
              placeholder="e.g. 50,000"
              value={agreedAmount}
              onChange={setAgreedAmount}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Once advance payment is received, <strong>50% (₹{(Number(agreedAmount || 0) * 0.5).toLocaleString("en-IN")})</strong> will be automatically unlocked for immediate release.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-terracotta/5 border border-terracotta/20 text-xs space-y-1">
            <span className="font-semibold text-terracotta block">Incentive Milestone Breakdown:</span>
            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
              <li>
                <strong>50% Initial Unlock:</strong> ₹{(Number(agreedAmount || 0) * 0.5).toLocaleString("en-IN")} upon Advance Payment.
              </li>
              <li>
                <strong>Remaining 50%:</strong> ₹{(Number(agreedAmount || 0) * 0.5).toLocaleString("en-IN")} payable in custom manual installments.
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !agreedAmount}
            className="bg-terracotta text-white hover:bg-terracotta/90"
          >
            {saveMutation.isPending ? "Saving..." : "Save Agreed Incentive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
