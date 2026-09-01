import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, MapPinOff, Layers, Check, Loader2, Building2, Ruler, Compass, Square, LandPlot, IndianRupee, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STATUS_LABEL,
  STATUS_PALETTE,
  FACING_LABEL,
  pointsAttr,
  polygonCentroid,
  resolveProjectLayoutUrl,
  type PlotRow,
  type PlotStatus,
  type Point,
  type LeadRow,
} from "@/components/site-mapper/types";
import { toast } from "sonner";

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

export function MapLeadToPlotDialog({
  open,
  lead,
  pending,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  lead: LeadRow | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (plotId: string, projectId: string) => void;
}) {
  const [projectId, setProjectId] = useState("");
  const [plotId, setPlotId] = useState("");
  const [hoveredPlotId, setHoveredPlotId] = useState<string | null>(null);

  // Reset when dialog opens/closes or lead changes
  useEffect(() => {
    if (open && lead) {
      setProjectId(lead.project_id ?? "");
      setPlotId(lead.plot_id ?? "");
    } else {
      setProjectId("");
      setPlotId("");
      setHoveredPlotId(null);
    }
  }, [open, lead]);

  // 1. Fetch available projects
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["map-lead-projects"],
    enabled: open,
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

  // 2. Fetch layout image signed URL (with fallbacks for HTTP URLs, public storage, & legacy buckets)
  const { data: layoutUrl, isLoading: layoutUrlLoading } = useQuery({
    queryKey: ["map-lead-layout-url", layoutPath],
    enabled: !!layoutPath,
    queryFn: () => resolveProjectLayoutUrl(layoutPath),
  });

  // 3. Fetch plots for selected project
  const { data: plots = [], isLoading: plotsLoading } = useQuery({
    queryKey: ["map-lead-plots", projectId],
    enabled: open && !!projectId,
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
  const hoveredPlot = plots.find((p) => p.id === hoveredPlotId);
  const activePlot = selectedPlot || hoveredPlot;

  // Only available plots can be selected for mapping
  const availablePlots = plots.filter((p) => p.status === "available");

  // Show all plots on map for visual context, but only available are selectable
  const mappedPlots = plots.filter(
    (p) => p.polygon_coordinates && p.polygon_coordinates.length >= 3,
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !plotId) {
      toast.error("Please select a project and plot");
      return;
    }
    onSubmit(plotId, projectId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-display text-2xl">
            <MapPin className="h-5 w-5 text-terracotta" />
            Map lead to plot
          </DialogTitle>
          <DialogDescription>
            {lead && (
              <span>
                Mapping <strong>{lead.name}</strong> ({lead.phone}) to a project and plot.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-2">
          {/* LEAD INFO CARD */}
          {lead && (
            <div className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{lead.name}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{lead.phone}</span>
              </div>
              {lead.budget && (
                <div className="text-xs text-muted-foreground">
                  Budget: ₹{Number(lead.budget).toLocaleString()}
                </div>
              )}
              {lead.notes && (
                <div className="text-xs text-muted-foreground italic">
                  "{lead.notes}"
                </div>
              )}
            </div>
          )}

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
                <SelectValue placeholder={projectsLoading ? "Loading projects…" : "Choose a project"} />
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
                    Step 2: Select Plot <span className="text-terracotta">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select an available plot from the map or grid below.
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
                      <pattern id="diagonal-hatch" patternUnits="userSpaceOnUse" width="4" height="4">
                        <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground/30" />
                      </pattern>
                    </defs>

                    {/* Background Layout Image */}
                    <image href={layoutUrl} xlinkHref={layoutUrl} x={0} y={0} width={100} height={100} preserveAspectRatio="none" />

                    {/* Interactive Plot Polygons - All visible, only available clickable */}
                    {mappedPlots.map((p) => {
                      const isSelected = p.id === plotId;
                      const isHovered = p.id === hoveredPlotId;
                      const palette = STATUS_PALETTE[p.status as PlotStatus];
                      const isAvailable = p.status === "available";

                      return (
                        <g
                          key={p.id}
                          className={isAvailable ? "cursor-pointer" : "cursor-not-allowed"}
                          onClick={() => isAvailable && setPlotId(p.id)}
                          onMouseEnter={() => isAvailable && setHoveredPlotId(p.id)}
                          onMouseLeave={() => setHoveredPlotId(null)}
                        >
                          <polygon
                            points={pointsAttr(p.polygon_coordinates as Point[])}
                            style={{
                              fill: isSelected ? "color-mix(in oklch, var(--terracotta) 45%, transparent)" : palette.fill,
                              stroke: isSelected ? "#ea580c" : isHovered && isAvailable ? "#3b82f6" : palette.stroke,
                            }}
                            strokeWidth={isSelected ? 1.5 : isHovered && isAvailable ? 1.2 : 0.45}
                            opacity={isSelected ? 0.95 : isHovered && isAvailable ? 0.9 : isAvailable ? 0.65 : 0.4}
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

                          {/* Striped overlay pattern for non-available plots */}
                          {!isAvailable && (
                            <polygon
                              points={pointsAttr(p.polygon_coordinates as Point[])}
                              fill="url(#diagonal-hatch)"
                              opacity="0.3"
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
                    const isAvailable = p.status === "available";
                    if (!isSelected && !isHovered) return null;
                    const centroid = polygonCentroid(p.polygon_coordinates as Point[]);
                    return (
                      <div
                        key={`pin-${p.id}`}
                        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
                        style={{ left: `${centroid.x}%`, top: `${centroid.y}%` }}
                      >
                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold shadow-md whitespace-nowrap flex items-center gap-1 ${isSelected ? "bg-terracotta text-white" : "bg-black/80 text-white backdrop-blur-sm"}`}>
                          <span>Plot {p.plot_number}</span>
                          {!isAvailable && <span className="text-[8px]">🔒</span>}
                        </div>
                        <div className={`w-2 h-2 rounded-full mt-0.5 ${isSelected ? "bg-terracotta animate-ping" : isAvailable ? "bg-blue-500" : "bg-gray-500"}`} />
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
              {availablePlots.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Available Plots ({availablePlots.length})
                    </span>
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                      Only available plots can be mapped
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-muted/30 rounded-xl border">
                    {availablePlots.map((p) => {
                      const isSelected = p.id === plotId;
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
                          <span className="w-2 h-2 rounded-full bg-plot-available" />
                          Plot {p.plot_number}
                          {p.price > 0 && <span className="opacity-75 text-[10px]">₹{(p.price / 100000).toFixed(1)}L</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {availablePlots.length === 0 && plots.length > 0 && (
                <div className="mt-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    No available plots in this project. All plots are either booked, sold, or reserved.
                  </p>
                </div>
              )}

              {/* PLOT DETAILS PANEL */}
              {activePlot && (
                <div className="mt-3 p-4 rounded-xl bg-gradient-to-br from-terracotta/5 to-amber-500/5 border border-terracotta/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="h-4 w-4 text-terracotta" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-terracotta">
                      {selectedPlot ? "Selected Plot Details" : "Plot Preview"} — Plot {activePlot.plot_number}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Price */}
                    <div className="flex items-start gap-2">
                      <IndianRupee className="h-4 w-4 text-terracotta mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Price</div>
                        <div className="text-sm font-semibold">
                          {activePlot.price > 0
                            ? `₹${(activePlot.price / 100000).toFixed(1)} Lakhs`
                            : "Price on request"}
                        </div>
                      </div>
                    </div>

                    {/* Area */}
                    <div className="flex items-start gap-2">
                      <Square className="h-4 w-4 text-terracotta mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Area</div>
                        <div className="text-sm font-semibold">{activePlot.area_sqft} sq.ft</div>
                      </div>
                    </div>

                    {/* Facing */}
                    <div className="flex items-start gap-2">
                      <Compass className="h-4 w-4 text-terracotta mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Facing</div>
                        <div className="text-sm font-semibold">
                          {activePlot.facing ? FACING_LABEL[activePlot.facing] : "—"}
                        </div>
                      </div>
                    </div>

                    {/* Dimensions */}
                    {activePlot.dimensions && (
                      <div className="flex items-start gap-2">
                        <Ruler className="h-4 w-4 text-terracotta mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase">Dimensions</div>
                          <div className="text-sm font-semibold">{activePlot.dimensions}</div>
                        </div>
                      </div>
                    )}

                    {/* Area in Sq.Meters */}
                    {activePlot.area_sqft && (
                      <div className="flex items-start gap-2">
                        <LandPlot className="h-4 w-4 text-terracotta mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase">Area in Sq.Meters</div>
                          <div className="text-sm font-semibold text-terracotta">{(Number(activePlot.area_sqft) * 0.092903).toFixed(2)} sq.m</div>
                        </div>
                      </div>
                    )}

                    {/* Status */}
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-terracotta mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Status</div>
                        <div className={`text-sm font-semibold ${activePlot.status === "available" ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {STATUS_LABEL[activePlot.status as PlotStatus]}
                        </div>
                      </div>
                    </div>

                    {/* Rate per sqft */}
                    {activePlot.rate_per_sqft && (
                      <div className="flex items-start gap-2">
                        <IndianRupee className="h-4 w-4 text-terracotta mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase">Rate / sq.ft</div>
                          <div className="text-sm font-semibold">₹{activePlot.rate_per_sqft}/sq.ft</div>
                        </div>
                      </div>
                    )}

                    {/* Corner Plot Badge */}
                    {activePlot.corner_plot && (
                      <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                          ⭐ Corner Plot — Premium Location
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Budget Match Indicator */}
                  {lead?.budget && activePlot.price > 0 && (
                    <div className="mt-3 pt-3 border-t border-terracotta/20">
                      {Number(lead.budget) >= activePlot.price ? (
                        <div className="flex items-center gap-2 text-xs text-emerald-600">
                          <Check className="h-3.5 w-3.5" />
                          <span>Within customer budget (₹{(Number(lead.budget) / 100000).toFixed(1)}L)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-amber-600">
                          <Info className="h-3.5 w-3.5" />
                          <span>Exceeds budget by ₹{((activePlot.price - Number(lead.budget)) / 100000).toFixed(1)}L</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Remarks */}
                  {activePlot.remarks && (
                    <div className="mt-3 p-2 rounded bg-background/50 text-xs text-muted-foreground italic">
                      "{activePlot.remarks}"
                    </div>
                  )}

                  {/* Click to select hint */}
                  {!selectedPlot && hoveredPlot && (
                    <div className="mt-2 text-[10px] text-muted-foreground text-center">
                      Click anywhere to select this plot
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SUBMIT BUTTON */}
          {projectId && plotId && (
            <div className="rounded-xl border bg-card p-4">
              <Button
                type="submit"
                disabled={pending || !projectId || !plotId}
                className="w-full h-11 bg-terracotta text-white font-medium hover:bg-terracotta/90 transition-all text-base cursor-pointer shadow-md"
              >
                {pending ? "Mapping Lead…" : `Map ${lead?.name} to Plot ${selectedPlot?.plot_number}`}
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
