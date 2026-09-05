import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  LocateFixed,
  MapPin,
  Upload,
  ArrowRight,
  ExternalLink,
  Navigation,
  ShieldCheck,
  Eye,
  Clock,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { LeadRow } from "@/components/site-mapper/types";

const POOR_ACCURACY_METERS = 50;

export function SiteVisitProofPanel({
  lead,
  userId,
  canCapture,
  canReview,
}: {
  lead: LeadRow;
  userId: string;
  canCapture: boolean;
  canReview: boolean;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [location, setLocation] = useState<GeolocationPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string>("");
  const [correction, setCorrection] = useState("");
  const [deleteConfirmVisit, setDeleteConfirmVisit] = useState<any | null>(null);

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["site-visits", lead.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("site_visits")
        .select("*, site_visit_photos(*)")
        .eq("lead_id", lead.id)
        .order("arrived_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeVisit = useMemo(
    () =>
      visits.find((visit: any) => visit.status === "in_progress" && visit.employee_id === userId),
    [visits, userId],
  );

  const locateAndLaunch = () => {
    if (!navigator.geolocation) {
      toast.error("GPS hardware is not available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocation(position);
        setLocating(false);
        toast.success(`GPS coordinates locked (±${Math.round(position.coords.accuracy)}m). Launching Field Studio…`);

        // Reverse geocode preview
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=18`
          );
          if (res.ok) {
            const data = await res.json();
            setResolvedAddress(data.display_name || "");
          }
        } catch {
          // ignore
        }

        // Navigate to dedicated Field Site Visit Studio
        navigate({
          to: "/site-visits/$leadId",
          params: { leadId: lead.id },
        });
      },
      (err) => {
        setLocating(false);
        toast.error(`Location permission required: ${err.message}. Please allow access to proceed.`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "verified" | "needs_review" }) => {
      const { error } = await (supabase as any)
        .from("site_visits")
        .update({ status, reviewed_by: userId, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visit proof status updated.");
      qc.invalidateQueries({ queryKey: ["site-visits", lead.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addCorrection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("site_visits")
        .update({ correction_note: correction })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setCorrection("");
      toast.success("Correction note saved; original evidence is unchanged.");
      qc.invalidateQueries({ queryKey: ["site-visits", lead.id] });
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
            console.warn("Storage delete error:", e);
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
      qc.invalidateQueries({ queryKey: ["site-visits", lead.id] });
      qc.invalidateQueries({ queryKey: ["admin-site-visits"] });
    },
    onError: (err: Error) => toast.error(`Delete failed: ${err.message}`),
  });

  return (
    <section className="space-y-4 border-t border-border/50 px-6 py-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-terracotta" /> Geotagged Site Visit Proof
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            GPS-confirmed arrival, physical boundary evidence, and attendance verification.
          </p>
        </div>

        <Link
          to="/visit-proofs"
          className="text-xs text-terracotta hover:underline font-semibold inline-flex items-center gap-1"
        >
          <span>Proofs Hub</span>
          <ArrowRight className="size-3" />
        </Link>
      </div>

      {/* START FIELD SITE VISIT LAUNCHPAD */}
      {canCapture && (
        <div className="relative overflow-hidden rounded-2xl border border-terracotta/30 bg-linear-to-br from-terracotta/[0.08] via-terracotta/[0.03] to-transparent p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-terracotta/20 text-terracotta">
                  <Sparkles className="size-3" /> Dedicated Field Studio
                </span>
                {location && (
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" /> GPS Ready ±{Math.round(location.coords.accuracy)}m
                  </span>
                )}
              </div>
              <h4 className="text-base font-bold text-foreground">
                Conduct On-Site Customer Visit
              </h4>
              <p className="text-xs text-muted-foreground max-w-md">
                Pings high-accuracy GPS satellite lock, opens full-screen camera inspection cockpit, and watermarks evidentiary photos.
              </p>
            </div>

            <Button
              className="bg-terracotta hover:bg-terracotta/90 text-white font-bold text-xs gap-2 px-5 py-3 rounded-xl shadow-md cursor-pointer self-start sm:self-auto shrink-0 transition-all hover:scale-[1.02]"
              disabled={locating}
              onClick={locateAndLaunch}
            >
              {locating ? (
                <>
                  <LocateFixed className="size-4 animate-spin text-white" />
                  <span>Locking GPS Satellites…</span>
                </>
              ) : (
                <>
                  <Navigation className="size-4 text-white" />
                  <span>Start Site Visit</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          </div>

          {locating && (
            <div className="mt-3 p-3 rounded-xl bg-background/80 border border-terracotta/20 text-xs flex items-center gap-2.5 animate-pulse">
              <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-muted-foreground">
                Requesting device location & calibrating field satellite accuracy…
              </span>
            </div>
          )}
        </div>
      )}

      {/* VISIT HISTORY LIST */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
            Visit Records ({visits.length})
          </p>
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading site visit records…</p>
        ) : visits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 p-5 text-center space-y-1">
            <Camera className="size-6 mx-auto text-muted-foreground/60" />
            <p className="text-xs font-medium text-foreground">No site visits recorded yet.</p>
            <p className="text-[11px] text-muted-foreground">
              Use the "Start Site Visit" button above when meeting the customer on the plot.
            </p>
          </div>
        ) : (
          visits.map((visit: any) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              canReview={canReview}
              canCorrect={visit.employee_id === userId && visit.status !== "in_progress"}
              correction={correction}
              onCorrection={setCorrection}
              onSaveCorrection={() => addCorrection.mutate(visit.id)}
              onReview={(status: "verified" | "needs_review") => review.mutate({ id: visit.id, status })}
              onDelete={setDeleteConfirmVisit}
              canDelete={canReview || canCapture || visit.employee_id === userId}
            />
          ))
        )}
      </div>

      {/* DELETE CONFIRMATION DIALOG */}
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
              <span className="font-bold text-foreground">{lead.name}</span>
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
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
              onClick={() => deleteConfirmVisit && deleteVisit.mutate(deleteConfirmVisit)}
              disabled={deleteVisit.isPending}
            >
              {deleteVisit.isPending ? "Deleting Proof…" : "Delete Permanently"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function VisitCard({
  visit,
  canReview,
  canCorrect,
  correction,
  onCorrection,
  onSaveCorrection,
  onReview,
  onDelete,
  canDelete,
}: any) {
  const [expanded, setExpanded] = useState(false);

  const statusClass =
    visit.status === "verified"
      ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400"
      : visit.status === "needs_review"
        ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400"
        : visit.status === "in_progress"
          ? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300"
          : "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400";

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-xs text-foreground flex items-center gap-1.5">
            <Clock className="size-3.5 text-terracotta" />
            {new Date(visit.arrived_at).toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          <a
            target="_blank"
            rel="noreferrer"
            href={`https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-terracotta hover:underline font-medium"
          >
            <MapPin className="size-3" />
            GPS Pin: {visit.latitude.toFixed(4)}°, {visit.longitude.toFixed(4)}° (±{Math.round(Number(visit.accuracy_meters))}m)
            <ExternalLink className="size-2.5" />
          </a>
        </div>

        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide border ${statusClass}`}>
            {visit.status.replace("_", " ")}
          </span>
          {canDelete && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/60 dark:hover:bg-rose-950/50 font-semibold cursor-pointer transition-colors"
              onClick={() => onDelete(visit)}
              title="Delete Site Visit Proof"
            >
              <Trash2 className="size-3 mr-1 text-rose-500" /> Delete
            </Button>
          )}
        </div>
      </div>

      {visit.notes && (
        <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40 text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
          {visit.notes}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
        <span className="flex items-center gap-1.5 font-medium">
          <Camera className="size-3.5 text-foreground" />
          {visit.site_visit_photos?.length ?? 0} Evidence Photos
        </span>

        <div className="flex items-center gap-2">
          <Link
            to="/visit-proofs"
            className="text-xs text-terracotta hover:underline font-semibold inline-flex items-center gap-1"
          >
            <Eye className="size-3" /> View in Proofs Hub
          </Link>
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold cursor-pointer"
              onClick={() => onDelete(visit)}
              title="Delete Visit Proof"
            >
              <Trash2 className="size-3 mr-1" /> Delete Proof
            </Button>
          )}
        </div>
      </div>

      {canReview && visit.status === "submitted" && (
        <div className="pt-2 flex items-center justify-between gap-2 border-t border-border/40">
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer" onClick={() => onReview("verified")}>
              <CheckCircle2 className="size-3 mr-1" /> Verify Proof
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs font-semibold cursor-pointer" onClick={() => onReview("needs_review")}>
              Flag / Needs Review
            </Button>
          </div>
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-semibold cursor-pointer"
              onClick={() => onDelete(visit)}
            >
              <Trash2 className="size-3 mr-1" /> Delete
            </Button>
          )}
        </div>
      )}

      {canCorrect && (
        <div className="pt-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-terracotta hover:underline font-medium cursor-pointer"
          >
            {expanded ? "Cancel note" : "+ Add agent correction note"}
          </button>
          {expanded && (
            <div className="mt-2 flex gap-2">
              <Input
                value={correction}
                onChange={(e) => onCorrection(e.target.value)}
                placeholder="Correction explanation (original GPS evidence is immutable)…"
                className="h-8 text-xs"
              />
              <Button size="sm" className="h-8 text-xs" disabled={!correction.trim()} onClick={onSaveCorrection}>
                Save
              </Button>
            </div>
          )}
          {visit.correction_note && (
            <p className="mt-1.5 text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-lg">
              Correction: {visit.correction_note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
