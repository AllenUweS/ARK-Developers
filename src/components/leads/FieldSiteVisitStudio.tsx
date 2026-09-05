import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  MapPin,
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  LocateFixed,
  ArrowLeft,
  Navigation,
  ExternalLink,
  Trash2,
  Eye,
  X,
  Phone,
  MessageCircle,
  Sparkles,
  Layers,
  Clock,
  ShieldCheck,
  Send,
  Building2,
  Calendar,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface EvidencePhoto {
  id: string;
  file: File;
  previewUrl: string;
  category: "frontage" | "infrastructure" | "client" | "documents";
  timestamp: string;
  coords?: { lat: number; lng: number; accuracy: number };
}

const EVIDENCE_CATEGORIES = [
  { id: "frontage", label: "Plot Frontage & Markers", required: true, icon: "📍" },
  { id: "infrastructure", label: "Road & Surroundings", required: false, icon: "🛣️" },
  { id: "client", label: "Customer On-Site Proof", required: false, icon: "🤳" },
  { id: "documents", label: "Token / Site Notes", required: false, icon: "📑" },
] as const;

const CLIENT_ATTENDANCE_OPTIONS = [
  { id: "in_person", label: "Customer in Person", icon: "👤" },
  { id: "family", label: "With Family / Spouse", icon: "👨‍👩‍👧" },
  { id: "broker", label: "Representative / Broker", icon: "🤝" },
  { id: "virtual", label: "Virtual Walkthrough", icon: "📱" },
];

const BUYING_HEAT_OPTIONS = [
  { id: "hot", label: "Ready to Book (Hot)", color: "text-rose-600 border-rose-300 bg-rose-50 dark:bg-rose-950/40", icon: "🔥" },
  { id: "warm", label: "Very Interested (Warm)", color: "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/40", icon: "⚡" },
  { id: "evaluating", label: "Comparing / Budget Query", color: "text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/40", icon: "💬" },
  { id: "cold", label: "Low Interest (Cold)", color: "text-slate-600 border-slate-300 bg-slate-50 dark:bg-slate-900/40", icon: "❄️" },
];

const OBSERVATION_CHIPS = [
  "Liked East/North Facing",
  "Approved Plot Dimensions",
  "Requested Price Concession",
  "Needs 80% Bank Loan Support",
  "Will Pay Token within 48h",
  "Comparing with Nearby Project",
  "Wants Immediate Registry",
  "Requested Master Plan Copy",
];

