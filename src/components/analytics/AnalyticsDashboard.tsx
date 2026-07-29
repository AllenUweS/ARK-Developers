import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp,
  IndianRupee,
  Building2,
  Award,
  Users,
  Target,
  RefreshCw,
  Sparkles,
  PieChart,
  BadgeCheck,
  Calendar,
  Layers,
  ArrowUpRight,
  Landmark,
} from "lucide-react";
import { StatCard } from "./StatCard";
import { RevenueChart } from "./RevenueChart";
import { SalesChart } from "./SalesChart";
import { IncentivesChart } from "./IncentivesChart";
import { ProjectPerformanceTable } from "./ProjectPerformanceTable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export function AnalyticsDashboard() {
  const qc = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [timeframe, setTimeframe] = useState<string>("all");

  // 1. Fetch Projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["analytics_projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, code, status")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // 2. Fetch Plots
  const { data: rawPlots = [], isLoading: plotsLoading } = useQuery({
    queryKey: ["analytics_plots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plots")
        .select("id, project_id, status, price, area_sqft, rate_per_sqft");
      if (error) throw error;
      return data ?? [];
    },
  });

  // 3. Fetch Bookings
  const { data: rawBookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["analytics_bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id,
          total_price,
          advance_paid,
          booking_amount,
          booking_date,
          status,
          plot_id,
          plot:plots(project_id)
        `)
        .order("booking_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // 4. Fetch Incentives
  const { data: rawIncentives = [], isLoading: incentivesLoading } = useQuery({
    queryKey: ["analytics_incentives"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("incentive_grants")
        .select(`
          id,
          amount,
          granted_at,
          employee:profiles!incentive_grants_employee_id_fkey(full_name)
        `)
        .order("granted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // 5. Fetch Leads
  const { data: rawLeads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["analytics_leads"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("plot_leads")
        .select("id, project_id, status, created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const isLoading =
    projectsLoading || plotsLoading || bookingsLoading || incentivesLoading || leadsLoading;

  // Filtered dataset according to project selector & timeframe
  const plots = useMemo(() => {
    if (selectedProjectId === "all") return rawPlots;
    return rawPlots.filter((p) => p.project_id === selectedProjectId);
  }, [rawPlots, selectedProjectId]);

  const bookings = useMemo(() => {
    return rawBookings.filter((b: any) => {
      const matchesProject =
        selectedProjectId === "all" || b.plot?.project_id === selectedProjectId;
      if (!matchesProject) return false;

      if (timeframe === "all" || !b.booking_date) return true;
      const bDate = new Date(b.booking_date);
      const now = new Date();

      if (timeframe === "month") {
        return (
          bDate.getMonth() === now.getMonth() && bDate.getFullYear() === now.getFullYear()
        );
      }
      if (timeframe === "quarter") {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const bQuarter = Math.floor(bDate.getMonth() / 3);
        return currentQuarter === bQuarter && bDate.getFullYear() === now.getFullYear();
      }
      if (timeframe === "year") {
        return bDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [rawBookings, selectedProjectId, timeframe]);

  const incentives = useMemo(() => {
    if (timeframe === "all") return rawIncentives;
    const now = new Date();
    return rawIncentives.filter((i: any) => {
      if (!i.granted_at) return true;
      const date = new Date(i.granted_at);
      if (timeframe === "month") {
        return (
          date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
        );
      }
      if (timeframe === "year") {
        return date.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [rawIncentives, timeframe]);

  // Metric Computations
  const totalPlotsCount = plots.length;
  const soldPlotsCount = plots.filter((p) => p.status === "sold").length;
  const bookedPlotsCount = plots.filter((p) => p.status === "booked").length;
  const reservedPlotsCount = plots.filter((p) => p.status === "reserved").length;
  const availablePlotsCount = plots.filter((p) => p.status === "available").length;

  const totalCashCollected = bookings.reduce(
    (sum: number, b: any) => sum + (Number(b.advance_paid) || 0),
    0
  );
  const totalCommittedValue = bookings.reduce(
    (sum: number, b: any) => sum + (Number(b.total_price) || 0),
    0
  );
  const totalIncentivesPaid = incentives.reduce(
    (sum: number, i: any) => sum + (Number(i.amount) || 0),
    0
  );

  const availableInventoryValue = plots
    .filter((p) => p.status === "available")
    .reduce((sum: number, p: any) => sum + (Number(p.price) || 0), 0);

  const totalLeadsCount = rawLeads.length;
  const convertedLeadsCount = rawLeads.filter((l: any) => l.status === "converted").length;
  const conversionRate =
    totalLeadsCount > 0 ? ((convertedLeadsCount / totalLeadsCount) * 100).toFixed(1) : "0.0";

  const avgPlotDealValue =
    bookings.length > 0
      ? totalCommittedValue / bookings.length
      : plots.length > 0
      ? plots.reduce((s: number, p: any) => s + (Number(p.price) || 0), 0) / plots.length
      : 0;

  function refreshData() {
    qc.invalidateQueries({ queryKey: ["analytics_projects"] });
    qc.invalidateQueries({ queryKey: ["analytics_plots"] });
    qc.invalidateQueries({ queryKey: ["analytics_bookings"] });
    qc.invalidateQueries({ queryKey: ["analytics_incentives"] });
    qc.invalidateQueries({ queryKey: ["analytics_leads"] });
    toast.success("Analytics refreshed");
  }

  function formatCurrency(val: number) {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString("en-IN")}`;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-terracotta border-t-transparent" />
        <p className="text-sm font-semibold text-muted-foreground animate-pulse">
          Loading Executive Telemetry & Analytics...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-terracotta shadow-xs" />
            <h1 className="text-display text-3xl font-extrabold tracking-tight">Executive Analytics</h1>
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md bg-terracotta/10 text-terracotta border border-terracotta/20">
              Live Intel
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real estate inventory telemetry, cash collections, sales pipeline & executive incentives
          </p>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[170px] h-9 text-xs bg-card border-border/80">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Projects ({projects.length})</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name} ({p.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[130px] h-9 text-xs bg-card border-border/80">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Time</SelectItem>
              <SelectItem value="month" className="text-xs">This Month</SelectItem>
              <SelectItem value="quarter" className="text-xs">This Quarter</SelectItem>
              <SelectItem value="year" className="text-xs">This Year</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs gap-1.5"
            onClick={refreshData}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Cash Revenue Collected"
          value={formatCurrency(totalCashCollected)}
          subText={`₹${(totalCommittedValue / 100000).toFixed(1)}L committed value`}
          icon={IndianRupee}
          gradient="from-emerald-500/20 to-teal-500/10"
          iconBg="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
        />
        <StatCard
          title="Plot Sales Velocity"
          value={`${soldPlotsCount} Sold`}
          subText={`${totalPlotsCount > 0 ? Math.round((soldPlotsCount / totalPlotsCount) * 100) : 0}% of ${totalPlotsCount} total plots`}
          icon={Building2}
          gradient="from-terracotta/25 to-amber-500/15"
          iconBg="bg-terracotta/15 text-terracotta border-terracotta/30"
        />
        <StatCard
          title="Team Incentives Paid"
          value={formatCurrency(totalIncentivesPaid)}
          subText={`${incentives.length} total payout grant(s)`}
          icon={Award}
          gradient="from-amber-500/20 to-yellow-500/10"
          iconBg="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
        />
        <StatCard
          title="Lead Conversion Rate"
          value={`${conversionRate}%`}
          subText={`${convertedLeadsCount} converted of ${totalLeadsCount} leads`}
          icon={Target}
          gradient="from-violet-500/20 to-indigo-500/10"
          iconBg="bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30"
        />
      </div>

      {/* Main Charts Grid Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart bookings={bookings} />
        <SalesChart plots={plots} />
      </div>

      {/* Secondary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Available Inventory"
          value={`${availablePlotsCount} Plots`}
          subText={`Worth ${formatCurrency(availableInventoryValue)}`}
          icon={Layers}
          gradient="from-sky-500/20 to-blue-500/10"
          iconBg="bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30"
        />
        <StatCard
          title="Active Pipeline"
          value={`${bookedPlotsCount + reservedPlotsCount} Plots`}
          subText={`${bookedPlotsCount} Booked · ${reservedPlotsCount} Reserved`}
          icon={BadgeCheck}
          gradient="from-indigo-500/20 to-purple-500/10"
          iconBg="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
        />
        <StatCard
          title="Avg Deal Ticket Size"
          value={formatCurrency(avgPlotDealValue)}
          subText="Per unit land allocation"
          icon={Landmark}
          gradient="from-teal-500/20 to-emerald-500/10"
          iconBg="bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30"
        />
        <StatCard
          title="Active Projects"
          value={`${projects.length}`}
          subText={`${projects.filter((p) => p.status === "live").length} live in portfolio`}
          icon={Sparkles}
          gradient="from-amber-500/20 to-terracotta/15"
          iconBg="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
        />
      </div>

      {/* Main Charts Grid Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <IncentivesChart incentives={incentives} />
        <div className="lg:col-span-2">
          <ProjectPerformanceTable
            projects={projects}
            plots={rawPlots}
            bookings={rawBookings}
          />
        </div>
      </div>
    </div>
  );
}
