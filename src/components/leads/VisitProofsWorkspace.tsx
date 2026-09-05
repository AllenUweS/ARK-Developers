import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ExternalLink,
  MapPin,
  Search,
  TriangleAlert,
  ShieldCheck,
  Camera,
  Calendar,
  Phone,
  MessageCircle,
  Eye,
  X,
  Layers,
  Sparkles,
  Map as MapIcon,
  LayoutGrid,
  Trash2,
} from "lucide-react";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function VisitProofsWorkspace({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [project, setProject] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [selectedPhoto, setSelectedPhoto] = useState<{
    id: string;
    visitId: string;
    storagePath: string;
    url: string;
    name: string;
  } | null>(null);
  const [deleteConfirmVisit, setDeleteConfirmVisit] = useState<any | null>(null);

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
      const { data, error } = await (supabase as any).from("plot_leads").select("id, name, phone");
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

  const profileById = useMemo(() => {
    const map = new Map();
    profiles.forEach((row: any) => map.set(row.id, row));
    return map;
  }, [profiles]);

  const leadById = useMemo(() => {
    const map = new Map();
    leads.forEach((row: any) => map.set(row.id, row));
    return map;
  }, [leads]);

  const projectById = useMemo(() => {
    const map = new Map();
    projects.forEach((row: any) => map.set(row.id, row));
    return map;
  }, [projects]);

  const plotById = useMemo(() => {
    const map = new Map();
    plots.forEach((row: any) => map.set(row.id, row));
    return map;
  }, [plots]);

  const stats = useMemo(() => {
    const total = visits.length;
    const verified = visits.filter((v: any) => v.status === "verified").length;
    const submitted = visits.filter((v: any) => v.status === "submitted").length;
    const needsReview = visits.filter((v: any) => v.status === "needs_review").length;
    return { total, verified, submitted, needsReview };
  }, [visits]);

  const filtered = useMemo(
    () =>
      visits.filter((visit: any) => {
        const employee = profileById.get(visit.employee_id);
        const lead = leadById.get(visit.lead_id);
        const haystack =
          `${employee?.full_name ?? ""} ${employee?.email ?? ""} ${lead?.name ?? ""} ${lead?.phone ?? ""}`.toLowerCase();
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
      toast.success("Site visit review saved.");
      qc.invalidateQueries({ queryKey: ["admin-site-visits"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteVisit = useMutation({
    mutationFn: async (visit: any) => {
      // 1. Remove storage photos if any
      if (visit.site_visit_photos && visit.site_visit_photos.length > 0) {
        const paths = visit.site_visit_photos
          .map((p: any) => p.storage_path)
          .filter(Boolean);
        if (paths.length > 0) {
          try {
            await supabase.storage.from("site-visit-proofs").remove(paths);
          } catch (e) {
            console.warn("Storage deletion error:", e);
          }
        }
      }

      // 2. Try secure RPC delete first
      const { error: rpcError } = await (supabase as any).rpc("delete_site_visit", {
        p_visit_id: visit.id,
      });

      if (rpcError) {
        console.warn("RPC delete_site_visit unavailable, falling back to direct table delete:", rpcError);
        // Delete photo rows first to avoid FK constraint issues
        await (supabase as any)
          .from("site_visit_photos")
          .delete()
          .eq("visit_id", visit.id);

        const { error: tableError } = await (supabase as any)
          .from("site_visits")
          .delete()
          .eq("id", visit.id);

        if (tableError) throw tableError;
      }
    },
    onSuccess: () => {
      toast.success("Site visit proof deleted successfully.");
      setDeleteConfirmVisit(null);
      qc.invalidateQueries({ queryKey: ["admin-site-visits"] });
      qc.invalidateQueries({ queryKey: ["site-visits"] });
    },
    onError: (err: Error) => {
      toast.error(`Delete failed: ${err.message}`);
    },
  });

  const deletePhoto = useMutation({
    mutationFn: async ({ photoId, storagePath, visitId }: { photoId: string; storagePath: string; visitId: string }) => {
      if (storagePath) {
        try {
          await supabase.storage.from("site-visit-proofs").remove([storagePath]);
        } catch (e) {
          console.warn("Storage photo remove failed:", e);
        }
      }
      const { error } = await (supabase as any)
        .from("site_visit_photos")
        .delete()
        .eq("id", photoId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success("Evidence photo removed.");
      setSelectedPhoto(null);
      qc.invalidateQueries({ queryKey: ["visit-proof-images", variables.visitId] });
      qc.invalidateQueries({ queryKey: ["admin-site-visits"] });
      qc.invalidateQueries({ queryKey: ["site-visits"] });
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete photo: ${err.message}`);
    },
  });

  return (
    <div className="space-y-6">
      {/* HEADER WITH STATS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-display text-2xl sm:text-3xl">Site Visit Proofs</h1>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-terracotta/10 text-terracotta border border-terracotta/20">
              Audit Vault
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Review GPS-backed field evidence, photographic proof, and customer attendance submitted by your sales executives.
          </p>
        </div>

        {/* VIEW MODE TOGGLE */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60 self-start sm:self-auto">
          <Button
            size="sm"
            variant={viewMode === "grid" ? "default" : "ghost"}
            className={`h-8 text-xs font-semibold rounded-lg ${viewMode === "grid" ? "bg-terracotta hover:bg-terracotta/90 text-white" : ""}`}
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="size-3.5 mr-1.5" /> Evidence Stream
          </Button>
          <Button
            size="sm"
            variant={viewMode === "map" ? "default" : "ghost"}
            className={`h-8 text-xs font-semibold rounded-lg ${viewMode === "map" ? "bg-terracotta hover:bg-terracotta/90 text-white" : ""}`}
            onClick={() => setViewMode("map")}
          >
            <MapIcon className="size-3.5 mr-1.5" /> Geospatial Map
          </Button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-2xl border border-border/70 p-4 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Total Visits</p>
          <p className="text-2xl font-black text-foreground mt-1">{stats.total}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/70 p-4 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">Verified Evidence</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{stats.verified}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/70 p-4 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600">Pending Review</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{stats.submitted}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/70 p-4 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600">Flagged</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{stats.needsReview}</p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 h-9 text-xs"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search executive, customer name, or phone…"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-[150px] text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="submitted">Submitted (Pending)</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="needs_review">Needs review</SelectItem>
              </SelectContent>
            </Select>

            <Select value={project} onValueChange={setProject}>
              <SelectTrigger className="h-9 w-[150px] text-xs">
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

            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                aria-label="From date"
                className="h-9 w-[130px] text-xs"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <Input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                aria-label="To date"
                className="h-9 w-[130px] text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{filtered.length} visit record{filtered.length === 1 ? "" : "s"} shown</span>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-xs text-muted-foreground">Loading site visit records…</div>
      ) : viewMode === "map" ? (
        /* MAP RADAR VIEW WITH VISIT STREAM */
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden p-4 space-y-4 shadow-xs">
            <div className="h-[420px] w-full rounded-xl overflow-hidden border relative bg-muted flex items-center justify-center">
              {filtered.length > 0 ? (
                <iframe
                  title="Geospatial Visits Map"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight={0}
                  marginWidth={0}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${filtered[0].longitude - 0.03}%2C${filtered[0].latitude - 0.03}%2C${filtered[0].longitude + 0.03}%2C${filtered[0].latitude + 0.03}&layer=mapnik&marker=${filtered[0].latitude}%2C${filtered[0].longitude}`}
                  className="w-full h-full"
                />
              ) : (
                <p className="text-xs text-muted-foreground">No visits with coordinates to plot.</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Map centered on latest visit coordinates. Review, audit, or delete individual site visits below.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">Plotted Visit Records ({filtered.length})</h2>
            </div>
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
                onPhotoClick={setSelectedPhoto}
                onDelete={setDeleteConfirmVisit}
                onDeletePhoto={(photo: any) =>
                  deletePhoto.mutate({
                    photoId: photo.id,
                    storagePath: photo.storage_path,
                    visitId: visit.id,
                  })
                }
              />
            ))}
          </div>
        </div>
      ) : (
        /* GRID / EVIDENCE STREAM VIEW */
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
              onPhotoClick={setSelectedPhoto}
              onDelete={setDeleteConfirmVisit}
              onDeletePhoto={(photo: any) =>
                deletePhoto.mutate({
                  photoId: photo.id,
                  storagePath: photo.storage_path,
                  visitId: visit.id,
                })
              }
            />
          ))}

          {!filtered.length && (
            <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center space-y-2">
              <Camera className="size-8 mx-auto text-muted-foreground/60" />
              <p className="text-sm font-semibold text-foreground">No visit proofs found</p>
              <p className="text-xs text-muted-foreground">
                No site visits match the active filters. Clear search or check back after field visits.
              </p>
            </div>
          )}
        </div>
      )}

      {/* FULL PHOTO LIGHTBOX DIALOG WITH DELETE PHOTO OPTION */}
      <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-none">
          {selectedPhoto && (
            <div className="relative flex flex-col">
              <div className="p-3 bg-black/80 flex items-center justify-between text-white border-b border-white/10 gap-3">
                <span className="text-xs font-mono font-bold uppercase text-emerald-400 truncate">
                  {selectedPhoto.name}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedPhoto.id && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2.5 text-xs bg-rose-600/90 hover:bg-rose-600 text-white font-semibold cursor-pointer"
                      onClick={() => {
                        if (window.confirm("Remove this specific evidence photo from this visit proof?")) {
                          deletePhoto.mutate({
                            photoId: selectedPhoto.id,
                            storagePath: selectedPhoto.storagePath,
                            visitId: selectedPhoto.visitId,
                          });
                        }
                      }}
                      disabled={deletePhoto.isPending}
                    >
                      <Trash2 className="size-3 mr-1" />
                      {deletePhoto.isPending ? "Removing…" : "Delete Photo"}
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedPhoto(null)}
                    className="size-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
              <div className="max-h-[80vh] flex items-center justify-center p-2">
                <img
                  src={selectedPhoto.url}
                  alt={selectedPhoto.name}
                  className="max-h-[75vh] w-auto object-contain rounded-lg shadow-2xl"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DELETE VISIT PROOF CONFIRMATION DIALOG */}
      <Dialog open={!!deleteConfirmVisit} onOpenChange={(open) => !open && setDeleteConfirmVisit(null)}>
        <DialogContent className="max-w-md p-6 space-y-4">
          <div className="flex items-center gap-3 text-rose-600">
            <div className="size-11 rounded-2xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
              <Trash2 className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Delete Site Visit Proof</h3>
              <p className="text-xs text-rose-600 font-medium">Permanent Evidentiary Deletion</p>
            </div>
          </div>

          <div className="bg-muted/40 rounded-xl p-3.5 border border-border/50 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lead Prospect:</span>
              <span className="font-bold text-foreground">
                {leadById.get(deleteConfirmVisit?.lead_id)?.name ?? "Lead"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Recorded By:</span>
              <span className="font-medium text-foreground">
                {profileById.get(deleteConfirmVisit?.employee_id)?.full_name ??
                  profileById.get(deleteConfirmVisit?.employee_id)?.email ??
                  "Executive"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Arrived At:</span>
              <span className="text-foreground">
                {deleteConfirmVisit?.arrived_at
                  ? new Date(deleteConfirmVisit.arrived_at).toLocaleString("en-IN")
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Evidence Photos:</span>
              <span className="font-bold text-rose-600">
                {deleteConfirmVisit?.site_visit_photos?.length ?? 0} photos will be permanently purged
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to permanently delete this site visit record and all of its associated GPS-tagged evidence photos? This action cannot be undone.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDeleteConfirmVisit(null)}
              disabled={deleteVisit.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              onClick={() => deleteConfirmVisit && deleteVisit.mutate(deleteConfirmVisit)}
              disabled={deleteVisit.isPending}
            >
              {deleteVisit.isPending ? "Deleting Proof…" : "Delete Permanently"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
  onPhotoClick,
  onDelete,
  onDeletePhoto,
}: any) {
  const { data: imageUrls = [] } = useQuery({
    queryKey: ["visit-proof-images", visit.id],
    enabled: !!visit.site_visit_photos?.length,
    queryFn: async () =>
      Promise.all(
        visit.site_visit_photos.map(async (photo: any) => ({
          id: photo.id,
          name: photo.file_name || photo.photo_type || "Evidence Photo",
          storage_path: photo.storage_path,
          visit_id: visit.id,
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
      ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400"
      : visit.status === "needs_review"
        ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400"
        : "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400";

  return (
    <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-base text-foreground">{lead?.name ?? "Lead Prospect"}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide border ${badge}`}>
              {visit.status.replace("_", " ")}
            </span>
          </div>

          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">{employee?.full_name ?? employee?.email ?? "Executive"}</span>
            <span>•</span>
            <span>{project?.name ?? "Project"}</span>
            <span>•</span>
            <span className="font-bold text-foreground">Plot #{plot?.plot_number ?? "—"}</span>
            {lead?.phone && (
              <>
                <span>•</span>
                <a href={`tel:${lead.phone}`} className="hover:text-terracotta inline-flex items-center gap-1">
                  <Phone className="size-3 text-emerald-600" /> {lead.phone}
                </a>
              </>
            )}
          </p>

          <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-2">
            <span>Arrived {new Date(visit.arrived_at).toLocaleString("en-IN")}</span>
            <span>•</span>
            <span className="text-emerald-600 font-semibold">GPS Precision ±{Math.round(Number(visit.accuracy_meters))}m</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-terracotta hover:underline bg-terracotta/5 px-3 py-1.5 rounded-lg border border-terracotta/20"
          >
            <MapPin className="size-3.5" />
            Open on Map <ExternalLink className="size-3" />
          </a>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/60 dark:hover:bg-rose-950/50 font-semibold transition-colors cursor-pointer"
            onClick={() => onDelete(visit)}
            title="Delete this entire visit proof and all photos"
          >
            <Trash2 className="size-3.5 mr-1.5 text-rose-500" />
            Delete Proof
          </Button>
        </div>
      </div>

      {Number(visit.accuracy_meters) > 50 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
          <TriangleAlert className="size-4 shrink-0 text-amber-600" />
          <span>Notice: GPS accuracy was {Math.round(Number(visit.accuracy_meters))}m (over 50m). Verify boundary markers carefully.</span>
        </div>
      )}

      {visit.notes && (
        <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-xs text-foreground whitespace-pre-line leading-relaxed">
          {visit.notes}
        </div>
      )}

      {visit.correction_note && (
        <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-800 dark:text-blue-300">
          <strong>Agent Correction:</strong> {visit.correction_note}
        </div>
      )}

      {/* PHOTO GALLERY */}
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
          <Camera className="size-3 text-terracotta" /> Geotagged Proof Photos ({imageUrls.length})
        </p>
        <div className="flex flex-wrap gap-3">
          {imageUrls.map((image: any) =>
            image.url ? (
              <div key={image.id} className="group relative size-24 sm:size-28 rounded-xl overflow-hidden border border-border/80 bg-black shadow-xs">
                <button
                  type="button"
                  onClick={() =>
                    onPhotoClick({
                      id: image.id,
                      url: image.url,
                      name: image.name,
                      storagePath: image.storage_path,
                      visitId: image.visit_id,
                    })
                  }
                  className="size-full cursor-pointer"
                >
                  <img
                    src={image.url}
                    alt={image.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                    <Eye className="size-5" />
                  </div>
                </button>
                {onDeletePhoto && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm("Delete this specific evidence photo?")) {
                        onDeletePhoto(image);
                      }
                    }}
                    className="absolute top-1 right-1 size-6 rounded-md bg-black/70 hover:bg-rose-600 text-white/80 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer shadow-md"
                    title="Delete photo"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            ) : null,
          )}
        </div>
      </div>

      {/* REVIEW ACTIONS */}
      <div className="grid gap-3 border-t border-border/40 pt-4 md:grid-cols-[1fr_auto]">
        <Textarea
          value={note}
          onChange={(event) => onNote(event.target.value)}
          placeholder="Manager review remarks, verification feedback, or observations…"
          rows={2}
          className="text-xs resize-none"
        />
        <div className="flex gap-2 md:flex-col justify-end">
          <Button
            size="sm"
            disabled={pending}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
            onClick={() => onReview("verified")}
          >
            <CheckCircle2 className="size-3.5 mr-1" />
            Verify Proof
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            className="h-8 text-xs font-semibold cursor-pointer"
            onClick={() => onReview("needs_review")}
          >
            Needs Review
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold cursor-pointer"
            onClick={() => onDelete(visit)}
          >
            <Trash2 className="size-3.5 mr-1" />
            Delete Proof
          </Button>
        </div>
      </div>
    </article>
  );
}