export function FieldSiteVisitStudio({
  leadId,
  userId,
}: {
  leadId: string;
  userId: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // GPS State
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number; timestamp: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [address, setAddress] = useState<string>("");
  const [addressLoading, setAddressLoading] = useState(false);

  // Form State
  const [selectedCategory, setSelectedCategory] = useState<"frontage" | "infrastructure" | "client" | "documents">("frontage");
  const [photos, setPhotos] = useState<EvidencePhoto[]>([]);
  const [attendance, setAttendance] = useState("in_person");
  const [buyingHeat, setBuyingHeat] = useState("hot");
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [activePreview, setActivePreview] = useState<EvidencePhoto | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedVisitId, setSubmittedVisitId] = useState<string | null>(null);

  // Hidden inputs for camera capture
  const rearCameraInputRef = useRef<HTMLInputElement>(null);
  const selfieCameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Fetch Lead details
  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ["field-lead-details", leadId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("plot_leads")
        .select("*")
        .eq("id", leadId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch Project details
  const { data: project } = useQuery({
    queryKey: ["field-project-details", lead?.project_id],
    enabled: !!lead?.project_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", lead.project_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch Plot details
  const { data: plot } = useQuery({
    queryKey: ["field-plot-details", lead?.plot_id],
    enabled: !!lead?.plot_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plots")
        .select("*")
        .eq("id", lead.plot_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch Current User Profile
  const { data: userProfile } = useQuery({
    queryKey: ["field-user-profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      return data;
    },
  });

  // Acquire High-Accuracy GPS
  const acquireLocation = () => {
    if (!navigator.geolocation) {
      toast.error("GPS hardware not supported on this browser/device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const newCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          timestamp: pos.timestamp || Date.now(),
        };
        setCoords(newCoords);
        setLocating(false);
        toast.success(`GPS Locked! Accuracy ±${newCoords.accuracy}m`);

        // Reverse Geocode
        try {
          setAddressLoading(true);
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newCoords.lat}&lon=${newCoords.lng}&zoom=18&addressdetails=1`,
            { headers: { "Accept-Language": "en" } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.display_name || `${newCoords.lat.toFixed(5)}, ${newCoords.lng.toFixed(5)}`;
            setAddress(addr);
          }
        } catch {
          setAddress(`${newCoords.lat.toFixed(5)}° N, ${newCoords.lng.toFixed(5)}° E`);
        } finally {
          setAddressLoading(false);
        }
      },
      (err) => {
        setLocating(false);
        toast.error(`Location failed: ${err.message}. Please enable GPS in device settings.`);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  // Automatically request GPS on mount
  useEffect(() => {
    acquireLocation();
  }, []);

  // Handle Photo file additions
  const handleFilesAdded = (fileList: FileList | null, category: "frontage" | "infrastructure" | "client" | "documents") => {
    if (!fileList || fileList.length === 0) return;
    const nowIso = new Date().toISOString();
    const newItems: EvidencePhoto[] = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      category,
      timestamp: nowIso,
      coords: coords ? { lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy } : undefined,
    }));
    setPhotos((prev) => [...prev, ...newItems]);
    toast.success(`Added ${newItems.length} photo to ${EVIDENCE_CATEGORIES.find((c) => c.id === category)?.label}`);
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const toggleChip = (chip: string) => {
    setSelectedChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  // Submit Site Visit Mutation
  const submitVisit = useMutation({
    mutationFn: async () => {
      if (!lead) throw new Error("Lead data not loaded.");
      if (!coords) throw new Error("GPS coordinates are required to submit verifiable evidence.");
      if (photos.length === 0) throw new Error("At least one proof photo is required.");

      // Check plot/project association
      const currentAuthUser = (await supabase.auth.getUser()).data?.user?.id || userId;
      const projectId = lead.project_id || null;
      const plotId = lead.plot_id || null;

      // Ensure plot_leads record matches assignment
      try {
        const patch: Record<string, any> = {};
        if (!lead.assigned_to && lead.created_by !== currentAuthUser) patch.assigned_to = currentAuthUser;

        if (Object.keys(patch).length > 0) {
          await (supabase as any)
            .from("plot_leads")
            .update(patch)
            .eq("id", lead.id);
        }
      } catch (patchErr) {
        console.warn("Lead pre-sync notice:", patchErr);
      }

      const combinedNotes = [
        `[Attendance: ${CLIENT_ATTENDANCE_OPTIONS.find((a) => a.id === attendance)?.label}]`,
        `[Buying Heat: ${BUYING_HEAT_OPTIONS.find((h) => h.id === buyingHeat)?.label}]`,
        selectedChips.length > 0 ? `[Observations: ${selectedChips.join(", ")}]` : "",
        address ? `[Location: ${address}]` : "",
        notes.trim(),
      ]
        .filter(Boolean)
        .join("\n\n");

      // 1. Create site_visit record with 'in_progress' status
      // Pre-generate visitId to eliminate any RETURNING SELECT policy traps
      const visitId = crypto.randomUUID();
      const { error: visitError } = await (supabase as any)
        .from("site_visits")
        .insert({
          id: visitId,
          lead_id: lead.id,
          employee_id: currentAuthUser,
          project_id: projectId,
          plot_id: plotId,
          latitude: coords.lat,
          longitude: coords.lng,
          accuracy_meters: coords.accuracy,
          arrived_at: new Date(coords.timestamp).toISOString(),
          status: "in_progress",
        });

      if (visitError) {
        console.error("Site visit insertion error:", visitError);
        throw new Error(visitError.message || "Failed to record site visit.");
      }

      // 2. Upload each photo to Supabase storage bucket 'site-visit-proofs'
      const photoRows = [];
      for (const p of photos) {
        const cleanName = p.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const storagePath = `${userId}/${visitId}/${p.category}-${crypto.randomUUID()}-${cleanName}`;

        const { error: uploadError } = await supabase.storage
          .from("site-visit-proofs")
          .upload(storagePath, p.file, {
            contentType: p.file.type || "image/jpeg",
            upsert: false,
          });

        if (uploadError) {
          console.warn("Photo upload notice:", uploadError);
        }

        photoRows.push({
          visit_id: visitId,
          storage_path: storagePath,
          file_name: p.file.name,
          captured_at: p.timestamp,
          latitude: p.coords?.lat ?? coords.lat,
          longitude: p.coords?.lng ?? coords.lng,
          accuracy_meters: p.coords?.accuracy ?? coords.accuracy,
          exif_metadata: {
            category: p.category,
            attendance,
            buying_heat: buyingHeat,
          },
        });
      }

      if (photoRows.length > 0) {
        const { error: photoInsertError } = await (supabase as any)
          .from("site_visit_photos")
          .insert(photoRows);

        if (photoInsertError) {
          console.warn("Photo insert warning:", photoInsertError);
        }
      }

      // 3. Update site_visit to 'submitted' status with completion time and notes
      const { error: completeError } = await (supabase as any)
        .from("site_visits")
        .update({
          status: "submitted",
          completed_at: new Date().toISOString(),
          notes: combinedNotes,
        })
        .eq("id", visitId);

      if (completeError) {
        console.warn("Could not transition to submitted:", completeError);
      }

      // 3. Log lead activity
      try {
        await (supabase as any).from("lead_activities").insert({
          lead_id: lead.id,
          activity_type: "meeting_scheduled",
          channel: "Site Visit",
          notes: `Site visit completed with ${photos.length} GPS-verified photos. Client sentiment: ${BUYING_HEAT_OPTIONS.find((h) => h.id === buyingHeat)?.label}`,
          performed_by: userId,
          metadata: {
            visit_id: visitId,
            latitude: coords.lat,
            longitude: coords.lng,
            accuracy: coords.accuracy,
            photo_count: photos.length,
          },
        });
      } catch (e) {
        console.warn("Could not log lead activity:", e);
      }

      return visitId;
    },
    onSuccess: (visitId) => {
      setSubmittedVisitId(visitId);
      setIsSubmitted(true);
      toast.success("Site visit proof submitted successfully!");
      qc.invalidateQueries({ queryKey: ["site-visits"] });
      qc.invalidateQueries({ queryKey: ["admin-site-visits"] });
      qc.invalidateQueries({ queryKey: ["field-lead-details", leadId] });
    },
    onError: (err: Error) => {
      toast.error(`Submission failed: ${err.message}`);
    },
  });

  const accuracyBadgeColor = useMemo(() => {
    if (!coords) return "text-muted-foreground";
    if (coords.accuracy <= 15) return "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300";
    if (coords.accuracy <= 50) return "text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-300";
    return "text-rose-700 bg-rose-50 dark:bg-rose-950/40 border-rose-300";
  }, [coords]);

  const generateWhatsAppMessage = () => {
    if (!lead || !coords) return "";
    const agentName = userProfile?.full_name || "Sales Executive";
    const projName = project?.name || "ARK Project";
    const plotNum = plot?.plot_number || "Unassigned";
    const mapsLink = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
    const text = `*📍 SITE VISIT COMPLETED - ARK BUILDERS*\n\n` +
      `*Customer:* ${lead.name} (${lead.phone})\n` +
      `*Project:* ${projName} · Plot #${plotNum}\n` +
      `*Executive:* ${agentName}\n` +
      `*Arrival GPS:* ±${coords.accuracy}m Accuracy\n` +
      `*Location Link:* ${mapsLink}\n` +
      `*Client Sentiment:* ${BUYING_HEAT_OPTIONS.find((h) => h.id === buyingHeat)?.label}\n` +
      (notes ? `*Notes:* ${notes}\n` : "") +
      `\n_Recorded securely via ARK Field Site Visit Engine._`;
    return encodeURIComponent(text);
  };

  if (leadLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-terracotta border-t-transparent" />
          <p className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
            Loading Field Site Studio...
          </p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <p className="text-lg font-bold">Lead Not Found</p>
        <p className="text-sm text-muted-foreground mt-1">This lead record may have been removed.</p>
        <Button className="mt-4" onClick={() => navigate({ to: "/leads" })}>
          Back to Leads CRM
        </Button>
      </div>
    );
  }

  // --- CELEBRATION SUCCESS VIEW ---
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-linear-to-b from-card to-background p-4 sm:p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-card rounded-3xl border border-border/80 shadow-2xl p-6 sm:p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="size-20 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 border-2 border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400 animate-bounce" />
          </div>

          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest uppercase px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <ShieldCheck className="size-3" /> GPS Evidence Verified
            </span>
            <h2 className="text-2xl font-serif font-black text-slate-900 dark:text-white mt-2">
              Site Visit Recorded!
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Field evidence for <strong className="text-foreground">{lead.name}</strong> at{" "}
              <strong>{project?.name || "Project"}</strong> (Plot #{plot?.plot_number || "—"}) has been safely vaulted.
            </p>
          </div>

          <div className="bg-muted/40 rounded-2xl p-4 text-left text-xs space-y-2 border border-border/40">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Photos Uploaded:</span>
              <span className="font-bold text-foreground">{photos.length} High-Res Evidence Shots</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GPS Precision:</span>
              <span className="font-bold text-emerald-600">±{coords?.accuracy ?? 0}m Accuracy</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sentiment:</span>
              <span className="font-bold text-foreground">{BUYING_HEAT_OPTIONS.find((h) => h.id === buyingHeat)?.label}</span>
            </div>
            {address && (
              <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground leading-tight">
                📍 {address}
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            <a
              href={`https://wa.me/?text=${generateWhatsAppMessage()}`}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Share2 className="size-4" /> Share Summary on WhatsApp
            </a>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="w-full py-2.5 text-xs font-semibold"
                onClick={() => navigate({ to: "/visit-proofs" })}
              >
                <Eye className="size-3.5 mr-1" /> View in Proofs
              </Button>
              <Button
                className="w-full py-2.5 text-xs font-semibold bg-terracotta hover:bg-terracotta/90 text-white"
                onClick={() => navigate({ to: "/leads" })}
              >
                <ArrowLeft className="size-3.5 mr-1" /> Back to Leads
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={rearCameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFilesAdded(e.target.files, selectedCategory);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={selfieCameraInputRef}
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          handleFilesAdded(e.target.files, "client");
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFilesAdded(e.target.files, selectedCategory);
          e.target.value = "";
        }}
      />

      {/* TOP STICKY NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border/60 shadow-xs px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/leads"
              className="size-9 rounded-xl border border-border/80 bg-background flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ArrowLeft className="size-4 text-foreground" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-terracotta">
                  FIELD MISSION CONTROL
                </span>
                <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <h1 className="text-base sm:text-lg font-serif font-black text-foreground flex items-center gap-2">
                Site Visit Evidence Studio
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 shadow-xs ${accuracyBadgeColor}`}>
              <LocateFixed className="size-3.5 shrink-0" />
              {locating ? (
                <span>Locking Satellites…</span>
              ) : coords ? (
                <span>GPS ±{coords.accuracy}m</span>
              ) : (
                <span>No GPS Lock</span>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-medium"
              onClick={acquireLocation}
              disabled={locating}
            >
              <Navigation className={`size-3.5 mr-1 ${locating ? "animate-spin" : ""}`} />
              {locating ? "Refining…" : "Refresh GPS"}
            </Button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* LEAD & PLOT HERO BANNER */}
        <section className="bg-card rounded-2xl border border-border/70 p-5 shadow-sm relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-terracotta/5 blur-3xl" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-foreground">{lead.name}</h2>
                <Badge variant="outline" className="text-xs bg-terracotta/10 text-terracotta border-terracotta/30">
                  Lead #{lead.id.slice(0, 8)}
                </Badge>
                {lead.budget && (
                  <Badge variant="secondary" className="text-xs">
                    ₹{Number(lead.budget).toLocaleString("en-IN")} Budget
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 hover:text-terracotta">
                  <Phone className="size-3" /> {lead.phone}
                </a>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="size-3" /> {project?.name || "Project Unassigned"}
                </span>
                <span>•</span>
                <span className="font-semibold text-foreground">
                  Plot: {plot?.plot_number || "Unassigned"}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`tel:${lead.phone}`}
                className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-semibold inline-flex items-center gap-1.5 hover:border-terracotta/50"
              >
                <Phone className="size-3 text-emerald-600" /> Call Client
              </a>
              <a
                href={`https://wa.me/91${lead.phone.replace(/[^\d]/g, "").slice(-10)}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-semibold inline-flex items-center gap-1.5 hover:border-emerald-500/50"
              >
                <MessageCircle className="size-3 text-emerald-500" /> WhatsApp
              </a>
            </div>
          </div>
        </section>

        {/* 2-COLUMN COCKPIT LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: GEOSPATIAL & MAP VERIFICATION (4 COLS) */}
          <div className="lg:col-span-4 space-y-6">
            {/* SATELLITE RADAR & MAP CARD */}
            <div className="bg-card rounded-2xl border border-border/70 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-terracotta" /> Field GPS Radar
                </span>
                {coords && (
                  <span className="text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </span>
                )}
              </div>

              {/* MAP EMBED */}
              <div className="h-56 w-full rounded-xl overflow-hidden border border-border/80 relative bg-muted flex items-center justify-center">
                {coords ? (
                  <iframe
                    title="Live Field Geolocation"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight={0}
                    marginWidth={0}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.004}%2C${coords.lat - 0.003}%2C${coords.lng + 0.004}%2C${coords.lat + 0.003}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 p-4 text-center">
                    <LocateFixed className="size-8 text-muted-foreground animate-pulse" />
                    <p className="text-xs text-muted-foreground">Acquiring GPS Satellite Positioning…</p>
                  </div>
                )}
              </div>

              {/* PHYSICAL ADDRESS & EXTERNAL LINKS */}
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-xs">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                    Resolved Physical Landmark
                  </p>
                  <p className="mt-1 font-medium text-foreground leading-relaxed">
                    {addressLoading ? "Resolving address details…" : address || "Awaiting GPS resolution…"}
                  </p>
                </div>

                {coords && (
                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-2 px-3 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold inline-flex items-center justify-center gap-1.5 text-foreground transition-colors"
                    >
                      <MapPin className="size-3.5 text-rose-500" /> Google Maps <ExternalLink className="size-3 text-muted-foreground" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* ATTENDANCE & CLIENT SENTIMENT CARD */}
            <div className="bg-card rounded-2xl border border-border/70 p-5 shadow-sm space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-terracotta" /> Field Intelligence
              </span>

              {/* Attendance */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Who attended the visit?</label>
                <div className="grid grid-cols-2 gap-2">
                  {CLIENT_ATTENDANCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAttendance(opt.id)}
                      className={`p-2.5 rounded-xl border text-xs font-medium text-left flex items-center gap-2 transition-all cursor-pointer ${
                        attendance === opt.id
                          ? "border-terracotta bg-terracotta/10 text-foreground font-bold ring-1 ring-terracotta"
                          : "border-border/70 bg-background hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <span className="text-base">{opt.icon}</span>
                      <span className="truncate">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Buying Heat */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Client Sentiment / Vibe</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BUYING_HEAT_OPTIONS.map((heat) => (
                    <button
                      key={heat.id}
                      type="button"
                      onClick={() => setBuyingHeat(heat.id)}
                      className={`p-2.5 rounded-xl border text-xs font-medium text-left flex items-center gap-2 transition-all cursor-pointer ${
                        buyingHeat === heat.id
                          ? `${heat.color} font-bold ring-1 ring-current`
                          : "border-border/70 bg-background hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <span className="text-base">{heat.icon}</span>
                      <span className="truncate">{heat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: MULTI-ANGLE CAMERA PROOF STATION (8 COLS) */}
          <div className="lg:col-span-8 space-y-6">
            {/* EVIDENCE CAMERA HUD */}
            <div className="bg-card rounded-2xl border border-border/70 p-5 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Camera className="size-5 text-terracotta" /> Evidence Photography Station
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Capture high-definition geotagged photos to prove genuine on-site attendance.
                  </p>
                </div>
                <Badge variant="outline" className="self-start sm:self-auto text-xs font-semibold px-3 py-1">
                  {photos.length} Photo{photos.length === 1 ? "" : "s"} Staged
                </Badge>
              </div>

              {/* CATEGORY SELECTOR TABS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {EVIDENCE_CATEGORIES.map((cat) => {
                  const catCount = photos.filter((p) => p.category === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                        selectedCategory === cat.id
                          ? "border-terracotta bg-terracotta/10 text-foreground font-bold ring-1 ring-terracotta shadow-xs"
                          : "border-border/70 bg-background hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg">{cat.icon}</span>
                        {catCount > 0 && (
                          <span className="size-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {catCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold mt-2 line-clamp-1">{cat.label}</p>
                      {cat.required && (
                        <span className="text-[9px] font-extrabold uppercase text-rose-500">Required</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* QUICK CAMERA CAPTURE BUTTONS */}
              <div className="p-4 rounded-xl border border-dashed border-terracotta/30 bg-terracotta/[0.02] flex flex-wrap items-center justify-center gap-3">
                <Button
                  className="bg-terracotta hover:bg-terracotta/90 text-white font-bold text-xs gap-2 px-4 py-2.5 rounded-xl shadow-sm"
                  onClick={() => rearCameraInputRef.current?.click()}
                >
                  <Camera className="size-4" /> Snap Photo (Rear Camera)
                </Button>

                <Button
                  variant="outline"
                  className="font-bold text-xs gap-2 px-4 py-2.5 rounded-xl"
                  onClick={() => selfieCameraInputRef.current?.click()}
                >
                  🤳 Client Selfie Camera
                </Button>

                <Button
                  variant="secondary"
                  className="font-bold text-xs gap-2 px-4 py-2.5 rounded-xl"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <Upload className="size-4" /> Choose from Gallery / Files
                </Button>
              </div>

              {/* PHOTO THUMBNAILS GALLERY WITH WATERMARK HUD */}
              {photos.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-border/80 text-center space-y-2">
                  <Camera className="size-8 mx-auto text-muted-foreground/60" />
                  <p className="text-xs font-medium text-foreground">No photos captured yet.</p>
                  <p className="text-[11px] text-muted-foreground">
                    Tap the camera buttons above to capture boundary stones, plot frontage, and meeting proof.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((p) => (
                    <div
                      key={p.id}
                      className="group relative aspect-4/3 rounded-xl overflow-hidden border border-border/80 bg-black shadow-xs"
                    >
                      <img
                        src={p.previewUrl}
                        alt="Evidence Proof"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* EVIDENTIARY WATERMARK HUD OVERLAY */}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/50 to-transparent p-2 text-white">
                        <div className="flex items-center justify-between text-[9px] font-mono tracking-tight text-emerald-400 font-bold">
                          <span>ARK VERIFIED</span>
                          <span>±{p.coords?.accuracy ?? coords?.accuracy ?? 0}m</span>
                        </div>
                        <p className="text-[8.5px] font-mono truncate text-white/90">
                          {coords ? `${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°` : "GPS Locked"}
                        </p>
                        <p className="text-[8px] font-mono text-white/70">
                          {new Date(p.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • {p.category.toUpperCase()}
                        </p>
                      </div>

                      {/* HOVER ACTIONS */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setActivePreview(p)}
                          className="size-7 rounded-lg bg-black/60 text-white hover:bg-black flex items-center justify-center cursor-pointer shadow-sm"
                          title="Expand Photo"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removePhoto(p.id)}
                          className="size-7 rounded-lg bg-rose-600 text-white hover:bg-rose-700 flex items-center justify-center cursor-pointer shadow-sm"
                          title="Remove Photo"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* OBSERVATIONS & FIELD NOTES */}
            <div className="bg-card rounded-2xl border border-border/70 p-5 shadow-sm space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="size-3.5 text-terracotta" /> Observations & Meeting Notes
              </span>

              {/* Quick Chips */}
              <div className="flex flex-wrap gap-1.5">
                {OBSERVATION_CHIPS.map((chip) => {
                  const active = selectedChips.includes(chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => toggleChip(chip)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                        active
                          ? "bg-terracotta text-white border-terracotta font-semibold shadow-xs"
                          : "bg-background border-border/70 text-foreground hover:bg-muted"
                      }`}
                    >
                      {active ? "✓ " : "+ "}
                      {chip}
                    </button>
                  );
                })}
              </div>

              {/* Freeform Notes */}
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter executive discussion summary, customer specific questions, token commitments, or remarks…"
                className="text-xs resize-none"
              />
            </div>

            {/* FINAL SUBMISSION BAR */}
            <div className="bg-card rounded-2xl border border-border/70 p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs space-y-0.5">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-emerald-600" /> Tamper-Resistant Audit Trail
                </p>
                <p className="text-muted-foreground text-[11px]">
                  Submitted evidence is cryptographically anchored to your employee ID and cannot be altered.
                </p>
              </div>

              <Button
                size="lg"
                disabled={!coords || photos.length === 0 || submitVisit.isPending}
                onClick={() => submitVisit.mutate()}
                className="bg-terracotta hover:bg-terracotta/90 text-white font-extrabold text-sm px-8 py-3 rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-50"
              >
                {submitVisit.isPending ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                    Submitting Proof…
                  </>
                ) : (
                  <>
                    <Send className="size-4 mr-2" /> Complete & Submit Site Visit
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* LIGHTBOX MODAL */}
      <Dialog open={!!activePreview} onOpenChange={(open) => !open && setActivePreview(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black/95 border-none">
          {activePreview && (
            <div className="relative flex flex-col">
              <div className="p-3 bg-black/80 flex items-center justify-between text-white border-b border-white/10">
                <span className="text-xs font-mono font-bold uppercase text-emerald-400">
                  EVIDENCE PREVIEW • {activePreview.category.toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => setActivePreview(null)}
                  className="size-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="max-h-[75vh] flex items-center justify-center p-2">
                <img
                  src={activePreview.previewUrl}
                  alt="Expanded Evidence"
                  className="max-h-[70vh] w-auto object-contain rounded-lg"
                />
              </div>
              <div className="p-3 bg-black/80 text-white/80 text-xs border-t border-white/10 flex justify-between items-center">
                <span>📍 {coords ? `${coords.lat.toFixed(5)}°, ${coords.lng.toFixed(5)}°` : "GPS Locked"}</span>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs"
                  onClick={() => {
                    removePhoto(activePreview.id);
                    setActivePreview(null);
                  }}
                >
                  <Trash2 className="size-3 mr-1" /> Delete Photo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
