import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, MapPin, MapPinOff, Layers, Check, Loader2, Sparkles, Users, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  sanitizePhoneInput,
  getPhoneValidationError,
  isValidEmail,
  sanitizePositiveNumber,
} from "@/lib/formValidation";
import { PhoneInput } from "@/components/ui/phone-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEAD_SOURCES,
  STATUS_LABEL,
  STATUS_PALETTE,
  pointsAttr,
  polygonCentroid,
  resolveProjectLayoutUrl,
  type PlotRow,
  type PlotStatus,
  type Point,
} from "@/components/site-mapper/types";

export interface NewLeadValues {
  plot_id: string | null;
  project_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  source: string | null;
  budget: number | null;
  notes: string | null;
}

type LeadMode = "general" | "plot";

function useImageAspect(url: string | null | undefined) {
  const [aspect, setAspect] = useState<number | null>(null);
  useEffect(() => {
    if (!url) {
      setAspect(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setAspect(img.naturalWidth / img.naturalHeight);
    };
    img.onerror = () => {
      if (!cancelled) setAspect(16 / 9);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);
  return aspect;
}

export function NewLeadDialog({
  open,
  pending,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: NewLeadValues) => void;
}) {
  const [leadMode, setLeadMode] = useState<LeadMode>("general");
  const [projectId, setProjectId] = useState("");
  const [plotId, setPlotId] = useState("");
  const [hoveredPlotId, setHoveredPlotId] = useState<string | null>(null);
  const [plotFilter, setPlotFilter] = useState<"all" | "available" | "other">("all");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("Walk-in");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setLeadMode("general");
      setProjectId("");
      setPlotId("");
      setHoveredPlotId(null);
      setPlotFilter("all");
      setName("");
      setPhone("");
      setEmail("");
      setSource("Walk-in");
      setBudget("");
      setNotes("");
    }
  }, [open]);

  // 1. Fetch available projects
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["leads-new-projects"],
    enabled: open && leadMode === "plot",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, code, layout_image_url")
        .eq("status", "live")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedProject = (projects ?? []).find((p) => p.id === projectId);
  const layoutPath = selectedProject?.layout_image_url ?? null;

  // 2. Fetch layout image signed URL (with fallback for old cloned project paths)
  const { data: layoutUrl, isLoading: layoutUrlLoading } = useQuery({
    queryKey: ["leads-layout-url", layoutPath],
    enabled: !!layoutPath,
    queryFn: () => resolveProjectLayoutUrl(layoutPath),
  });

  // 3. Fetch plots for selected project
  const { data: plots = [], isLoading: plotsLoading } = useQuery({
    queryKey: ["leads-new-plots", projectId],
    enabled: open && leadMode === "plot" && !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plots")
        .select("*")
        .eq("project_id", projectId)
        .order("plot_number");
      if (error) throw error;
      return (data ?? []) as unknown as PlotRow[];
    },
  });

  const aspect = useImageAspect(layoutUrl);
  const selectedPlot = plots.find((p) => p.id === plotId);

  const mappedPlots = plots.filter(
    (p) => p.polygon_coordinates && p.polygon_coordinates.length >= 3,
  );

  const filteredPlots = plots.filter((p) => {
    if (plotFilter === "available") return p.status === "available";
    if (plotFilter === "other") return p.status !== "available";
    return true;
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    const cleanPhone = sanitizePhoneInput(phone);
    const phoneErr = getPhoneValidationError(cleanPhone);
    if (phoneErr) {
      toast.error(`Invalid Phone: ${phoneErr}`);
      return;
    }

    if (email.trim() && !isValidEmail(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (leadMode === "plot" && (!projectId || !plotId)) return;

    onSubmit({
      plot_id: leadMode === "plot" ? plotId : null,
      project_id: leadMode === "plot" ? projectId : null,
      name: name.trim(),
      phone: cleanPhone,
      email: email.trim() || null,
      source: source || null,
      budget: budget ? sanitizePositiveNumber(budget) : null,
      notes: notes.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-display text-2xl">
            <UserPlus className="h-5 w-5 text-terracotta" />
            Add a new lead
          </DialogTitle>
          <DialogDescription>
            Choose how you want to add this lead - as a general inquiry or mapped to a specific plot.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-2">
          {/* LEAD MODE SELECTION */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-terracotta" />
              Lead Type <span className="text-terracotta">*</span>
            </Label>
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setLeadMode("general");
                  setProjectId("");
                  setPlotId("");
                }}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  leadMode === "general"
                    ? "border-terracotta bg-terracotta/5 shadow-md"
                    : "border-border bg-background hover:border-terracotta/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${leadMode === "general" ? "bg-terracotta text-white" : "bg-muted text-muted-foreground"}`}>
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <div className={`font-semibold ${leadMode === "general" ? "text-terracotta" : "text-foreground"}`}>General Lead</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Add customer details first, map to plot later
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setLeadMode("plot")}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  leadMode === "plot"
                    ? "border-terracotta bg-terracotta/5 shadow-md"
                    : "border-border bg-background hover:border-terracotta/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${leadMode === "plot" ? "bg-terracotta text-white" : "bg-muted text-muted-foreground"}`}>
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <div className={`font-semibold ${leadMode === "plot" ? "text-terracotta" : "text-foreground"}`}>Plot Lead</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Assign directly to a specific plot now
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* PLOT MODE: PROJECT & PLOT SELECTION */}
          {leadMode === "plot" && (
            <>
              {/* STEP 1: PROJECT SELECTION */}
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-terracotta" />
                    Step 1: Select Project <span className="text-terracotta">*</span>
                  </Label>
                  {projectId && (
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Project Selected
                    </span>
                  )}
                </div>

                <Select
                  value={projectId}
                  onValueChange={(v) => {
                    setProjectId(v);
                    setPlotId("");
                    setHoveredPlotId(null);
                  }}
                >
                  <SelectTrigger className="w-full h-11 bg-background text-sm font-medium rounded-xl border-border/80 shadow-sm hover:border-border transition-all">
                    <SelectValue placeholder={projectsLoading ? "Loading projects…" : "Choose a project to view layout map"} />
                  </SelectTrigger>
                  <SelectContent className="p-1.5 rounded-xl border-border/80 shadow-xl bg-popover">
                    {(projects ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id} className="py-2.5 px-3 rounded-lg">
                        <div className="flex items-center justify-between w-full gap-3">
                          <span className="font-semibold text-sm">{p.name}</span>
                          {p.code && (
                            <span className="px-2 py-0.5 text-[11px] font-mono rounded-md bg-muted text-muted-foreground">
                              {p.code}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* STEP 2: INTERACTIVE LAYOUT MAP & PLOT SELECTION */}
              {projectId && (
                <div className="rounded-xl border bg-card p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-terracotta" />
                        Step 2: Select Plot on Layout Map <span className="text-terracotta">*</span>
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Click any plot on the layout map or grid below to select it for this lead.
                      </p>
                    </div>

                    {selectedPlot && (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-terracotta/10 border border-terracotta/30 text-xs font-semibold text-terracotta">
                        <Check className="h-3.5 w-3.5" /> Selected: Plot {selectedPlot.plot_number} ({STATUS_LABEL[selectedPlot.status as PlotStatus]})
                      </div>
                    )}
                  </div>

                  {/* MAP DISPLAY AREA */}
                  {plotsLoading || layoutUrlLoading ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-16 rounded-xl border border-dashed bg-muted/20 text-xs text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin text-terracotta" />
                      Loading interactive layout map…
                    </div>
                  ) : layoutUrl && mappedPlots.length > 0 ? (
                    <div
                      className="relative w-full overflow-hidden rounded-xl border border-border/80 bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklch,var(--foreground)_10%,transparent)_1px,transparent_0)] [background-size:16px_16px] shadow-inner select-none"
                      style={{ aspectRatio: aspect ?? 16 / 9 }}
                    >
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="absolute inset-0 h-full w-full"
                      >
                        <defs>
                          <filter id="plot-glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="1.5" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>

                        {/* Background Layout Image */}
                        <image href={layoutUrl} xlinkHref={layoutUrl} x={0} y={0} width={100} height={100} preserveAspectRatio="none" />

                        {/* Interactive Plot Polygons */}
                        {mappedPlots.map((p) => {
                          const isSelected = p.id === plotId;
                          const isHovered = p.id === hoveredPlotId;
                          const palette = STATUS_PALETTE[p.status as PlotStatus];

                          return (
                            <g key={p.id} className="cursor-pointer" onClick={() => setPlotId(p.id)} onMouseEnter={() => setHoveredPlotId(p.id)} onMouseLeave={() => setHoveredPlotId(null)}>
                              <polygon
                                points={pointsAttr(p.polygon_coordinates as Point[])}
                                style={{
                                  fill: isSelected ? "color-mix(in oklch, var(--terracotta) 45%, transparent)" : palette.fill,
                                  stroke: isSelected ? "#ea580c" : isHovered ? "#3b82f6" : palette.stroke,
                                }}
                                strokeWidth={isSelected ? 1.5 : isHovered ? 1.2 : 0.45}
                                opacity={isSelected ? 0.95 : isHovered ? 0.9 : 0.65}
                                vectorEffect="non-scaling-stroke"
                                filter={isSelected ? "url(#plot-glow)" : undefined}
                              />

                              {isSelected && (
                                <polygon
                                  points={pointsAttr(p.polygon_coordinates as Point[])}
                                  fill="none"
                                  stroke="#ea580c"
                                  strokeWidth={2.5}
                                  vectorEffect="non-scaling-stroke"
                                  className="animate-pulse"
                                />
                              )}
                            </g>
                          );
                        })}
                      </svg>

                      {/* Centroid Pin for Selected or Hovered Plot */}
                      {mappedPlots.map((p) => {
                        const isSelected = p.id === plotId;
                        const isHovered = p.id === hoveredPlotId;
                        if (!isSelected && !isHovered) return null;
                        const centroid = polygonCentroid(p.polygon_coordinates as Point[]);
                        return (
                          <div
                            key={`pin-${p.id}`}
                            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
                            style={{ left: `${centroid.x}%`, top: `${centroid.y}%` }}
                          >
                            <div className={`px-2 py-0.5 rounded text-[10px] font-bold shadow-md whitespace-nowrap ${isSelected ? "bg-terracotta text-white" : "bg-black/80 text-white backdrop-blur-sm"}`}>
                              Plot {p.plot_number} · {STATUS_LABEL[p.status as PlotStatus]}
                            </div>
                            <div className={`w-2 h-2 rounded-full mt-0.5 ${isSelected ? "bg-terracotta animate-ping" : "bg-blue-500"}`} />
                          </div>
                        );
                      })}
                    </div>
                  ) : layoutUrl ? (
                    <div className="relative overflow-hidden rounded-xl border bg-muted">
                      <img src={layoutUrl} alt="Layout" className="w-full opacity-60 max-h-60 object-cover" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-background/50 text-center backdrop-blur-[1px]">
                        <MapPinOff className="h-5 w-5 text-muted-foreground mb-1" />
                        <p className="text-xs font-medium text-foreground">Layout map uploaded, but plots haven't been polygon-traced yet.</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">You can select a plot from the interactive plot grid below.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed bg-muted/20 py-8 text-center">
                      <MapPinOff className="h-5 w-5 text-muted-foreground/60" />
                      <p className="text-xs text-muted-foreground">No layout map uploaded for this project yet.</p>
                    </div>
                  )}

                  {/* QUICK PLOT CHIPS SELECTION GRID */}
                  {plots.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Plots ({plots.length})
                        </span>
                        <div className="flex items-center gap-1.5 text-xs">
                          <button type="button" onClick={() => setPlotFilter("all")} className={`px-2 py-0.5 rounded text-[11px] ${plotFilter === "all" ? "bg-terracotta text-white font-medium" : "bg-muted text-muted-foreground"}`}>All</button>
                          <button type="button" onClick={() => setPlotFilter("available")} className={`px-2 py-0.5 rounded text-[11px] ${plotFilter === "available" ? "bg-terracotta text-white font-medium" : "bg-muted text-muted-foreground"}`}>Available</button>
                          <button type="button" onClick={() => setPlotFilter("other")} className={`px-2 py-0.5 rounded text-[11px] ${plotFilter === "other" ? "bg-terracotta text-white font-medium" : "bg-muted text-muted-foreground"}`}>Booked/Sold</button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-muted/30 rounded-xl border">
                        {filteredPlots.map((p) => {
                          const isSelected = p.id === plotId;
                          const palette = STATUS_PALETTE[p.status as PlotStatus];
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setPlotId(p.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-terracotta text-white border-terracotta shadow-md scale-105"
                                  : "bg-background hover:bg-accent border-border text-foreground"
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${palette.dot}`} />
                              Plot {p.plot_number}
                              {p.price > 0 && <span className="opacity-75 text-[10px]">₹{(p.price / 100000).toFixed(1)}L</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* STEP 3: LEAD DETAILS FORM */}
          {(leadMode === "general" || (leadMode === "plot" && projectId && plotId)) && (
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-terracotta" />
                {leadMode === "general" ? "Customer Details" : "Step 3: Buyer & Lead Details"} <span className="text-terracotta">*</span>
              </Label>

              {leadMode === "general" && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    <strong>General Lead:</strong> This lead will be added without a plot assignment. You can map it to any project and plot later from the leads dashboard.
                  </p>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-xs font-medium">Full Name <span className="text-terracotta">*</span></Label>
                  <Input
                    id="name"
                    className="mt-1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Kulkarni"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-xs font-medium">Phone Number <span className="text-terracotta">*</span></Label>
                  <div className="mt-1">
                    <PhoneInput
                      id="phone"
                      value={phone}
                      onChange={setPhone}
                      placeholder="98765 43210"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email" className="text-xs font-medium">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    className="mt-1"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ramesh@example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="source" className="text-xs font-medium">Lead Source</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="budget" className="text-xs font-medium">Estimated Budget (₹)</Label>
                  <div className="mt-1">
                    <CurrencyInput
                      id="budget"
                      value={budget}
                      onChange={setBudget}
                      placeholder="e.g. 50,00,000"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="notes" className="text-xs font-medium">Notes & Customer Requirements</Label>
                <Textarea
                  id="notes"
                  className="mt-1 min-h-[80px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Interested in East-facing corner plot, looking to register within 30 days."
                />
              </div>

              <Button
                type="submit"
                disabled={pending || !name.trim() || !phone.trim() || (leadMode === "plot" && (!projectId || !plotId))}
                className="w-full h-11 bg-terracotta text-white font-medium hover:bg-terracotta/90 transition-all text-base cursor-pointer shadow-md"
              >
                {pending ? "Adding Lead…" : `Submit & Add ${leadMode === "general" ? "General" : ""} Lead`}
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
