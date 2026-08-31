import { useQuery } from "@tanstack/react-query";
import { History, Calendar, CheckCircle2, User, Landmark, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface IncentiveDisbursalHistoryModalProps {
  booking: any | null;
  executiveName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IncentiveDisbursalHistoryModal({
  booking,
  executiveName,
  open,
  onOpenChange,
}: IncentiveDisbursalHistoryModalProps) {
  const { data: disbursals = [], isLoading } = useQuery({
    queryKey: ["incentive-disbursals", booking?.id],
    enabled: !!booking?.id && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("incentive_disbursals")
        .select("*")
        .eq("booking_id", booking.id)
        .order("installment_number", { ascending: true });

      if (error) return [];
      return data ?? [];
    },
  });

  if (!booking) return null;

  const agreedTotal = Number(booking.agreed_incentive_amount ?? booking.incentive_amount ?? 0);
  const totalDisbursed = disbursals.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
  const remainingBalance = Math.max(0, agreedTotal - totalDisbursed);

  const money = (val: number) =>
    `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <History className="h-5 w-5 text-terracotta" />
            Incentive Disbursal Ledger & History
          </DialogTitle>
          <DialogDescription className="text-xs mt-1">
            Complete installment disbursal history for <strong>{executiveName || "Executive"}</strong> on Plot{" "}
            <strong>{booking.plots?.plot_number}</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Summary Card */}
        <div className="grid grid-cols-3 gap-2 p-3.5 rounded-xl bg-muted/40 border border-border shrink-0 my-3 font-mono text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase block font-sans">Agreed Total</span>
            <span className="font-bold text-foreground text-sm">{money(agreedTotal)}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase block font-sans">Total Disbursed</span>
            <span className="font-bold text-emerald-600 text-sm">{money(totalDisbursed)}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase block font-sans">Pending Balance</span>
            <span className="font-bold text-amber-600 text-sm">{money(remainingBalance)}</span>
          </div>
        </div>

        {/* Disbursals List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Loading disbursal history...
            </div>
          ) : disbursals.length === 0 ? (
            <div className="py-12 text-center space-y-2 text-muted-foreground border border-dashed rounded-xl">
              <Landmark className="h-8 w-8 mx-auto opacity-40 text-muted-foreground" />
              <p className="font-medium text-xs">No incentive installments disbursed yet</p>
              <p className="text-[11px]">
                Disbursals will appear here once the advance payment is verified and installments are released.
              </p>
            </div>
          ) : (
            disbursals.map((d: any) => (
              <div
                key={d.id}
                className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-bold px-2 py-0.5 text-[10px]">
                      Installment #{d.installment_number}
                    </Badge>
                    <span className="font-semibold text-foreground text-xs">{d.milestone_name}</span>
                  </div>
                  <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                    {money(Number(d.amount))}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground font-mono pt-1 border-t border-border/40">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span>
                      {new Date(d.disbursed_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Landmark className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span>Mode: {d.payment_method || "Bank Transfer"}</span>
                  </div>
                </div>

                {d.reference_number && (
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Ref No: <span className="text-foreground font-semibold">{d.reference_number}</span>
                  </p>
                )}

                {d.notes && (
                  <p className="text-[11px] text-muted-foreground italic bg-background/60 p-2 rounded border border-border/40">
                    &quot;{d.notes}&quot;
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        <div className="pt-3 border-t flex justify-end shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs px-4">
            Close History
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
