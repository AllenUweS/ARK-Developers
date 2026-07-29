import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, MapPin, Search, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function VisitProofsWorkspace({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [project, setProject] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["admin-site-visits"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("site_visits")
        .select("*, site_visit_photos(*)")
        .order("arrived_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["visit-proof-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["visit-proof-leads"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("plot_leads").select("id, name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["visit-proof-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name").eq("status", "live").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: plots = [] } = useQuery({
    queryKey: ["visit-proof-plots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plots").select("id, plot_number");
      if (error) throw error;
      return data ?? [];
    },
  });
  const profileById = useMemo(() => new Map<string, any>(profiles.map((row: any) => [row.id, row])), [profiles]);
  const leadById = useMemo(() => new Map<string, any>(leads.map((row: any) => [row.id, row])), [leads]);
  const projectById = useMemo(() => new Map<string, any>(projects.map((row: any) => [row.id, row])), [projects]);
  const plotById = useMemo(() => new Map<string, any>(plots.map((row: any) => [row.id, row])), [plots]);
  const filtered = useMemo(
    () =>
      visits.filter((visit: any) => {
        const employee = profileById.get(visit.employee_id);
        const lead = leadById.get(visit.lead_id);
        const haystack =
          `${employee?.full_name ?? ""} ${employee?.email ?? ""} ${lead?.name ?? ""}`.toLowerCase();
        const date = visit.arrived_at.slice(0, 10);
        return (
          (!search || haystack.includes(search.toLowerCase())) &&
          (status === "all" || visit.status === status) &&
          (project === "all" || visit.project_id === project) &&
          (!from || date >= from) &&
          (!to || date <= to)
        );
      }),
    [visits, profileById, leadById, search, status, project, from, to],
  );
  const review = useMutation({
    mutationFn: async ({ id, nextStatus }: { id: string; nextStatus: string }) => {
      const { error } = await (supabase as any)
        .from("site_visits")
        .update({
          status: nextStatus,
          review_note: reviewNotes[id] || null,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visit review saved.");
      qc.invalidateQueries({ queryKey: ["admin-site-visits"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-3xl">Visit proofs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review GPS-backed site evidence submitted by your team.
        </p>
      </div>
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 h-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee or customer…"
            />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-full sm:w-[180px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="needs_review">Needs review</SelectItem>
            </SelectContent>
          </Select>
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger className="h-9 w-full sm:w-[180px]">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((row: any) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              aria-label="From date"
              className="h-9 w-full sm:w-[140px]"
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              aria-label="To date"
              className="h-9 w-full sm:w-[140px]"
            />
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {filtered.length} visit{filtered.length === 1 ? "" : "s"} shown
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading visit proofs…</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((visit: any) => (
            <VisitReviewCard
              key={visit.id}
              visit={visit}
              employee={profileById.get(visit.employee_id)}
              lead={leadById.get(visit.lead_id)}
              project={projectById.get(visit.project_id)}
              plot={plotById.get(visit.plot_id)}
              note={reviewNotes[visit.id] ?? visit.review_note ?? ""}
              onNote={(value: string) =>
                setReviewNotes((current) => ({ ...current, [visit.id]: value }))
              }
              onReview={(nextStatus: string) => review.mutate({ id: visit.id, nextStatus })}
              pending={review.isPending}
            />
          ))}
          {!filtered.length && (
            <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              No visit proofs match these filters.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function VisitReviewCard({
  visit,
  employee,
  lead,
  project,
  plot,
  note,
  onNote,
  onReview,
  pending,
}: any) {
  const { data: imageUrls = [] } = useQuery({
    queryKey: ["visit-proof-images", visit.id],
    enabled: !!visit.site_visit_photos?.length,
    queryFn: async () =>
      Promise.all(
        visit.site_visit_photos.map(async (photo: any) => ({
          id: photo.id,
          name: photo.file_name,
          url: (
            await supabase.storage
              .from("site-visit-proofs")
              .createSignedUrl(photo.storage_path, 3600)
          ).data?.signedUrl ?? "",
        })),
      ),
  });
  const badge =
    visit.status === "verified"
      ? "bg-emerald-50 text-emerald-700"
      : visit.status === "needs_review"
        ? "bg-amber-50 text-amber-700"
        : "bg-blue-50 text-blue-700";
  return (
    <article className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{lead?.name ?? "Lead"}</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${badge}`}>
              {visit.status.replace("_", " ")}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {employee?.full_name ?? employee?.email ?? "Employee"} · {project?.name ?? "Project"} ·
            Plot {plot?.plot_number ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Arrived {new Date(visit.arrived_at).toLocaleString("en-IN")} · GPS ±
            {Math.round(Number(visit.accuracy_meters))}m
          </p>
        </div>
        <a
          href={`https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-terracotta hover:underline"
        >
          <MapPin className="h-4 w-4" />
          Open map <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      {Number(visit.accuracy_meters) > 50 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700">
          <TriangleAlert className="h-4 w-4" />
          Poor GPS accuracy; verify this evidence carefully.
        </p>
      )}
      {visit.notes && <p className="mt-3 text-sm text-muted-foreground">{visit.notes}</p>}
      {visit.correction_note && (
        <p className="mt-2 text-xs text-muted-foreground">
          Employee correction: {visit.correction_note}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        {imageUrls.map(
          (image: any) =>
            image.url && (
              <a
                key={image.id}
                href={image.url}
                target="_blank"
                rel="noreferrer"
                className="group h-24 w-24 overflow-hidden rounded-lg border"
              >
                <img
                  src={image.url}
                  alt={image.name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </a>
            ),
        )}
      </div>
      <div className="mt-4 grid gap-2 border-t pt-4 md:grid-cols-[1fr_auto]">
        <Textarea
          value={note}
          onChange={(event) => onNote(event.target.value)}
          placeholder="Internal review note…"
          rows={2}
        />
        <div className="flex gap-2 md:flex-col">
          <Button
            size="sm"
            disabled={pending || visit.status === "in_progress"}
            onClick={() => onReview("verified")}
          >
            <CheckCircle2 className="mr-1 h-4 w-4" />
            Verify
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || visit.status === "in_progress"}
            onClick={() => onReview("needs_review")}
          >
            Needs review
          </Button>
        </div>
      </div>
    </article>
  );
}
