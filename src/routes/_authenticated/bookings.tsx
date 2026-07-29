import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/bookings")({
  component: BookingsPage,
});

const statusStyle: Record<string, string> = {
  pending: "bg-plot-pending/15 text-[color:var(--plot-pending)] border-plot-pending/30",
  approved: "bg-plot-available/15 text-plot-available border-plot-available/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  on_hold: "bg-plot-reserved/15 text-plot-reserved border-plot-reserved/30",
};

function BookingsPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();

  const { data: role } = useQuery({
    queryKey: ["role", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: user.id });
      return (data as string) ?? "employee";
    },
  });

  const isAdmin = role === "admin" || role === "super_admin";

  const { data: bookings } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, plots(id, plot_number, projects(name, code))")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, plotId, status }: { id: string; plotId?: string; status: "approved" | "rejected" | "cancelled" | "on_hold" | "pending" }) => {
      const { error } = await supabase.from("bookings").update({
        status, approved_by: user.id,
      }).eq("id", id);
      if (error) throw error;

      if (plotId) {
        if (status === "approved") {
          await supabase.from("plots").update({ status: "booked" }).eq("id", plotId);
        } else if (status === "cancelled" || status === "rejected") {
          await supabase.from("plots").update({ status: "available", selected_lead_id: null } as any).eq("id", plotId);
        }
      }
    },
    onSuccess: () => {
      toast.success("Booking updated");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm text-muted-foreground uppercase tracking-wider">Pipeline</p>
        <h1 className="text-display text-4xl mt-1">Bookings</h1>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-4 font-medium">Project · Plot</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Status</th>
                {isAdmin && <th className="p-4 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {bookings?.map((b: any) => (
                <tr key={b.id} className="border-t hover:bg-muted/30">
                  <td className="p-4">
                    <div className="font-medium">{b.plots?.projects?.name}</div>
                    <div className="text-xs text-muted-foreground">{b.plots?.projects?.code} · Plot {b.plots?.plot_number}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium">{b.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{b.customer_phone}</div>
                  </td>
                  <td className="p-4">
                    <div>₹{Number(b.total_price).toLocaleString("en-IN")}</div>
                    <div className="text-xs text-muted-foreground">₹{Number(b.advance_paid).toLocaleString("en-IN")} paid</div>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {new Date(b.booking_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${statusStyle[b.status]}`}>
                      {b.status.replace("_", " ")}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="p-4 text-right">
                      <Select
                        value={b.status}
                        onValueChange={(status: any) =>
                          update.mutate({ id: b.id, plotId: b.plot_id, status })
                        }
                      >
                        <SelectTrigger className="w-[125px] h-8 text-xs ml-auto capitalize">
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
                    </td>
                  )}
                </tr>
              ))}
              {bookings && bookings.length === 0 && (
                <tr><td colSpan={isAdmin ? 6 : 5} className="p-8 text-center text-muted-foreground">
                  No bookings yet.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List View */}
      <div className="md:hidden space-y-4">
        {bookings?.map((b: any) => (
          <div key={b.id} className="bg-card border rounded-lg p-4 space-y-3 shadow-xs">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-semibold text-base">{b.plots?.projects?.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {b.plots?.projects?.code} · Plot {b.plots?.plot_number}
                </div>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border capitalize whitespace-nowrap ${statusStyle[b.status]}`}>
                {b.status.replace("_", " ")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 py-2 border-y text-sm">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Customer</div>
                <div className="font-medium mt-0.5">{b.customer_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{b.customer_phone}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Financials</div>
                <div className="font-medium mt-0.5">₹{Number(b.total_price).toLocaleString("en-IN")}</div>
                <div className="text-xs text-muted-foreground mt-0.5">₹{Number(b.advance_paid).toLocaleString("en-IN")} paid</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-1 text-xs text-muted-foreground">
              <div>
                Booked on: {new Date(b.booking_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
                  <span className="text-[11px] font-medium text-muted-foreground">Status:</span>
                  <Select
                    value={b.status}
                    onValueChange={(status: any) =>
                      update.mutate({ id: b.id, plotId: b.plot_id, status })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs flex-1 sm:w-[130px] capitalize">
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
        ))}
        {bookings && bookings.length === 0 && (
          <div className="bg-card border rounded-lg p-8 text-center text-muted-foreground">
            No bookings yet.
          </div>
        )}
      </div>

    </div>
  );
}
