import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, ArrowRight } from "lucide-react";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsList,
});

const statusStyle: Record<string, string> = {
  live: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  upcoming: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  completed: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  archived: "bg-muted text-muted-foreground border-border",
};

function ProjectsList() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const { data: role } = useQuery({
    queryKey: ["role", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: user.id });
      return (data as string) ?? "employee";
    },
  });
  const isAdmin = role === "admin" || role === "super_admin";

  const { data: projects } = useQuery({
    queryKey: ["projects", role],
    enabled: !!role,
    queryFn: async () => {
      let query = supabase
        .from("projects")
        .select("*, plots(id, status)")
        .order("created_at", { ascending: false });

      if (!isAdmin) {
        query = query.eq("status", "live");
      }

      const { data } = await query;
      return data ?? [];
    },
  });

  const updateProjectStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "upcoming" | "live" | "completed" | "archived" }) => {
      const { error } = await supabase.from("projects").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success(`Project status updated to ${vars.status}`);
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update project status"),
  });

  const filteredProjects = (projects ?? []).filter((p: any) => {
    if (!isAdmin && p.status !== "live") return false;
    if (filter === "all") return true;
    return p.status === filter;
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Portfolio</p>
          <h1 className="text-display text-4xl mt-1">Projects</h1>
        </div>
        {isAdmin && <CreateProjectDialog />}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {["all", "live", "upcoming", "completed", "archived"].map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize border transition-all ${
                filter === st
                  ? "bg-terracotta text-white border-terracotta shadow-xs"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {st === "all" ? "All Projects" : st}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.map((p: any) => {
          const total = p.plots?.length ?? 0;
          const available = p.plots?.filter((x: any) => x.status === "available").length ?? 0;
          const booked = p.plots?.filter((x: any) => x.status === "booked" || x.status === "sold").length ?? 0;
          const pct = total > 0 ? Math.round((booked / total) * 100) : 0;
          const isLive = p.status === "live";

          return (
            <Link
              key={p.id}
              to="/projects/$id"
              params={{ id: p.id }}
              className="group bg-card border rounded-lg overflow-hidden hover:shadow-md transition-all cursor-pointer relative"
            >
              <div className="aspect-[4/3] overflow-hidden bg-muted relative">
                {p.cover_image_url && (
                  <img src={p.cover_image_url} alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                )}
                {isAdmin && !isLive && (
                  <span className="absolute top-3 left-3 bg-amber-500/90 text-white text-[11px] font-semibold px-2 py-0.5 rounded shadow">
                    Hidden from non-admins
                  </span>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{p.code}</p>
                    <h3 className="text-display text-xl mt-1">{p.name}</h3>
                  </div>
                  {isAdmin ? (
                    <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                      <Select
                        value={p.status}
                        onValueChange={(val: any) => updateProjectStatus.mutate({ id: p.id, status: val })}
                      >
                        <SelectTrigger className={`h-6 px-2 text-[11px] font-medium capitalize rounded-full border ${statusStyle[p.status] ?? ""}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                          <SelectItem value="upcoming" className="text-xs">Upcoming (Offline)</SelectItem>
                          <SelectItem value="live" className="text-xs">Live (Public/Visible)</SelectItem>
                          <SelectItem value="completed" className="text-xs">Completed (Offline)</SelectItem>
                          <SelectItem value="archived" className="text-xs">Archived (Offline)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${statusStyle[p.status] ?? ""}`}>
                      {p.status}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {p.location}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-plot-available font-medium">{available}</span>
                    <span className="text-muted-foreground"> available</span>
                    <span className="mx-2 text-border">·</span>
                    <span className="text-plot-booked font-medium">{booked}</span>
                    <span className="text-muted-foreground"> booked</span>
                  </div>
                  <span className="text-muted-foreground">{pct}%</span>
                </div>
                <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-terracotta transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-4 flex items-center text-sm text-terracotta font-medium">
                  Open project <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          );
        })}
        {filteredProjects.length === 0 && (
          <div className="col-span-full py-12 text-center border border-dashed rounded-lg bg-muted/20">
            <p className="text-muted-foreground font-medium">No live projects available at the moment.</p>
            {isAdmin && (
              <p className="text-xs text-muted-foreground mt-1">
                You can create a new project or change an existing project's status to Live.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
