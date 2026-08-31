import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2,
  IndianRupee,
  TrendingUp,
  PieChart,
  BarChart3,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  Search,
  Download,
  Sparkles,
  ArrowUpRight,
  Layers,
  Award,
  ArrowUpDown,
  ChevronRight,
  Grid,
  Table as TableIcon,
  Zap,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Landmark,
  Coins,
  MapPin,
  Calendar,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export interface ProjectStatsViewProps {
  embedded?: boolean;
}

export function ProjectStatsView({ embedded = false }: ProjectStatsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"revenue" | "sold" | "outstanding" | "available" | "name">("revenue");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // 1. Fetch Projects
  const { data: projects = [], isLoading: projectsLoading, refetch: refetchProjects } = useQuery({
    queryKey: ["project_stats_projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // 2. Fetch Plots
  const { data: plots = [], isLoading: plotsLoading, refetch: refetchPlots } = useQuery({
    queryKey: ["project_stats_plots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plots")
        .select("id, project_id, plot_number, status, price, area_sqft, rate_per_sqft");
      if (error) throw error;
      return data ?? [];
    },
  });

  // 3. Fetch Bookings
  const { data: bookings = [], isLoading: bookingsLoading, refetch: refetchBookings } = useQuery({
    queryKey: ["project_stats_bookings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bookings")
        .select(`
          id,
          total_price,
          advance_paid,
          booking_amount,
          booking_date,
          status,
          customer_name,
          customer_phone,
          plot_id,
          plots(plot_number, project_id)
        `)
        .order("booking_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const isLoading = projectsLoading || plotsLoading || bookingsLoading;

  const handleRefresh = () => {
    refetchProjects();
    refetchPlots();
    refetchBookings();
    toast.success("Project stats refreshed live from database");
  };

  // Helper function for currency formatting
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

  // Process detailed project statistics
  const projectStatsList = useMemo(() => {
    const activeStatuses = ["pending", "approved", "on_hold", "completed"];

    return projects.map((project: any) => {
      const projPlots = plots.filter((p: any) => p.project_id === project.id);
      const totalPlotsCount = projPlots.length;

      // Plot statuses
      const soldPlotsCount = projPlots.filter((p: any) => p.status === "sold").length;
      const bookedPlotsCount = projPlots.filter((p: any) => p.status === "booked").length;
      const pendingPlotsCount = projPlots.filter((p: any) => p.status === "pending").length;
      const availablePlotsCount = projPlots.filter((p: any) => p.status === "available").length;
      const reservedPlotsCount = projPlots.filter((p: any) => p.status === "reserved").length;

      // Bookings for this project
      const projBookings = bookings.filter((b: any) => {
        const pId = b.plots?.project_id || plots.find((p: any) => p.id === b.plot_id)?.project_id;
        return pId === project.id && activeStatuses.includes(b.status);
      });

      const pendingBookingsCount = projBookings.filter((b: any) => b.status === "pending").length;
      const approvedBookingsCount = projBookings.filter((b: any) => b.status === "approved" || b.status === "completed").length;

      // Financials
      const cashCollected = projBookings.reduce((sum: number, b: any) => sum + (Number(b.advance_paid) || 0), 0);
      const totalAgreedValue = projBookings.reduce((sum: number, b: any) => sum + (Number(b.total_price) || 0), 0);
      const outstandingDues = Math.max(0, totalAgreedValue - cashCollected);
      
      const collectionRatio = totalAgreedValue > 0 ? Math.round((cashCollected / totalAgreedValue) * 100) : 0;
      const selloutPct = totalPlotsCount > 0 ? Math.round((soldPlotsCount / totalPlotsCount) * 100) : 0;

      const avgPlotPrice = projPlots.length > 0
        ? Math.round(projPlots.reduce((sum: number, p: any) => sum + (Number(p.price) || 0), 0) / projPlots.length)
        : 0;

      const totalInventoryValuation = projPlots.reduce((sum: number, p: any) => sum + (Number(p.price) || 0), 0);

      return {
        id: project.id,
        name: project.name,
        code: project.code,
        location: project.location || "Prime Location",
        status: project.status || "live",
        totalPlotsCount,
        soldPlotsCount,
        bookedPlotsCount,
        pendingPlotsCount,
        availablePlotsCount,
        reservedPlotsCount,
        pendingBookingsCount,
        approvedBookingsCount,
        cashCollected,
        totalAgreedValue,
        outstandingDues,
        collectionRatio,
        selloutPct,
        avgPlotPrice,
        totalInventoryValuation,
        rawProject: project,
        projPlots,
        projBookings,
      };
    });
  }, [projects, plots, bookings]);

  // Combined Macro Indicators
  const totals = useMemo(() => {
    const totalCashCollected = projectStatsList.reduce((sum, p) => sum + p.cashCollected, 0);
    const totalAgreedValue = projectStatsList.reduce((sum, p) => sum + p.totalAgreedValue, 0);
    const totalOutstanding = projectStatsList.reduce((sum, p) => sum + p.outstandingDues, 0);
    const totalSites = projectStatsList.reduce((sum, p) => sum + p.totalPlotsCount, 0);
    const totalSoldSites = projectStatsList.reduce((sum, p) => sum + p.soldPlotsCount, 0);
    const totalBookedSites = projectStatsList.reduce((sum, p) => sum + p.bookedPlotsCount, 0);
    const totalPendingSites = projectStatsList.reduce((sum, p) => sum + p.pendingPlotsCount + p.pendingBookingsCount, 0);
    const totalAvailableSites = projectStatsList.reduce((sum, p) => sum + p.availablePlotsCount, 0);
    
    // Top revenue generator
    const topRevenueProject = [...projectStatsList].sort((a, b) => b.cashCollected - a.cashCollected)[0];
    const topSellerProject = [...projectStatsList].sort((a, b) => b.soldPlotsCount - a.soldPlotsCount)[0];

    return {
      totalCashCollected,
      totalAgreedValue,
      totalOutstanding,
      totalSites,
      totalSoldSites,
      totalBookedSites,
      totalPendingSites,
      totalAvailableSites,
      topRevenueProject,
      topSellerProject,
      overallCollectionRatio: totalAgreedValue > 0 ? Math.round((totalCashCollected / totalAgreedValue) * 100) : 0,
      overallSelloutPct: totalSites > 0 ? Math.round((totalSoldSites / totalSites) * 100) : 0,
    };
  }, [projectStatsList]);

  // Filtered & Sorted Projects
  const filteredProjects = useMemo(() => {
    return projectStatsList
      .filter((p) => {
        const matchesSearch =
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || p.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "revenue") return b.cashCollected - a.cashCollected;
        if (sortBy === "sold") return b.soldPlotsCount - a.soldPlotsCount;
        if (sortBy === "outstanding") return b.outstandingDues - a.outstandingDues;
        if (sortBy === "available") return b.availablePlotsCount - a.availablePlotsCount;
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return 0;
      });
  }, [projectStatsList, searchTerm, statusFilter, sortBy]);

  // CSV Export Function
  const exportToCSV = () => {
    const headers = [
      "Project Code",
      "Project Name",
      "Status",
      "Money Made (Collected)",
      "Total Agreed Contract Value",
      "Outstanding Dues",
      "Sold Sites",
      "Booked Sites",
      "Pending Sites",
      "Available Sites",
      "Total Sites",
      "Sellout %",
      "Collection Ratio %",
      "Avg Site Price",
    ];

    const rows = filteredProjects.map((p) => [
      `"${p.code}"`,
      `"${p.name}"`,
      `"${p.status}"`,
      p.cashCollected,
      p.totalAgreedValue,
      p.outstandingDues,
      p.soldPlotsCount,
      p.bookedPlotsCount,
      p.pendingPlotsCount + p.pendingBookingsCount,
      p.availablePlotsCount,
      p.totalPlotsCount,
      `${p.selloutPct}%`,
      `${p.collectionRatio}%`,
      p.avgPlotPrice,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Project_Financial_Stats_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Project stats exported to CSV successfully");
  };

  return (
    <div className={`space-y-6 ${embedded ? "" : "p-4 md:p-6"}`}>
      {/* Top Banner / Hero Header */}
      {!embedded && (
        <div className="relative overflow-hidden rounded-2xl border border-terracotta/20 bg-gradient-to-r from-terracotta/[0.09] via-card to-amber-500/[0.06] p-6 shadow-xs backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-terracotta/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-terracotta/15 text-terracotta ring-1 ring-terracotta/30">
                  <PieChart className="h-5 w-5" />
                </span>
                <Badge variant="outline" className="border-terracotta/30 text-terracotta bg-terracotta/5 font-semibold text-xs">
                  Financial & Inventory Analytics
                </Badge>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mt-2">
                Project Stats & Revenue Breakdown
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-1 max-w-2xl">
                Comprehensive money tally, real-time plot sales velocity, pending bookings, and collection ratios across all projects.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="gap-2 text-xs border-border/60 hover:bg-muted"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                Refresh Data
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={exportToCSV}
                className="gap-2 text-xs bg-terracotta hover:bg-terracotta/90 text-white shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV Tally
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Summary Cards (Money Made, Sites Sold, Pending, Available) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Money Made */}
        <div className="rounded-xl border border-border/60 bg-card/80 p-4 backdrop-blur-md shadow-2xs relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Money Made</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <IndianRupee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              {formatMoney(totals.totalCashCollected)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            <span>Agreed: {formatMoney(totals.totalAgreedValue)}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{totals.overallCollectionRatio}% Collected</span>
          </div>
        </div>

        {/* Card 2: Total Sites Sold */}
        <div className="rounded-xl border border-border/60 bg-card/80 p-4 backdrop-blur-md shadow-2xs relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Sites Sold</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              {totals.totalSoldSites} <span className="text-xs font-normal text-muted-foreground">/ {totals.totalSites} sites</span>
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            <span>Booked: {totals.totalBookedSites} plots</span>
            <span className="text-blue-600 dark:text-blue-400 font-semibold">{totals.overallSelloutPct}% Sellout</span>
          </div>
        </div>

        {/* Card 3: Sites Pending */}
        <div className="rounded-xl border border-border/60 bg-card/80 p-4 backdrop-blur-md shadow-2xs relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Pending Sites & Bookings</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              {totals.totalPendingSites}
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Awaiting Action</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            <span>Outstanding Dues</span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">{formatMoney(totals.totalOutstanding)}</span>
          </div>
        </div>

        {/* Card 4: Available Sites */}
        <div className="rounded-xl border border-border/60 bg-card/80 p-4 backdrop-blur-md shadow-2xs relative overflow-hidden group hover:border-terracotta/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Available Sites</span>
            <div className="p-2 rounded-lg bg-terracotta/10 text-terracotta">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              {totals.totalAvailableSites}
            </span>
            <span className="text-xs text-muted-foreground font-normal">Ready to sell</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            <span>Top Project</span>
            <span className="text-terracotta font-semibold truncate max-w-[120px]">{totals.topRevenueProject?.name || "N/A"}</span>
          </div>
        </div>
      </div>

      {/* Top Performers Ribbon */}
      {totals.topRevenueProject && (
        <div className="rounded-xl bg-gradient-to-r from-terracotta/10 via-amber-500/10 to-card border border-terracotta/20 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-terracotta text-white shadow-xs">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-bold text-terracotta">
                  #1 Top Revenue Generating Project
                </span>
                <Badge variant="secondary" className="text-[10px] font-mono uppercase bg-terracotta/15 text-terracotta">
                  {totals.topRevenueProject.code}
                </Badge>
              </div>
              <p className="text-base font-bold text-foreground mt-0.5">
                {totals.topRevenueProject.name} — Generated <span className="text-emerald-600 dark:text-emerald-400">{formatMoney(totals.topRevenueProject.cashCollected)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Sites Sold: </span>
              <span className="font-bold text-foreground">{totals.topRevenueProject.soldPlotsCount} plots</span>
            </div>
            <div>
              <span className="text-muted-foreground">Collection Ratio: </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{totals.topRevenueProject.collectionRatio}%</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedProject(totals.topRevenueProject);
                setDetailDialogOpen(true);
              }}
              className="text-xs gap-1 border-terracotta/30 text-terracotta hover:bg-terracotta/10"
            >
              View Breakdown <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Controls Bar: Search, Filters, Sorting, View Toggle */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-card/60 p-3 rounded-xl border border-border/60">
        <div className="flex flex-1 items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search project name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs h-9 bg-background/80"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] text-xs h-9 bg-background/80">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="live">Live Projects</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground hidden sm:inline">Sort by:</span>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[160px] text-xs h-9 bg-background/80">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Money Made (High-Low)</SelectItem>
                <SelectItem value="sold">Sites Sold (Most)</SelectItem>
                <SelectItem value="outstanding">Dues Outstanding</SelectItem>
                <SelectItem value="available">Available Plots</SelectItem>
                <SelectItem value="name">Project Name</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center border border-border/60 rounded-lg p-0.5 bg-background">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${
                viewMode === "grid"
                  ? "bg-terracotta text-white font-medium shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Grid View"
            >
              <Grid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${
                viewMode === "table"
                  ? "bg-terracotta text-white font-medium shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Table Matrix View"
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Grid View or Matrix Table */}
      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-terracotta mb-3" />
          <p className="text-sm font-medium">Computing real-time project money tally & site stats...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl bg-card/40">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/60 mb-2" />
          <p className="text-base font-semibold text-foreground">No projects found matching criteria</p>
          <p className="text-xs text-muted-foreground mt-1">Try clearing search terms or status filters.</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              className="border-border/70 bg-card/85 backdrop-blur-xl shadow-xs hover:shadow-md hover:border-terracotta/30 transition-all overflow-hidden flex flex-col justify-between group"
            >
              <CardHeader className="p-5 border-b border-border/40 pb-4 bg-muted/20">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono uppercase bg-background border-border/80 text-foreground font-semibold">
                        {project.code}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] capitalize font-medium ${
                          project.status === "live"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : project.status === "upcoming"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                        }`}
                      >
                        {project.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-bold text-foreground mt-1.5 group-hover:text-terracotta transition-colors">
                      {project.name}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" /> {project.location}
                    </CardDescription>
                  </div>

                  <Link
                    to="/projects/$id"
                    params={{ id: project.id }}
                    className="p-1.5 rounded-lg border border-border/60 hover:bg-terracotta hover:text-white transition-colors text-muted-foreground"
                    title="Open Project Details"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4 flex-1">
                {/* Money Made Financial Box */}
                <div className="rounded-xl bg-gradient-to-br from-emerald-500/[0.06] to-muted/40 p-3.5 border border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <IndianRupee className="h-3.5 w-3.5" /> Money Made (Collected)
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {project.collectionRatio}% ratio
                    </span>
                  </div>
                  <div className="mt-1 text-xl font-bold text-foreground tracking-tight">
                    {formatMoney(project.cashCollected)}
                  </div>

                  {/* Progress bar for collection */}
                  <div className="mt-2 space-y-1">
                    <Progress value={project.collectionRatio} className="h-1.5 bg-emerald-500/20" />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Agreed: {formatMoney(project.totalAgreedValue)}</span>
                      <span>Dues: {formatMoney(project.outstandingDues)}</span>
                    </div>
                  </div>
                </div>

                {/* Sites Breakdown Visual Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-foreground flex items-center gap-1.5 font-semibold">
                      <Layers className="h-3.5 w-3.5 text-terracotta" /> Site Sales Distribution
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      {project.soldPlotsCount + project.bookedPlotsCount} / {project.totalPlotsCount} plots ({project.selloutPct}%)
                    </span>
                  </div>

                  {/* Segmented inventory progress bar */}
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex shadow-2xs">
                    <div
                      style={{ width: `${(project.soldPlotsCount / (project.totalPlotsCount || 1)) * 100}%` }}
                      className="bg-emerald-500 h-full"
                      title={`Sold: ${project.soldPlotsCount}`}
                    />
                    <div
                      style={{ width: `${(project.bookedPlotsCount / (project.totalPlotsCount || 1)) * 100}%` }}
                      className="bg-blue-500 h-full"
                      title={`Booked: ${project.bookedPlotsCount}`}
                    />
                    <div
                      style={{
                        width: `${
                          ((project.pendingPlotsCount + project.pendingBookingsCount) /
                            (project.totalPlotsCount || 1)) *
                          100
                        }%`,
                      }}
                      className="bg-amber-500 h-full"
                      title={`Pending: ${project.pendingPlotsCount + project.pendingBookingsCount}`}
                    />
                    <div
                      style={{ width: `${(project.availablePlotsCount / (project.totalPlotsCount || 1)) * 100}%` }}
                      className="bg-muted-foreground/30 h-full"
                      title={`Available: ${project.availablePlotsCount}`}
                    />
                  </div>

                  {/* Plot Status Pill Legend Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-emerald-700 dark:text-emerald-300 font-medium">Sold Sites</span>
                      <span className="font-bold text-emerald-800 dark:text-emerald-200">{project.soldPlotsCount}</span>
                    </div>

                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <span className="text-blue-700 dark:text-blue-300 font-medium">Booked Sites</span>
                      <span className="font-bold text-blue-800 dark:text-blue-200">{project.bookedPlotsCount}</span>
                    </div>

                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <span className="text-amber-700 dark:text-amber-300 font-medium">Pending Approvals</span>
                      <span className="font-bold text-amber-800 dark:text-amber-200">
                        {project.pendingPlotsCount + project.pendingBookingsCount}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-muted/60 border border-border/50">
                      <span className="text-muted-foreground font-medium">Available Sites</span>
                      <span className="font-bold text-foreground">{project.availablePlotsCount}</span>
                    </div>
                  </div>
                </div>

                {/* Additional Stats: Avg Plot Price & Total Inventory */}
                <div className="border-t border-border/40 pt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <div>
                    <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Avg Plot Price</span>
                    <span className="font-semibold text-foreground">{formatMoney(project.avgPlotPrice)}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Total Valuation</span>
                    <span className="font-semibold text-foreground">{formatMoney(project.totalInventoryValuation)}</span>
                  </div>
                </div>
              </CardContent>

              {/* Card Footer Actions */}
              <div className="p-3 bg-muted/30 border-t border-border/50 flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedProject(project);
                    setDetailDialogOpen(true);
                  }}
                  className="w-full text-xs hover:bg-terracotta/10 hover:text-terracotta font-medium"
                >
                  <Eye className="h-3.5 w-3.5 mr-1.5" /> Full Project Tally Breakdown
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* Matrix Tally Table View */
        <div className="rounded-2xl border border-border/70 bg-card/85 backdrop-blur-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60 text-left uppercase text-[10px] tracking-wider text-muted-foreground font-semibold">
                  <th className="p-3.5">Project Code & Name</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Money Made</th>
                  <th className="p-3.5 text-right">Agreed Revenue</th>
                  <th className="p-3.5 text-right">Dues Outstanding</th>
                  <th className="p-3.5 text-center">Sold Sites</th>
                  <th className="p-3.5 text-center">Booked</th>
                  <th className="p-3.5 text-center">Pending</th>
                  <th className="p-3.5 text-center">Available</th>
                  <th className="p-3.5 text-center">Total Sites</th>
                  <th className="p-3.5 text-center">Sellout %</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border/60 text-muted-foreground font-semibold">
                          {project.code}
                        </span>
                        <Link
                          to="/projects/$id"
                          params={{ id: project.id }}
                          className="font-bold text-foreground hover:text-terracotta transition-colors"
                        >
                          {project.name}
                        </Link>
                      </div>
                    </td>

                    <td className="p-3.5 text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize ${
                          project.status === "live"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : project.status === "upcoming"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                        }`}
                      >
                        {project.status}
                      </Badge>
                    </td>

                    <td className="p-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {formatMoney(project.cashCollected)}
                    </td>

                    <td className="p-3.5 text-right font-medium text-foreground">
                      {formatMoney(project.totalAgreedValue)}
                    </td>

                    <td className="p-3.5 text-right font-medium text-amber-600 dark:text-amber-400">
                      {formatMoney(project.outstandingDues)}
                    </td>

                    <td className="p-3.5 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                      {project.soldPlotsCount}
                    </td>

                    <td className="p-3.5 text-center font-semibold text-blue-600 dark:text-blue-400">
                      {project.bookedPlotsCount}
                    </td>

                    <td className="p-3.5 text-center font-semibold text-amber-600 dark:text-amber-400">
                      {project.pendingPlotsCount + project.pendingBookingsCount}
                    </td>

                    <td className="p-3.5 text-center font-medium text-muted-foreground">
                      {project.availablePlotsCount}
                    </td>

                    <td className="p-3.5 text-center font-bold text-foreground">
                      {project.totalPlotsCount}
                    </td>

                    <td className="p-3.5 text-center">
                      <span className="font-semibold text-terracotta">{project.selloutPct}%</span>
                    </td>

                    <td className="p-3.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedProject(project);
                          setDetailDialogOpen(true);
                        }}
                        className="h-7 px-2 text-[11px] text-terracotta hover:bg-terracotta/10"
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Project Breakdown Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedProject && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs uppercase bg-muted">
                    {selectedProject.code}
                  </Badge>
                  <Badge variant="secondary" className="capitalize text-xs">
                    {selectedProject.status}
                  </Badge>
                </div>
                <DialogTitle className="text-xl font-bold text-foreground">
                  {selectedProject.name} — Detailed Tally
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Complete monetary breakdown, plot sales logs, and customer collections for {selectedProject.name}.
                </DialogDescription>
              </DialogHeader>

              {/* Monetary Breakdown Metrics */}
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Cash Collected</span>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatMoney(selectedProject.cashCollected)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Agreed Revenue</span>
                  <span className="text-lg font-bold text-foreground">
                    {formatMoney(selectedProject.totalAgreedValue)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Dues Pending</span>
                  <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    {formatMoney(selectedProject.outstandingDues)}
                  </span>
                </div>
              </div>

              {/* Sites Status Grid */}
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                  Plots & Inventory Breakdown ({selectedProject.totalPlotsCount} Plots Total)
                </h4>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="block text-[10px] text-emerald-700 dark:text-emerald-300">Sold</span>
                    <span className="text-base font-bold text-emerald-800 dark:text-emerald-200">
                      {selectedProject.soldPlotsCount}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <span className="block text-[10px] text-blue-700 dark:text-blue-300">Booked</span>
                    <span className="text-base font-bold text-blue-800 dark:text-blue-200">
                      {selectedProject.bookedPlotsCount}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="block text-[10px] text-amber-700 dark:text-amber-300">Pending</span>
                    <span className="text-base font-bold text-amber-800 dark:text-amber-200">
                      {selectedProject.pendingPlotsCount + selectedProject.pendingBookingsCount}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted border border-border/60">
                    <span className="block text-[10px] text-muted-foreground">Available</span>
                    <span className="text-base font-bold text-foreground">
                      {selectedProject.availablePlotsCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Bookings List */}
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                  Recent Customer Bookings & Dues
                </h4>
                {selectedProject.projBookings.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">No active bookings recorded for this project yet.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-border/60 rounded-xl divide-y divide-border/40">
                    {selectedProject.projBookings.slice(0, 10).map((b: any) => (
                      <div key={b.id} className="p-2.5 text-xs flex items-center justify-between hover:bg-muted/30">
                        <div>
                          <div className="font-semibold text-foreground">{b.customer_name || "Customer"}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Plot #{b.plots?.plot_number || "N/A"} • Status: <span className="capitalize">{b.status}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatMoney(Number(b.advance_paid))} paid
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Total: {formatMoney(Number(b.total_price))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dialog Footer Actions */}
              <div className="flex items-center justify-between border-t border-border/50 pt-3">
                <Button variant="outline" size="sm" onClick={() => setDetailDialogOpen(false)} className="text-xs">
                  Close
                </Button>
                <Link to="/projects/$id" params={{ id: selectedProject.id }}>
                  <Button size="sm" className="bg-terracotta text-white hover:bg-terracotta/90 text-xs gap-1">
                    Open Project Page <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
