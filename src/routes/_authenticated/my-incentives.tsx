import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  CheckCircle2,
  Gift,
  Sparkles,
  WalletCards,
  Clock,
  Lock,
  Unlock,
  Building2,
  Landmark,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/my-incentives")({
  beforeLoad: async ({ context }) => {
    if (typeof window === "undefined") return;
    let userId = (context as any)?.user?.id;
    if (!userId) {
      const { data: s } = await supabase.auth.getSession();
      userId = s?.session?.user?.id;
    }
    if (!userId) {
      throw redirect({ to: "/auth" });
    }
  },
  component: MyIncentivesPage,
});

type Booking = {
  id: string;
  customer_name: string;
  booking_date: string;
  booking_amount: number;
  advance_paid: number;
  agreed_incentive_amount: number | null;
  incentive_amount: number | null;
  status: string;
  plots: {
    plot_number: string;
    projects: { name: string } | null;
  } | null;
};

type IncentiveDisbursal = {
  id: string;
  booking_id: string;
  employee_id: string;
  amount: number;
  installment_number: number;
  milestone_name: string;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  disbursed_at: string;
};

const money = (amount: number) => `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function MyIncentivesPage() {
  const { user } = Route.useRouteContext();

  // Fetch executive's own bookings
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["my-bookings", user.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bookings")
        .select(
          "id, customer_name, booking_date, booking_amount, advance_paid, agreed_incentive_amount, incentive_amount, sales_executive_id, status, plots(plot_number, projects(name))"
        )
        .eq("sales_executive_id", user.id)
        .order("booking_date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Booking[];
    },
  });

  const bookingIds = useMemo(() => bookings.map((b) => b.id), [bookings]);

  // Fetch executive's incentive disbursals
  const { data: disbursals = [], isLoading: disbursalsLoading } = useQuery({
    queryKey: ["my-incentive-disbursals", bookingIds],
    enabled: bookingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("incentive_disbursals")
        .select("*")
        .in("booking_id", bookingIds)
        .order("disbursed_at", { ascending: false });

      if (error) return [];
      return (data ?? []) as IncentiveDisbursal[];
    },
  });

  const disbursalsByBooking = useMemo(() => {
    const map = new Map<string, IncentiveDisbursal[]>();
    for (const d of disbursals) {
      if (!map.has(d.booking_id)) map.set(d.booking_id, []);
      map.get(d.booking_id)!.push(d);
    }
    return map;
  }, [disbursals]);

  // Processed bookings with metrics
  const processedBookings = useMemo(() => {
    return bookings.map((b) => {
      const bDisbursals = disbursalsByBooking.get(b.id) || [];
      const agreedTotal = Number(b.agreed_incentive_amount ?? b.incentive_amount ?? 0);
      const isAdvancePaid =
        Number(b.advance_paid || 0) >= Number(b.booking_amount || 0) || b.status === "approved";
      const totalReceived = bDisbursals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
      const pendingBalance = Math.max(0, agreedTotal - totalReceived);
      const unlocked50Pct = isAdvancePaid ? Math.round(agreedTotal * 0.5) : 0;

      return {
        ...b,
        agreedTotal,
        isAdvancePaid,
        totalReceived,
        pendingBalance,
        unlocked50Pct,
        disbursals: bDisbursals,
      };
    });
  }, [bookings, disbursalsByBooking]);

  const totalAgreed = processedBookings.reduce((sum, b) => sum + b.agreedTotal, 0);
  const totalReceivedSum = processedBookings.reduce((sum, b) => sum + b.totalReceived, 0);
  const totalPendingBalance = processedBookings.reduce((sum, b) => sum + b.pendingBalance, 0);
  const unlocked50Sum = processedBookings.reduce((sum, b) => sum + b.unlocked50Pct, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          Your Achievements & Payouts
        </p>
        <h1 className="mt-1 text-display text-4xl font-extrabold tracking-tight">My Incentives</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track agreed rewards, 50% advance unlocks, installment payouts received, and pending balances for your plot sales.
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={Sparkles}
          label="Total Agreed Incentives"
          value={money(totalAgreed)}
          subtext={`${bookings.length} Plot Conversions`}
          tone="text-foreground"
        />
        <Metric
          icon={Unlock}
          label="50% Unlocked (Advance Paid)"
          value={money(unlocked50Sum)}
          subtext="Eligible for Payout"
          tone="text-amber-600"
        />
        <Metric
          icon={CheckCircle2}
          label="Total Received (Paid)"
          value={money(totalReceivedSum)}
          subtext={`${disbursals.length} Installments Paid`}
          tone="text-emerald-700"
        />
        <Metric
          icon={WalletCards}
          label="Pending Balance"
          value={money(totalPendingBalance)}
          subtext="Remaining Payout"
          tone="text-terracotta"
        />
      </div>

      {/* Disbursed Installments Ledger */}
      <section className="rounded-2xl border bg-card p-5 shadow-xs">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg text-foreground">Incentive Installments Received</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Itemized history of all incentive payments disbursed to your account.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-bold text-foreground">{disbursals.length}</span> payouts
          </p>
        </div>

        {disbursalsLoading || bookingsLoading ? (
          <p className="py-12 text-center text-xs text-muted-foreground">Loading your incentive payouts…</p>
        ) : disbursals.length === 0 ? (
          <div className="py-12 text-center border border-dashed rounded-xl bg-muted/20">
            <Gift className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-60" />
            <p className="font-semibold text-sm">No incentive payouts received yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Once advance payment is received on your plot bookings, your manager will disburse installments here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {disbursals.map((d) => {
              const bookingObj = bookings.find((b) => b.id === d.booking_id);
              return (
                <div key={d.id} className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2 text-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-bold px-2 py-0.5 text-[10px]">
                        Installment #{d.installment_number}
                      </Badge>
                      <h4 className="font-bold text-sm text-foreground mt-1">{d.milestone_name}</h4>
                    </div>
                    <span className="font-mono font-extrabold text-base text-emerald-600 dark:text-emerald-400">
                      {money(Number(d.amount))}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-background/60 border border-border/40 space-y-1">
                    <p className="font-semibold text-foreground">
                      Plot {bookingObj?.plots?.plot_number ?? "—"} • {bookingObj?.plots?.projects?.name || "Project"}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      Customer: {bookingObj?.customer_name || "Customer"}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-1">
                    <span>
                      {new Date(d.disbursed_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span>Mode: {d.payment_method || "Bank"}</span>
                  </div>

                  {d.reference_number && (
                    <p className="text-[11px] font-mono text-muted-foreground">
                      Ref: <strong className="text-foreground">{d.reference_number}</strong>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Plot Conversions Overview */}
      <section className="rounded-2xl border bg-card p-5 shadow-xs">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg text-foreground">My Plot Conversion Incentives Summary</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Status of advance payments, 50% initial unlocks, and balances for all your conversions.
            </p>
          </div>
        </div>

        {processedBookings.length === 0 ? (
          <div className="py-12 text-center border border-dashed rounded-xl bg-muted/20">
            <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-60" />
            <p className="font-semibold text-sm">No plot bookings assigned yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your plot bookings and agreed incentives will be listed here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {processedBookings.map((item) => (
              <div key={item.id} className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Plot {item.plots?.plot_number ?? "—"}</h4>
                    <p className="text-xs text-muted-foreground">{item.plots?.projects?.name || "Project"}</p>
                  </div>
                  {item.isAdvancePaid ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px]">
                      50% Unlocked
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-[10px]">
                      Advance Pending
                    </Badge>
                  )}
                </div>

                <div className="p-2.5 rounded-lg bg-muted/40 text-xs space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Customer:</span>
                    <span className="font-semibold text-foreground">{item.customer_name}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Advance Status:</span>
                    <span className={`font-mono font-bold ${item.isAdvancePaid ? "text-emerald-600" : "text-amber-600"}`}>
                      {money(Number(item.advance_paid || 0))} / {money(Number(item.booking_amount || 0))}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 pt-1 font-mono text-[11px]">
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground font-sans block">Agreed</span>
                    <span className="font-bold text-foreground">{money(item.agreedTotal)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground font-sans block">Received</span>
                    <span className="font-bold text-emerald-600">{money(item.totalReceived)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground font-sans block">Pending</span>
                    <span className="font-bold text-amber-600">{money(item.pendingBalance)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  subtext,
  tone,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string | number;
  subtext: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-xs">
      <Icon className={`h-5 w-5 ${tone}`} />
      <p className="mt-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold font-mono ${tone}`}>{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{subtext}</p>
    </div>
  );
}
