import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Gift,
  Search,
  Sparkles,
  WalletCards,
  Lock,
  Unlock,
  Pencil,
  History,
  Landmark,
  Plus,
  Building2,
  User,
  ShieldCheck,
  Clock,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SetAgreedIncentiveDialog } from "@/components/incentives/SetAgreedIncentiveDialog";
import { DisburseIncentiveDialog } from "@/components/incentives/DisburseIncentiveDialog";
import { IncentiveDisbursalHistoryModal } from "@/components/incentives/IncentiveDisbursalHistoryModal";
import { BdoDirectoryModal } from "@/components/bdo/BdoDirectoryModal";

export const Route = createFileRoute("/_authenticated/incentives")({
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

    const { data: role } = await supabase.rpc("get_primary_role", { _user_id: userId });
    if (
      role !== "admin" &&
      role !== "super_admin" &&
      role !== "manager" &&
      role !== "management" &&
      (role as string) !== "sales_head" &&
      role !== "accounts"
    ) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: IncentivesPage,
});

type IncentiveBooking = {
  id: string;
  plot_id?: string | null;
  customer_name: string;
  booking_date: string;
  booking_amount: number;
  advance_paid: number;
  agreed_incentive_amount: number | null;
  incentive_amount: number | null;
  sales_executive_id: string | null;
  bdo_id?: string | null;
  external_bdo_name?: string | null;
  attribution_type?: string | null;
  remarks?: string | null;
  status: string;
  plots: { plot_number: string; projects: { name: string } | null } | null;
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

type ProcessedIncentiveBooking = IncentiveBooking & {
  agreedTotal: number;
  isAdvancePaid: boolean;
  totalDisbursed: number;
  remainingBalance: number;
  unlocked50Pct: number;
  disbursals: IncentiveDisbursal[];
  stage: "locked" | "unlocked_50" | "partially_paid" | "fully_paid";
};

const money = (amount: number) => `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function IncentivesPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "locked" | "unlocked" | "paid">("all");
  const [bdoDirectoryOpen, setBdoDirectoryOpen] = useState(false);

  const [setAgreedBooking, setSetAgreedBooking] = useState<ProcessedIncentiveBooking | IncentiveBooking | null>(null);
  const [disburseBooking, setDisburseBooking] = useState<ProcessedIncentiveBooking | null>(null);
  const [historyBooking, setHistoryBooking] = useState<ProcessedIncentiveBooking | null>(null);

  // Fetch bookings
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["incentive-bookings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bookings")
        .select(
          "id, plot_id, customer_name, booking_date, booking_amount, advance_paid, agreed_incentive_amount, incentive_amount, sales_executive_id, bdo_id, external_bdo_name, attribution_type, remarks, status, plots(plot_number, projects(name))"
        )
        .order("booking_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as IncentiveBooking[];
    },
  });

  const bookingIds = useMemo(() => bookings.map((b) => b.id), [bookings]);

  // Fetch all incentive disbursals
  const { data: disbursals = [] } = useQuery({
    queryKey: ["all-incentive-disbursals", bookingIds],
    enabled: bookingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("incentive_disbursals")
        .select("*")
        .in("booking_id", bookingIds)
        .order("disbursed_at", { ascending: true });
      if (error) return [];
      return (data ?? []) as IncentiveDisbursal[];
    },
  });

  // Map disbursals per booking
  const disbursalsByBooking = useMemo(() => {
    const map = new Map<string, IncentiveDisbursal[]>();
    for (const d of disbursals) {
      if (!map.has(d.booking_id)) map.set(d.booking_id, []);
      map.get(d.booking_id)!.push(d);
    }
    return map;
  }, [disbursals]);

  // Executive Profiles
  const executiveIds = useMemo(
    () => [...new Set(bookings.map((b) => b.sales_executive_id).filter(Boolean))],
    [bookings]
  );
  const { data: profiles = [] } = useQuery({
    queryKey: ["incentive-profiles", executiveIds],
    enabled: executiveIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", executiveIds as string[]);
      if (error) throw error;
      return data ?? [];
    },
  });
  const profileNames = new Map(profiles.map((p) => [p.id, p.full_name || "Sales Executive"]));

type BdoPartnerSimple = {
  id: string;
  name: string;
  agency_name: string | null;
  bdo_code: string | null;
};

  // Fetch BDO Partners for mapping
  const { data: bdoPartners = [] } = useQuery({
    queryKey: ["all-bdo-partners"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("bdo_partners").select("id, name, agency_name, bdo_code");
      return (data ?? []) as BdoPartnerSimple[];
    },
  });
  const bdoMap = useMemo(() => new Map<string, BdoPartnerSimple>(bdoPartners.map((b) => [b.id, b])), [bdoPartners]);

  // Processed bookings with metrics & plot deduplication
  const processedBookings = useMemo<ProcessedIncentiveBooking[]>(() => {
    const seenPlots = new Set<string>();
    const deduplicatedBookings: IncentiveBooking[] = [];

    for (const b of bookings) {
      if (b.status === "cancelled" || b.status === "rejected") continue;
      const key = `${b.plot_id}_${(b.customer_name || "").toLowerCase().trim()}`;
      if (seenPlots.has(key)) continue;
      seenPlots.add(key);
      deduplicatedBookings.push(b);
    }

    return deduplicatedBookings.map((b) => {
      const bDisbursals = disbursalsByBooking.get(b.id) || [];
      
      let agreedTotal = Number(b.agreed_incentive_amount ?? b.incentive_amount ?? 0);
      if (agreedTotal === 0 && b.remarks) {
        const matchInc = b.remarks.match(/Incentive[^\d]*(\d[\d,]*)/i);
        if (matchInc && matchInc[1]) {
          agreedTotal = Number(matchInc[1].replace(/,/g, ""));
        }
      }

      const isAdvancePaid =
        Number(b.advance_paid || 0) >= Number(b.booking_amount || 0) || b.status === "approved";
      const totalDisbursed = bDisbursals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
      const remainingBalance = Math.max(0, agreedTotal - totalDisbursed);
      const unlocked50Pct = isAdvancePaid ? Math.round(agreedTotal * 0.5) : 0;

      let stage: "locked" | "unlocked_50" | "partially_paid" | "fully_paid" = "locked";
      if (!isAdvancePaid) {
        stage = "locked";
      } else if (totalDisbursed >= agreedTotal && agreedTotal > 0) {
        stage = "fully_paid";
      } else if (totalDisbursed > 0) {
        stage = "partially_paid";
      } else {
        stage = "unlocked_50";
      }

      return {
        ...b,
        agreedTotal,
        isAdvancePaid,
        totalDisbursed,
        remainingBalance,
        unlocked50Pct,
        disbursals: bDisbursals,
        stage,
      };
    });
  }, [bookings, disbursalsByBooking]);

  // Overall metrics
  const totalAgreed = processedBookings.reduce((sum, b) => sum + b.agreedTotal, 0);
  const totalUnlocked50 = processedBookings.reduce((sum, b) => sum + b.unlocked50Pct, 0);
  const totalDisbursedSum = processedBookings.reduce((sum, b) => sum + b.totalDisbursed, 0);
  const totalPendingBalance = processedBookings.reduce((sum, b) => sum + b.remainingBalance, 0);

  // Filtered bookings
  const filteredBookings = processedBookings.filter((b) => {
    let statusMatches = true;
    if (statusFilter === "locked") statusMatches = b.stage === "locked";
    if (statusFilter === "unlocked") statusMatches = b.stage === "unlocked_50" || b.stage === "partially_paid";
    if (statusFilter === "paid") statusMatches = b.stage === "fully_paid";

    const bdoObj = b.bdo_id ? bdoMap.get(b.bdo_id) : null;
    const terms = [
      profileNames.get(b.sales_executive_id ?? ""),
      bdoObj?.name,
      bdoObj?.agency_name,
      b.external_bdo_name,
      b.customer_name,
      b.plots?.plot_number,
      b.plots?.projects?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return statusMatches && terms.includes(search.trim().toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            Sales Performance & Recognition
          </p>
          <h1 className="mt-1 text-display text-4xl font-extrabold tracking-tight">
            Incentives & Commission Vault
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sales Head & Manager control room for manual incentive entry, 50% advance unlock tracking, and installment disbursals for Executives and BDO Partners.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setBdoDirectoryOpen(true)}
            variant="outline"
            className="border-terracotta/40 text-terracotta hover:bg-terracotta/10 font-semibold gap-1.5 h-12 px-4 shadow-xs"
          >
            <Users className="h-4 w-4" /> BDO Partners Directory
          </Button>

          <div className="rounded-2xl border bg-card p-3 px-4 text-right shadow-xs border-terracotta/20">
            <p className="text-xs text-muted-foreground font-medium">Pending Payout Balance</p>
            <p className="text-xl font-extrabold text-terracotta font-mono">{money(totalPendingBalance)}</p>
          </div>
        </div>
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={Sparkles}
          label="Total Agreed Incentives"
          value={money(totalAgreed)}
          subtext={`${processedBookings.length} Plot Conversions`}
          tone="text-foreground"
        />
        <Metric
          icon={Unlock}
          label="50% Unlocked (Advance Paid)"
          value={money(totalUnlocked50)}
          subtext="Eligible for Payout"
          tone="text-amber-600"
        />
        <Metric
          icon={CheckCircle2}
          label="Total Disbursed (Paid Out)"
          value={money(totalDisbursedSum)}
          subtext={`${disbursals.length} Installments Paid`}
          tone="text-emerald-700"
        />
        <Metric
          icon={WalletCards}
          label="Pending Disbursal Balance"
          value={money(totalPendingBalance)}
          subtext="To be Released"
          tone="text-terracotta"
        />
      </div>

      {/* Main Table Section */}
      <section className="rounded-2xl border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-bold text-lg text-foreground">Sales Conversion Incentives</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Manual incentive entry by Sales Head/Manager. 50% unlocks upon advance payment, followed by installment releases.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-bold text-foreground">{filteredBookings.length}</span> deals
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-4 flex flex-col gap-3 border-y py-4 lg:flex-row lg:items-center lg:justify-between border-border/60">
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
              placeholder="Search executive, customer, plot, project..."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All Deals", processedBookings.length],
                ["locked", "🔒 Advance Pending", processedBookings.filter((b) => b.stage === "locked").length],
                ["unlocked", "🔓 50% Unlocked", processedBookings.filter((b) => b.stage === "unlocked_50" || b.stage === "partially_paid").length],
                ["paid", "✅ Fully Paid", processedBookings.filter((b) => b.stage === "fully_paid").length],
              ] as const
            ).map(([value, label, count]) => (
              <Button
                key={value}
                size="sm"
                variant={statusFilter === value ? "default" : "outline"}
                onClick={() => setStatusFilter(value)}
                className={`h-8 text-xs ${
                  statusFilter === value
                    ? "bg-terracotta text-white hover:bg-terracotta/90"
                    : ""
                }`}
              >
                {label}
                <span className="ml-1.5 rounded-full bg-muted/60 px-1.5 py-0.2 text-[10px] font-mono">
                  {count}
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* Cards Grid */}
        {isLoading ? (
          <p className="py-16 text-center text-xs text-muted-foreground">Loading incentive deals…</p>
        ) : bookings.length === 0 ? (
          <EmptyState
            title="No plot bookings registered yet"
            description="Incentives will appear here as soon as plot bookings are created."
          />
        ) : filteredBookings.length === 0 ? (
          <EmptyState
            title="No incentive deals match your search filters"
            description="Try adjusting your search terms or filter selection."
          />
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {filteredBookings.map((b) => {
              const execName = profileNames.get(b.sales_executive_id ?? "") || "Sales Executive";
              const bdoObj = b.bdo_id ? bdoMap.get(b.bdo_id) : null;
              
              let extNameFromRemarks = "";
              if (b.remarks) {
                const matchExt = b.remarks.match(/(?:External BDO|Ext BDO|Sourced By|Manual Entry):\s*([^,\n\(\)]+)/i);
                if (matchExt && matchExt[1]) {
                  extNameFromRemarks = matchExt[1].trim();
                }
              }

              const displayHeaderName =
                b.attribution_type === "manual_external" && (b.external_bdo_name || extNameFromRemarks)
                  ? (b.external_bdo_name || extNameFromRemarks)
                  : b.attribution_type === "bdo" && (bdoObj?.name || b.external_bdo_name || extNameFromRemarks)
                  ? (bdoObj?.name || b.external_bdo_name || extNameFromRemarks)
                  : (b.external_bdo_name || extNameFromRemarks || execName);

              return (
                <article
                  key={b.id}
                  className={`flex flex-col rounded-2xl border p-5 transition-all shadow-xs hover:shadow-md ${
                    b.stage === "fully_paid"
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : b.stage === "unlocked_50" || b.stage === "partially_paid"
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "bg-card border-border"
                  }`}
                >
                  {/* Executive Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-base text-foreground leading-tight">{displayHeaderName}</h4>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        {b.plots?.projects?.name || "Project"} • Plot {b.plots?.plot_number || "—"}
                      </p>
                      {b.attribution_type === "bdo" && (
                        <Badge variant="outline" className="mt-1.5 bg-terracotta/10 text-terracotta border-terracotta/30 text-[10px] font-semibold gap-1">
                          <Users className="h-3 w-3" /> BDO Partner (Lead: {execName})
                        </Badge>
                      )}
                      {b.attribution_type === "manual_external" && (
                        <Badge variant="outline" className="mt-1.5 bg-amber-500/10 text-amber-700 border-amber-500/30 text-[10px] font-semibold gap-1">
                          <Users className="h-3 w-3" /> External BDO (Lead: {execName})
                        </Badge>
                      )}
                      {(!b.attribution_type || b.attribution_type === "internal") && (
                        <Badge variant="outline" className="mt-1.5 bg-blue-500/10 text-blue-700 border-blue-500/30 text-[10px] font-semibold gap-1">
                          <User className="h-3 w-3" /> Internal Executive
                        </Badge>
                      )}
                    </div>
                    <StageBadge stage={b.stage} />
                  </div>

                  {/* Customer & Advance Payment Status Box */}
                  <div className="mt-4 p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground font-medium">Customer</span>
                      <span className="font-semibold text-foreground truncate max-w-[140px]">
                        {b.customer_name}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-border/40">
                      <span className="text-muted-foreground font-medium">Advance Payment</span>
                      <span
                        className={`font-mono font-bold ${
                          b.isAdvancePaid ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        {money(Number(b.advance_paid || 0))} / {money(Number(b.booking_amount || 0))}
                      </span>
                    </div>
                  </div>

                  {/* Incentive Amounts Metrics */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Agreed Incentive
                        </span>
                        <span className="text-xl font-extrabold text-foreground font-mono">
                          {money(b.agreedTotal)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-terracotta hover:bg-terracotta/10 gap-1"
                        onClick={() => setSetAgreedBooking(b)}
                        title="Set or Edit Agreed Incentive Amount"
                      >
                        <Pencil className="h-3 w-3" /> Edit Agreed
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-background border border-border/60 font-mono text-[11px]">
                      <div>
                        <span className="text-[10px] uppercase text-muted-foreground font-sans block">
                          Total Disbursed
                        </span>
                        <span className="font-bold text-emerald-600">{money(b.totalDisbursed)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-muted-foreground font-sans block">
                          Remaining Balance
                        </span>
                        <span className="font-bold text-amber-600">{money(b.remainingBalance)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs px-2.5 gap-1"
                      onClick={() => setHistoryBooking(b)}
                    >
                      <History className="h-3.5 w-3.5 text-muted-foreground" />
                      History ({b.disbursals.length})
                    </Button>

                    <Button
                      size="sm"
                      disabled={!b.isAdvancePaid || b.remainingBalance <= 0}
                      onClick={() => setDisburseBooking(b)}
                      className={`h-8 text-xs font-semibold gap-1.5 px-3 ${
                        b.remainingBalance <= 0
                          ? "bg-muted text-muted-foreground"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      }`}
                    >
                      <Landmark className="h-3.5 w-3.5" />
                      {b.remainingBalance <= 0 ? "Fully Disbursed" : "Disburse Installment"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Set Agreed Incentive Dialog */}
      {setAgreedBooking && (
        <SetAgreedIncentiveDialog
          booking={setAgreedBooking}
          executiveName={profileNames.get(setAgreedBooking.sales_executive_id ?? "")}
          open={!!setAgreedBooking}
          onOpenChange={(open) => !open && setSetAgreedBooking(null)}
        />
      )}

      {/* Disburse Installment Dialog */}
      {disburseBooking && (
        <DisburseIncentiveDialog
          booking={disburseBooking}
          executiveName={profileNames.get(disburseBooking.sales_executive_id ?? "")}
          totalDisbursed={disburseBooking.totalDisbursed}
          existingCount={disburseBooking.disbursals.length}
          user={user}
          open={!!disburseBooking}
          onOpenChange={(open) => !open && setDisburseBooking(null)}
        />
      )}

      {/* History Ledger Modal */}
      {historyBooking && (
        <IncentiveDisbursalHistoryModal
          booking={historyBooking}
          executiveName={profileNames.get(historyBooking.sales_executive_id ?? "")}
          open={!!historyBooking}
          onOpenChange={(open) => !open && setHistoryBooking(null)}
        />
      )}

      {/* BDO Directory Modal */}
      <BdoDirectoryModal
        open={bdoDirectoryOpen}
        onOpenChange={setBdoDirectoryOpen}
      />
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

function StageBadge({ stage }: { stage: string }) {
  if (stage === "locked") {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-[10px] px-2 py-0.5 font-semibold">
        <Lock className="h-2.5 w-2.5" /> Advance Pending
      </Badge>
    );
  }
  if (stage === "unlocked_50") {
    return (
      <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1 text-[10px] px-2 py-0.5 font-semibold">
        <Unlock className="h-2.5 w-2.5" /> 50% Unlocked
      </Badge>
    );
  }
  if (stage === "partially_paid") {
    return (
      <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30 gap-1 text-[10px] px-2 py-0.5 font-semibold">
        <ShieldCheck className="h-2.5 w-2.5" /> Partial Paid
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-600 text-white border-0 gap-1 text-[10px] px-2 py-0.5 font-semibold">
      <CheckCircle2 className="h-2.5 w-2.5" /> Fully Paid
    </Badge>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-16 text-center border border-dashed rounded-2xl bg-muted/20">
      <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-60" />
      <p className="font-semibold text-sm">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
