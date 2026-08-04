import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  TrendingUp,
  IndianRupee,
  ExternalLink,
  Ban,
  FileSpreadsheet,
  Layers,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/bookings")({
  component: BookingsPage,
});

const statusConfig: Record<string, { label: string; style: string; icon: any }> = {
  pending: {
    label: "Pending Approval",
    style: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    style: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    style: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
    icon: XCircle,
  },
  cancelled: {
    label: "Cancelled",
    style: "bg-muted text-muted-foreground border-border",
    icon: Ban,
  },
  on_hold: {
    label: "On Hold",
    style: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    icon: AlertCircle,
  },
};

function BookingsPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  const { data: role } = useQuery({
    queryKey: ["role", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: user.id });
      return (data as string) ?? "employee";
    },
  });

  const isAdmin = role === "admin" || role === "super_admin";

  const { data: bookings = [], isLoading, isRefetching } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, plots(id, plot_number, project_id, projects(id, name, code))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      plotId,
      status,
    }: {
      id: string;
      plotId?: string;
      status: "approved" | "rejected" | "cancelled" | "on_hold" | "pending";
    }) => {
      const { error } = await supabase
        .from("bookings")
        .update({
          status,
          approved_by: user.id,
        })
        .eq("id", id);
      if (error) throw error;

      if (plotId) {
        if (status === "approved") {
          await supabase.from("plots").update({ status: "booked" }).eq("id", plotId);
        } else if (status === "cancelled" || status === "rejected") {
          await supabase
            .from("plots")
            .update({ status: "available", selected_lead_id: null } as any)
            .eq("id", plotId);
        }
      }
    },
    onSuccess: () => {
      toast.success("Booking status updated successfully");
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Unique list of projects for filter
  const projectsList = useMemo(() => {
    const unique = new Map<string, string>();
    bookings.forEach((b: any) => {
      const proj = b.plots?.projects;
      if (proj?.id && proj?.name) {
        unique.set(proj.id, proj.name);
      }
    });
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [bookings]);

  // Statistics calculation
  const stats = useMemo(() => {
    let totalCollected = 0;
    let totalDealValue = 0;
    let pendingCount = 0;
    let approvedCount = 0;

    bookings.forEach((b: any) => {
      totalCollected += Number(b.advance_paid || 0);
      totalDealValue += Number(b.total_price || 0);
      if (b.status === "pending") pendingCount++;
      if (b.status === "approved") approvedCount++;
    });

    return {
      totalBookings: bookings.length,
      totalCollected,
      totalDealValue,
      pendingCount,
      approvedCount,
    };
  }, [bookings]);

  // Filtered and sorted bookings
  const filteredBookings = useMemo(() => {
    return bookings
      .filter((b: any) => {
        // Status Filter
        if (selectedStatus !== "all" && b.status !== selectedStatus) {
          return false;
        }

        // Project Filter
        if (selectedProject !== "all" && b.plots?.projects?.id !== selectedProject) {
          return false;
        }

        // Search Query (Customer Name, Phone, Plot Number, Project Name)
        if (searchQuery.trim() !== "") {
          const q = searchQuery.toLowerCase();
          const matchCustomer = b.customer_name?.toLowerCase().includes(q);
          const matchPhone = b.customer_phone?.toLowerCase().includes(q);
          const matchPlot = String(b.plots?.plot_number ?? "").toLowerCase().includes(q);
          const matchProject = b.plots?.projects?.name?.toLowerCase().includes(q);
          return matchCustomer || matchPhone || matchPlot || matchProject;
        }

        return true;
      })
      .sort((a: any, b: any) => {
        if (sortBy === "newest") {
          return new Date(b.created_at || b.booking_date).getTime() - new Date(a.created_at || a.booking_date).getTime();
        }
        if (sortBy === "oldest") {
          return new Date(a.created_at || a.booking_date).getTime() - new Date(b.created_at || b.booking_date).getTime();
        }
        if (sortBy === "amount_high") {
          return Number(b.total_price || 0) - Number(a.total_price || 0);
        }
        if (sortBy === "amount_low") {
          return Number(a.total_price || 0) - Number(b.total_price || 0);
        }
        return 0;
      });
  }, [bookings, selectedStatus, selectedProject, searchQuery, sortBy]);

  // Export to CSV
  const exportToCSV = () => {
    if (filteredBookings.length === 0) {
      toast.error("No bookings to export");
      return;
    }
    const headers = ["Booking ID", "Project", "Plot Number", "Customer Name", "Customer Phone", "Total Price (INR)", "Advance Paid (INR)", "Booking Date", "Status"];
    const rows = filteredBookings.map((b: any) => [
      b.id,
      `"${b.plots?.projects?.name || ""}"`,
      b.plots?.plot_number || "",
      `"${b.customer_name || ""}"`,
      `"${b.customer_phone || ""}"`,
      b.total_price || 0,
      b.advance_paid || 0,
      b.booking_date ? new Date(b.booking_date).toLocaleDateString("en-IN") : "",
      b.status || "",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bookings_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV file downloaded successfully");
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pipeline</span>
            {isRefetching && <RefreshCw className="size-3 animate-spin text-muted-foreground" />}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-0.5">Bookings & Agreements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage customer plot reservations, advance collections, and status approvals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2 text-xs">
            <FileSpreadsheet className="size-4" />
            Export CSV
          </Button>
          <Link to="/dashboard">
            <Button size="sm" className="gap-2 text-xs">
              <Layers className="size-4" />
              Site Mapper
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Bookings</span>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold">{stats.totalBookings}</div>
            <div className="text-xs text-muted-foreground mt-1">
              <span className="text-emerald-600 font-medium">{stats.approvedCount} approved</span> · {stats.pendingCount} pending
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Advance Realized</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <IndianRupee className="size-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold">₹{stats.totalCollected.toLocaleString("en-IN")}</div>
            <div className="text-xs text-muted-foreground mt-1">Down payment collected</div>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Deal Pipeline</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold">₹{stats.totalDealValue.toLocaleString("en-IN")}</div>
            <div className="text-xs text-muted-foreground mt-1">Gross plot contract value</div>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Action Required</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pendingCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Bookings awaiting approval</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border rounded-xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-3 justify-between">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search customer, plot, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Project Filter */}
            {projectsList.length > 0 && (
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-full sm:w-[170px] h-9 text-xs">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projectsList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Sort Filter */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs">
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="size-3.5 text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="amount_high">Amount: High to Low</SelectItem>
                <SelectItem value="amount_low">Amount: Low to High</SelectItem>
              </SelectContent>
            </Select>

            {(searchQuery || selectedStatus !== "all" || selectedProject !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedStatus("all");
                  setSelectedProject("all");
                }}
                className="text-xs h-9 px-2 text-muted-foreground hover:text-foreground"
              >
                Reset Filters
              </Button>
            )}
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t scrollbar-none">
          {[
            { id: "all", label: "All Bookings", count: bookings.length },
            { id: "pending", label: "Pending", count: bookings.filter((b: any) => b.status === "pending").length },
            { id: "approved", label: "Approved", count: bookings.filter((b: any) => b.status === "approved").length },
            { id: "on_hold", label: "On Hold", count: bookings.filter((b: any) => b.status === "on_hold").length },
            { id: "rejected", label: "Rejected", count: bookings.filter((b: any) => b.status === "rejected").length },
            { id: "cancelled", label: "Cancelled", count: bookings.filter((b: any) => b.status === "cancelled").length },
          ].map((tab) => {
            const isSelected = selectedStatus === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 text-[10px] rounded-full font-semibold ${
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted-foreground/15 text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bookings Table / Card View */}
      {isLoading ? (
        <div className="bg-card border rounded-xl p-12 text-center text-muted-foreground space-y-3">
          <RefreshCw className="size-6 animate-spin mx-auto text-primary" />
          <p className="text-sm">Loading bookings & agreement records...</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center space-y-3">
          <Building2 className="size-10 mx-auto text-muted-foreground/50" />
          <h3 className="font-semibold text-lg">No Bookings Found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {searchQuery || selectedStatus !== "all" || selectedProject !== "all"
              ? "No booking records match your filter criteria. Try clearing filters."
              : "No booking reservations have been recorded yet."}
          </p>
          {(searchQuery || selectedStatus !== "all" || selectedProject !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedStatus("all");
                setSelectedProject("all");
              }}
              className="text-xs mt-2"
            >
              Clear All Filters
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-card border rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                    <th className="p-4 font-semibold">Project & Plot</th>
                    <th className="p-4 font-semibold">Customer Details</th>
                    <th className="p-4 font-semibold">Financials & Payment Progress</th>
                    <th className="p-4 font-semibold">Date Booked</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredBookings.map((b: any) => {
                    const statusObj = statusConfig[b.status] || statusConfig.pending;
                    const StatusIcon = statusObj.icon;
                    const advance = Number(b.advance_paid || 0);
                    const total = Number(b.total_price || 1);
                    const percentPaid = Math.min(100, Math.round((advance / total) * 100));

                    return (
                      <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            {b.plots?.projects?.name || "Unassigned Project"}
                            {b.plots?.projects?.id && (
                              <Link
                                to="/projects/$id"
                                params={{ id: b.plots.projects.id }}
                                className="text-muted-foreground hover:text-primary transition-colors"
                                title="View Project"
                              >
                                <ExternalLink className="size-3.5" />
                              </Link>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            {b.plots?.projects?.code && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {b.plots.projects.code}
                              </Badge>
                            )}
                            <span className="font-medium text-foreground/80">Plot #{b.plots?.plot_number ?? "N/A"}</span>
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="font-medium text-foreground">{b.customer_name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{b.customer_phone}</div>
                        </td>

                        <td className="p-4">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-foreground">
                              ₹{total.toLocaleString("en-IN")}
                            </span>
                            <span className="text-muted-foreground">
                              ₹{advance.toLocaleString("en-IN")} paid ({percentPaid}%)
                            </span>
                          </div>
                          <Progress value={percentPaid} className="h-1.5" />
                        </td>

                        <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                          {b.booking_date
                            ? new Date(b.booking_date).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "N/A"}
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${statusObj.style}`}
                          >
                            <StatusIcon className="size-3.5 shrink-0" />
                            {statusObj.label}
                          </span>
                        </td>

                        <td className="p-4 text-right">
                          {isAdmin ? (
                            <Select
                              value={b.status}
                              onValueChange={(status: any) =>
                                update.mutate({ id: b.id, plotId: b.plot_id, status })
                              }
                            >
                              <SelectTrigger className="w-[140px] h-8 text-xs ml-auto">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="on_hold">On Hold</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground font-mono">View Only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List View */}
          <div className="lg:hidden space-y-4">
            {filteredBookings.map((b: any) => {
              const statusObj = statusConfig[b.status] || statusConfig.pending;
              const StatusIcon = statusObj.icon;
              const advance = Number(b.advance_paid || 0);
              const total = Number(b.total_price || 1);
              const percentPaid = Math.min(100, Math.round((advance / total) * 100));

              return (
                <div key={b.id} className="bg-card border rounded-xl p-4 space-y-3 shadow-xs">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-semibold text-base flex items-center gap-1.5">
                        {b.plots?.projects?.name || "Unassigned Project"}
                        {b.plots?.projects?.id && (
                          <Link to="/projects/$id" params={{ id: b.plots.projects.id }}>
                            <ExternalLink className="size-3.5 text-muted-foreground" />
                          </Link>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        {b.plots?.projects?.code && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {b.plots.projects.code}
                          </Badge>
                        )}
                        <span className="font-medium text-foreground">Plot #{b.plots?.plot_number ?? "N/A"}</span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full border font-medium whitespace-nowrap ${statusObj.style}`}
                    >
                      <StatusIcon className="size-3 shrink-0" />
                      {statusObj.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 py-2.5 border-y text-xs">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        Customer
                      </div>
                      <div className="font-semibold text-foreground mt-0.5">{b.customer_name}</div>
                      <div className="text-muted-foreground mt-0.5">{b.customer_phone}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        Deal Financials
                      </div>
                      <div className="font-semibold text-foreground mt-0.5">₹{total.toLocaleString("en-IN")}</div>
                      <div className="text-muted-foreground mt-0.5">₹{advance.toLocaleString("en-IN")} paid</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Payment Realization</span>
                      <span>{percentPaid}%</span>
                    </div>
                    <Progress value={percentPaid} className="h-1.5" />
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-2 text-xs text-muted-foreground border-t">
                    <div>
                      Booked:{" "}
                      {b.booking_date
                        ? new Date(b.booking_date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "N/A"}
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-[11px] font-medium text-muted-foreground">Update:</span>
                        <Select
                          value={b.status}
                          onValueChange={(status: any) =>
                            update.mutate({ id: b.id, plotId: b.plot_id, status })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs flex-1 sm:w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="on_hold">On Hold</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
