import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FolderKanban,
  MapPin,
  ClipboardCheck,
  IndianRupee,
  TrendingUp,
  Users,
  Sparkles,
  Calendar,
  MessageSquare,
  Clock,
  ArrowRight,
  Activity,
  Award,
  Target,
  Zap,
  Edit3,
  PieChart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, formatDistanceToNow, startOfMonth, endOfMonth, subMonths } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();

  const [monthlyTarget, setMonthlyTarget] = useState<number>(() => {
    const saved = localStorage.getItem("terra_monthly_target");
    return saved ? Number(saved) : 5000000;
  });
  const [targetDialogOpen, setTargetDialogOpen] = useState(false);
  const [inputTarget, setInputTarget] = useState(String(monthlyTarget));

  const { data: role } = useQuery({
    queryKey: ["role", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: user.id });
      return (data as string) ?? "employee";
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", role],
    enabled: !!role,
    queryFn: async () => {
      const [projects, plots, bookings, leads, messages, incentives, profiles] = await Promise.all([
        supabase.from("projects").select("id, status, created_at"),
        supabase.from("plots").select("id, status, price, project_id"),
        (supabase as any).from("bookings").select("id, status, total_price, booking_amount, advance_paid, incentive_amount, booking_date, created_at, sales_executive_id, customer_name, customer_phone, plots(plot_number, projects(name, code))").order("created_at", { ascending: false }),
        (supabase as any).from("plot_leads").select("id, name, status, created_at"),
        supabase.from("contact_messages").select("id, status, created_at"),
        (supabase as any).from("incentive_grants").select("id, amount, granted_at"),
        (supabase as any).from("profiles").select("id, full_name, job_title"),
      ]);

      const p = projects.data ?? [];
      const pl = plots.data ?? [];
      const b = (bookings as any).data ?? [];
      const l = (leads as any).data ?? [];
      const m = messages.data ?? [];
      const i = (incentives as any).data ?? [];
      const prof = (profiles.data ?? []) as any[];

      // Only count active bookings (matching Treasury logic)
      const activeStatuses = ["pending", "approved", "on_hold", "completed"];
      const activeBookingsList = b.filter((x: any) => activeStatuses.includes(x.status));

      // Calculate monthly collections (using advance_paid = actual cash collected, matching Treasury)
      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const thisMonthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));

      const thisMonthRevenue = activeBookingsList
        .filter((x: any) => {
          const date = new Date(x.created_at);
          return date >= thisMonthStart && date <= thisMonthEnd;
        })
        .reduce((s: number, x: any) => s + Number(x.advance_paid ?? 0), 0);

      const lastMonthRevenue = activeBookingsList
        .filter((x: any) => {
          const date = new Date(x.created_at);
          return date >= lastMonthStart && date <= lastMonthEnd;
        })
        .reduce((s: number, x: any) => s + Number(x.advance_paid ?? 0), 0);

      const revenueGrowth = lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

      // Total collections = sum of advance_paid across all active bookings (matches Treasury "Total Collections")
      const totalCollections = activeBookingsList.reduce((s: number, x: any) => s + Number(x.advance_paid ?? 0), 0);
      // Total agreed = sum of total_price across all active bookings (matches Treasury "Total Agreed Revenue")
      const totalAgreedRevenue = activeBookingsList.reduce((s: number, x: any) => s + Number(x.total_price ?? 0), 0);
      // Outstanding = agreed - collected (matches Treasury "Outstanding Receivables")
      const totalOutstanding = Math.max(0, totalAgreedRevenue - totalCollections);

      return {
        totalProjects: p.length,
        liveProjects: p.filter((x) => x.status === "live" || !x.status).length,
        upcomingProjects: p.filter((x) => x.status === "upcoming").length,
        totalPlots: pl.length,
        availablePlots: pl.filter((x) => x.status === "available").length,
        bookedPlots: pl.filter((x) => x.status === "booked" || x.status === "sold").length,
        pendingPlots: pl.filter((x) => x.status === "pending").length,
        totalBookings: activeBookingsList.length,
        activeBookings: activeBookingsList.filter((x: any) => x.status === "approved" || x.status === "completed").length,
        pendingBookings: activeBookingsList.filter((x: any) => x.status === "pending").length,
        totalCollections,
        totalAgreedRevenue,
        totalOutstanding,
        thisMonthRevenue,
        lastMonthRevenue,
        revenueGrowth,
        totalLeads: l.length,
        newLeads: l.filter((x: any) => x.status === "new").length,
        qualifiedLeads: l.filter((x: any) => x.status !== "new" && x.status !== "dropped").length,
        totalMessages: m.length,
        unreadMessages: m.filter((x) => x.status === "new" || x.status === "unread" || !x.status).length,
        totalIncentivesPaid: i.length > 0 
          ? i.reduce((s: number, x: any) => s + Number(x.amount ?? 0), 0)
          : activeBookingsList.reduce((s: number, x: any) => s + Number(x.incentive_amount ?? 0), 0),
        totalEmployees: prof.length,
        recentBookings: b.slice(0, 5),
        recentLeads: l.slice(0, 5),
      };
    },
  });

  const isAdmin = role === "admin" || role === "super_admin" || role === "accounts";
  const isManager = role === "manager" || role === "management" || role === "accounts";
  const canSetTarget = isAdmin || isManager;

  const saveTarget = () => {
    const num = Number(inputTarget);
    if (!isNaN(num) && num > 0) {
      setMonthlyTarget(num);
      localStorage.setItem("terra_monthly_target", String(num));
      setTargetDialogOpen(false);
      toast.success(`Monthly sales target set to ${money(num)}`);
    } else {
      toast.error("Please enter a valid target amount");
    }
  };

  const achievementPercent = monthlyTarget > 0 ? Math.min(100, Math.round(((stats?.thisMonthRevenue ?? 0) / monthlyTarget) * 100)) : 0;

  const formatMoney = (amount: number) => {
    if (!amount || isNaN(amount)) return "₹0";
    if (amount >= 10000000) {
      const cr = amount / 10000000;
      return `₹${cr >= 100 ? cr.toLocaleString("en-IN", { maximumFractionDigits: 1 }) : cr.toFixed(2)} Cr`;
    }
    if (amount >= 100000) {
      const lakh = amount / 100000;
      return `₹${lakh >= 100 ? lakh.toLocaleString("en-IN", { maximumFractionDigits: 1 }) : lakh.toFixed(1)}L`;
    }
    if (amount >= 1000) {
      const k = amount / 1000;
      return `₹${k.toFixed(1)}k`;
    }
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const money = (amount: number) => formatMoney(amount);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="space-y-6">
      {/* Glassmorphic Hero Studio Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-terracotta/20 bg-gradient-to-r from-terracotta/[0.08] via-card to-amber-500/[0.06] p-6 shadow-xs backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-terracotta/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-terracotta/30 bg-terracotta/10 px-2.5 py-0.5 text-[11px] font-semibold text-terracotta">
                <Sparkles className="h-3 w-3 text-terracotta animate-pulse" />
                ARK DEVELOPERS
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </span>
            </div>
            <h1 className="mt-2 text-display text-3xl md:text-4xl font-bold tracking-tight text-ink dark:text-foreground">
              Developer Command Center
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">
              Track project performance, plot bookings, sales revenue, and customer inquiries in real-time.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/project-stats">
              <Button size="sm" className="bg-gradient-to-r from-terracotta to-amber-600 hover:from-terracotta/90 hover:to-amber-500 text-white text-xs gap-1.5 shadow-sm font-semibold">
                <PieChart className="h-4 w-4" /> Project Stats & Income Tally
              </Button>
            </Link>
            {role && (
              <div className="rounded-xl border border-border/60 bg-card/85 px-4 py-2.5 backdrop-blur-md text-right shadow-2xs">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Access Profile</p>
                <p className="text-sm font-bold text-terracotta capitalize">{role.replace("_", " ")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-terracotta/20 bg-gradient-to-b from-card/90 via-card/75 to-card/90 backdrop-blur-xl hover:border-terracotta/50 hover:-translate-y-1 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_30px_rgba(224,90,56,0.15)] rounded-2xl group overflow-hidden relative">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-terracotta/10 blur-xl group-hover:bg-terracotta/20 transition-colors" />
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground truncate">Total Collections</p>
                <p className="text-2xl lg:text-3xl font-extrabold text-display mt-1 bg-gradient-to-r from-ink via-terracotta to-ink dark:from-white dark:via-terracotta dark:to-white bg-clip-text text-transparent truncate">
                  {money(stats?.totalCollections ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-2 truncate">
                  {stats?.revenueGrowth && stats.revenueGrowth > 0 ? (
                    <span className="text-emerald-600 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">↑ {stats.revenueGrowth.toFixed(0)}% vs last month</span>
                  ) : (
                    <span className="text-muted-foreground font-medium">Realized cash in hand</span>
                  )}
                </p>
              </div>
              <div className="shrink-0 rounded-2xl bg-gradient-to-br from-terracotta via-amber-600 to-terracotta text-white p-3.5 shadow-[0_6px_20px_rgba(224,90,56,0.35)] group-hover:scale-110 transition-transform duration-300">
                <IndianRupee className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-emerald-500/20 bg-gradient-to-b from-card/90 via-card/75 to-card/90 backdrop-blur-xl hover:border-emerald-500/50 hover:-translate-y-1 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_30px_rgba(16,185,129,0.15)] rounded-2xl group overflow-hidden relative">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/10 blur-xl group-hover:bg-emerald-500/20 transition-colors" />
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground truncate">Active Bookings</p>
                <p className="text-2xl lg:text-3xl font-extrabold text-display mt-1 text-emerald-600 dark:text-emerald-400 truncate">{stats?.totalBookings ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-2 truncate">
                  {stats?.pendingBookings && stats.pendingBookings > 0 ? (
                    <span className="text-terracotta font-semibold bg-terracotta/10 px-2 py-0.5 rounded-full border border-terracotta/20">{stats.pendingBookings} pending approval</span>
                  ) : (
                    <span className="text-muted-foreground font-medium">No pending approvals</span>
                  )}
                </p>
              </div>
              <div className="shrink-0 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-600 text-white p-3.5 shadow-[0_6px_20px_rgba(16,185,129,0.35)] group-hover:scale-110 transition-transform duration-300">
                <ClipboardCheck className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-sky-500/20 bg-gradient-to-b from-card/90 via-card/75 to-card/90 backdrop-blur-xl hover:border-sky-500/50 hover:-translate-y-1 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_30px_rgba(14,165,233,0.15)] rounded-2xl group overflow-hidden relative">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-sky-500/10 blur-xl group-hover:bg-sky-500/20 transition-colors" />
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground truncate">Available Plots</p>
                <p className="text-2xl lg:text-3xl font-extrabold text-display mt-1 text-sky-600 dark:text-sky-400 truncate">{stats?.availablePlots ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-2 truncate">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{stats?.bookedPlots ?? 0}</span> sold / booked
                </p>
              </div>
              <div className="shrink-0 rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 text-white p-3.5 shadow-[0_6px_20px_rgba(14,165,233,0.35)] group-hover:scale-110 transition-transform duration-300">
                <MapPin className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-violet-500/20 bg-gradient-to-b from-card/90 via-card/75 to-card/90 backdrop-blur-xl hover:border-violet-500/50 hover:-translate-y-1 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_30px_rgba(139,92,246,0.15)] rounded-2xl group overflow-hidden relative">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-500/10 blur-xl group-hover:bg-violet-500/20 transition-colors" />
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground truncate">New Leads</p>
                <p className="text-2xl lg:text-3xl font-extrabold text-display mt-1 text-violet-600 dark:text-violet-400 truncate">{stats?.newLeads ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-2 truncate">
                  <span className="font-semibold text-ink/80 dark:text-foreground/80">{stats?.qualifiedLeads ?? 0}</span> qualified leads
                </p>
              </div>
              <div className="shrink-0 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 text-white p-3.5 shadow-[0_6px_20px_rgba(139,92,246,0.35)] group-hover:scale-110 transition-transform duration-300">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Overview */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border border-border/60 bg-card/85 backdrop-blur-md rounded-2xl shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-display text-xl text-ink dark:text-foreground">
                <Activity className="h-5 w-5 text-terracotta" />
                Sales Performance
              </CardTitle>
              <CardDescription>
                {canSetTarget
                  ? `Monthly target: ${money(monthlyTarget)} (click Set Target to change)`
                  : `Monthly target set by management: ${money(monthlyTarget)}`}
              </CardDescription>
            </div>
            {canSetTarget ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setInputTarget(String(monthlyTarget));
                  setTargetDialogOpen(true);
                }}
                className="h-8 text-xs border-terracotta/30 text-terracotta hover:bg-terracotta/10 cursor-pointer rounded-lg shrink-0 ml-2"
              >
                <Edit3 className="h-3.5 w-3.5 mr-1" />
                Set Target
              </Button>
            ) : (
              <Badge variant="outline" className="text-xs font-normal shrink-0 ml-2">
                Target: {money(monthlyTarget)}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm gap-2">
                <span className="text-muted-foreground font-medium truncate">
                  Monthly Collections ({formatMoney(stats?.thisMonthRevenue ?? 0)} of {formatMoney(monthlyTarget)})
                </span>
                <span className="font-semibold text-terracotta shrink-0">
                  {achievementPercent}%
                </span>
              </div>
              <Progress
                value={achievementPercent}
                className="h-2.5 bg-muted rounded-full overflow-hidden"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="text-center p-4 rounded-xl bg-terracotta/[0.04] border border-terracotta/15 backdrop-blur-xs min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-display text-terracotta truncate">
                  {formatMoney(stats?.thisMonthRevenue ?? 0)}
                </p>
                <p className="text-xs font-medium text-muted-foreground mt-1">Collected This Month</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/40 border border-border/40 backdrop-blur-xs min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-display text-ink dark:text-foreground truncate">
                  {formatMoney(stats?.lastMonthRevenue ?? 0)}
                </p>
                <p className="text-xs font-medium text-muted-foreground mt-1">Collected Last Month</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/40 border border-border/40 backdrop-blur-xs min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-display text-ink dark:text-foreground truncate">
                  {stats?.totalBookings ?? 0}
                </p>
                <p className="text-xs font-medium text-muted-foreground mt-1">Total Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card/85 backdrop-blur-md rounded-2xl shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-display text-xl text-ink dark:text-foreground">
              <Target className="h-5 w-5 text-terracotta" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
              <span className="text-sm text-muted-foreground">Live Projects</span>
              <Badge variant="secondary" className="font-semibold bg-terracotta/10 text-terracotta border-terracotta/20">{stats?.liveProjects ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
              <span className="text-sm text-muted-foreground">Total Plots</span>
              <Badge variant="secondary" className="font-semibold">{stats?.totalPlots ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
              <span className="text-sm text-muted-foreground">Team Size</span>
              <Badge variant="secondary" className="font-semibold">{stats?.totalEmployees ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
              <span className="text-sm text-muted-foreground">Pending Messages</span>
              <Badge variant={stats?.unreadMessages ? "default" : "secondary"} className="font-semibold">
                {stats?.unreadMessages ?? 0}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
              <span className="text-sm text-muted-foreground">Incentives Paid</span>
              <Badge variant="secondary" className="font-semibold">{formatMoney(stats?.totalIncentivesPaid ?? 0)}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border border-border/60 bg-card/85 backdrop-blur-md rounded-2xl shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-display text-xl text-ink dark:text-foreground">
            <Zap className="h-5 w-5 text-terracotta" />
            Quick Actions
          </CardTitle>
          <CardDescription>Frequently used platform tools</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link to="/projects">
              <Button variant="outline" className="w-full justify-start h-auto py-3.5 border-border/60 hover:border-terracotta/50 hover:bg-terracotta/[0.04] transition-all duration-300 cursor-pointer group rounded-xl">
                <FolderKanban className="h-5 w-5 mr-3 text-terracotta transition-transform group-hover:scale-110" />
                <div className="text-left">
                  <p className="font-semibold text-sm">Browse Projects</p>
                  <p className="text-xs text-muted-foreground mt-0.5">View all projects</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-terracotta" />
              </Button>
            </Link>
            <Link to="/bookings">
              <Button variant="outline" className="w-full justify-start h-auto py-3.5 border-border/60 hover:border-terracotta/50 hover:bg-terracotta/[0.04] transition-all duration-300 cursor-pointer group rounded-xl">
                <ClipboardCheck className="h-5 w-5 mr-3 text-terracotta transition-transform group-hover:scale-110" />
                <div className="text-left">
                  <p className="font-semibold text-sm">Manage Bookings</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stats?.pendingBookings ?? 0} pending</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-terracotta" />
              </Button>
            </Link>
            <Link to="/leads">
              <Button variant="outline" className="w-full justify-start h-auto py-3.5 border-border/60 hover:border-terracotta/50 hover:bg-terracotta/[0.04] transition-all duration-300 cursor-pointer group rounded-xl">
                <Users className="h-5 w-5 mr-3 text-terracotta transition-transform group-hover:scale-110" />
                <div className="text-left">
                  <p className="font-semibold text-sm">View Leads</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stats?.newLeads ?? 0} new leads</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-terracotta" />
              </Button>
            </Link>
            <Link to="/messages">
              <Button variant="outline" className="w-full justify-start h-auto py-3.5 border-border/60 hover:border-terracotta/50 hover:bg-terracotta/[0.04] transition-all duration-300 cursor-pointer group rounded-xl">
                <MessageSquare className="h-5 w-5 mr-3 text-terracotta transition-transform group-hover:scale-110" />
                <div className="text-left">
                  <p className="font-semibold text-sm">Messages</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stats?.unreadMessages ?? 0} unread</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-terracotta" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-border/60 bg-card/85 backdrop-blur-md rounded-2xl shadow-xs hover:border-terracotta/30 transition-colors duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-ink dark:text-foreground">
              <Calendar className="h-5 w-5 text-terracotta" />
              Recent Bookings
            </CardTitle>
            <CardDescription>Latest plot bookings</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentBookings && stats.recentBookings.length > 0 ? (
              <div className="space-y-4">
                {stats.recentBookings.map((booking: any) => (
                  <div key={booking.id} className="flex items-center gap-3 text-sm pb-3 border-b border-border/30 last:border-0 last:pb-0">
                    <Avatar className="h-9 w-9 border border-border/50">
                      <AvatarFallback className="bg-gradient-to-br from-terracotta to-amber-600 text-white text-xs font-medium">
                        {getInitials(booking.customer_name || "Customer")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink dark:text-foreground truncate">{booking.customer_name || "Customer"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatMoney(booking.total_price || 0)}
                        {booking.plots?.plot_number ? ` · Plot ${booking.plots.plot_number}` : ""}
                        {booking.plots?.projects?.name ? ` (${booking.plots.projects.name})` : ""}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 capitalize font-medium ${
                        booking.status === "approved"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-950/30 dark:text-emerald-400"
                          : "bg-terracotta/5 text-terracotta border-terracotta/20"
                      }`}
                    >
                      {booking.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No recent bookings</p>
            )}
            <Link to="/bookings">
              <Button variant="ghost" className="w-full mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-terracotta hover:bg-terracotta/5 hover:text-terracotta cursor-pointer">
                View all bookings →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-xs hover:border-terracotta/20 transition-colors duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-ink dark:text-foreground">
              <Sparkles className="h-5 w-5 text-terracotta" />
              Recent Leads
            </CardTitle>
            <CardDescription>Latest customer inquiries</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentLeads && stats.recentLeads.length > 0 ? (
              <div className="space-y-4">
                {stats.recentLeads.map((lead: any) => (
                  <div key={lead.id} className="flex items-center gap-3 text-sm pb-3 border-b border-border/30 last:border-0 last:pb-0">
                    <Avatar className="h-9 w-9 border border-border/50">
                      <AvatarFallback className="bg-gradient-to-br from-ink to-terracotta text-white text-xs font-medium">
                        {getInitials(lead.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink dark:text-foreground truncate">{lead.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 capitalize font-medium ${
                        lead.status === "new"
                          ? "bg-terracotta/10 text-terracotta border-terracotta/25"
                          : "bg-muted text-muted-foreground border-border/50"
                      }`}
                    >
                      {lead.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No recent leads</p>
            )}
            <Link to="/leads">
              <Button variant="ghost" className="w-full mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-terracotta hover:bg-terracotta/5 hover:text-terracotta cursor-pointer">
                View all leads →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Role-specific content */}
      {(role === "admin" || role === "super_admin" || role === "manager" || role === "management" || role === "accounts") && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link to="/incentives">
            <Card className="transition-shadow hover:shadow-md cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-amber-100 p-2">
                    <Award className="h-5 w-5 text-amber-700" />
                  </div>
                  <div>
                    <p className="font-semibold">Grant Incentives</p>
                    <p className="text-xs text-muted-foreground">Reward team performance</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/team">
            <Card className="transition-shadow hover:shadow-md cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-100 p-2">
                    <Users className="h-5 w-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="font-semibold">Manage Team</p>
                    <p className="text-xs text-muted-foreground">{stats?.totalEmployees ?? 0} executives</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/visit-proofs">
            <Card className="transition-shadow hover:shadow-md cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-emerald-100 p-2">
                    <MapPin className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div>
                    <p className="font-semibold">Visit Proofs</p>
                    <p className="text-xs text-muted-foreground">Review GPS evidence</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {/* SET TARGET DIALOG */}
      <Dialog open={targetDialogOpen} onOpenChange={setTargetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-terracotta" />
              Set Monthly Sales Target
            </DialogTitle>
            <DialogDescription>
              As an Admin / Sales Head, you can set the monthly revenue target for your sales team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Monthly Target Amount (₹)
              </Label>
              <Input
                type="number"
                min="100000"
                step="500000"
                value={inputTarget}
                onChange={(e) => setInputTarget(e.target.value)}
                className="mt-1.5 h-11 text-base font-semibold"
                placeholder="e.g. 5000000 for ₹50 Lakhs"
              />
              <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                <span>Presets:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setInputTarget("2500000")}
                    className="px-2 py-1 rounded bg-muted hover:bg-terracotta/10 hover:text-terracotta text-xs font-medium cursor-pointer transition-colors"
                  >
                    ₹25L
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputTarget("5000000")}
                    className="px-2 py-1 rounded bg-muted hover:bg-terracotta/10 hover:text-terracotta text-xs font-medium cursor-pointer transition-colors"
                  >
                    ₹50L
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputTarget("10000000")}
                    className="px-2 py-1 rounded bg-muted hover:bg-terracotta/10 hover:text-terracotta text-xs font-medium cursor-pointer transition-colors"
                  >
                    ₹1 Cr
                  </button>
                </div>
              </div>
            </div>

            <Button onClick={saveTarget} className="w-full h-11 bg-terracotta text-white font-medium hover:bg-terracotta/90 text-sm cursor-pointer shadow-md">
              Save Monthly Target
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
