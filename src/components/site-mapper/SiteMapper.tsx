import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Compass,
  Upload,
  Plus,
  X,
  Trash2,
  Pencil,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  MapPin,
  Ruler,
  IndianRupee,
  Check,
  Undo2,
  MousePointerClick,
  Loader2,
  Bookmark,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FACING_LABEL,
  STATUS_LABEL,
  STATUS_PALETTE,
  pointsAttr,
  polygonCentroid,
  type PlotRow,
  type PlotStatus,
  type Point,
  type PurchaserRecord,
} from "./types";
import { PlotFormDialog, type PlotFormValues } from "./PlotFormDialog";
import { LeadsPanel } from "./LeadsPanel";
import { PurchaserDetailsCard } from "./PurchaserDetailsCard";

interface SiteMapperProps {
  projectId: string;
  isAdmin: boolean;
  userId: string;
  layoutPath: string | null | undefined;
  layoutUrl: string | null | undefined;
  uploading: boolean;
  onUploadLayout: (file: File) => void | Promise<void>;
}

const MIN_POINTS = 3;
const MIN_SCALE = 0.02;
const MAX_SCALE = 25;

/** Resolves the true pixel dimensions of the layout image. All boundary
 *  tracing happens in this pixel space (like a CAD canvas); points are
 *  converted to percentages only at the moment they're saved, so the
 *  stored shape stays correct at any render size. */
function loadImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to read layout image"));
    img.src = url;
  });
}

export function SiteMapper({
  projectId,
  isAdmin,
  userId,
  layoutPath,
  layoutUrl,
  uploading,
  onUploadLayout,
}: SiteMapperProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: plots } = useQuery({
    queryKey: ["plots", projectId],
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

  const { data: projectBookings, refetch: refetchProjectBookings } = useQuery({
    queryKey: ["project-bookings", projectId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bookings")
        .select("plot_id, customer_name, customer_phone, total_price, booking_date, status")
        .in("status", ["approved", "pending", "on_hold"])
        .order("created_at", { ascending: false });

      const map: Record<string, { customer_name: string; customer_phone: string }> = {};
      if (data) {
        for (const b of data) {
          if (b.plot_id && !map[b.plot_id]) {
            map[b.plot_id] = {
              customer_name: b.customer_name,
              customer_phone: b.customer_phone,
            };
          }
        }
      }
      return map;
    },
  });


  // ---------------------------------------------------------------------
  // Fullscreen + canvas geometry
  //
  // The layout image is fixed in place — it never drifts or drags. Zoom
  // is controlled only by the +/- buttons (or the scroll wheel), and when
  // the zoomed image is bigger than the viewport the container simply
  // scrolls natively, like any normal scrollable page element.
  // ---------------------------------------------------------------------
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    if (!layoutUrl) {
      setNatural(null);
      return;
    }
    let cancelled = false;
    setImgLoading(true);
    loadImageSize(layoutUrl)
      .then((size) => !cancelled && setNatural(size))
      .catch(() => !cancelled && toast.error("Couldn't read the layout image dimensions"))
      .finally(() => !cancelled && setImgLoading(false));
    return () => {
      cancelled = true;
    };
  }, [layoutUrl]);

  // Fit the whole image inside the viewport, no cropping, no scrolling.
  const fitToView = useCallback(() => {
    const el = containerRef.current;
    if (!el || !natural) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const s = Math.min(rect.width / natural.width, rect.height / natural.height) * 0.98;
    scaleRef.current = s;
    flushSync(() => {
      setScale(s);
    });
    requestAnimationFrame(() => {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    });
  }, [natural]);

  useEffect(() => {
    fitToView();
  }, [fitToView, isFullscreen]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === sectionRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!sectionRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      sectionRef.current.requestFullscreen().catch(() => {
        toast.error("Fullscreen isn't supported in this browser");
      });
    }
  };

  // ---------------------------------------------------------------------
  // Drawing state — all points live in image-pixel space while drawing,
  // and are converted to percentages only when persisted.
  // ---------------------------------------------------------------------
  const [drawing, setDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [attachTargetId, setAttachTargetId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingPlot, setEditingPlot] = useState<PlotRow | null>(null);
  const [pendingPolygon, setPendingPolygon] = useState<Point[] | null>(null);

  const selectedPlot = plots?.find((p) => p.id === selectedId) ?? null;

  const { data: selectedPlotPurchaser, refetch: refetchSelectedPurchaser } = useQuery({
    queryKey: ["plot-purchaser", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      if (!selectedId) return null;
      const { data: bData } = await (supabase as any)
        .from("bookings")
        .select("*, sales_executive:sales_executive_id(full_name, phone, email)")
        .eq("plot_id", selectedId)
        .in("status", ["approved", "pending", "on_hold"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (bData) {
        return {
          id: bData.id,
          plot_id: bData.plot_id,
          customer_name: bData.customer_name,
          customer_phone: bData.customer_phone,
          customer_email: bData.customer_email,
          customer_address: bData.customer_address,
          total_price: bData.total_price,
          booking_amount: bData.booking_amount,
          advance_paid: bData.advance_paid,
          booking_date: bData.booking_date,
          payment_method: bData.payment_method,
          status: bData.status,
          remarks: bData.remarks,
          sales_executive: bData.sales_executive,
        } as PurchaserRecord;
      }

      const { data: lData } = await (supabase as any)
        .from("plot_leads")
        .select("*")
        .eq("plot_id", selectedId)
        .eq("status", "converted")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lData) {
        return {
          plot_id: lData.plot_id,
          customer_name: lData.name,
          customer_phone: lData.phone,
          customer_email: lData.email,
          total_price: lData.budget,
          remarks: lData.notes,
          lead: { source: lData.source, notes: lData.notes },
        } as PurchaserRecord;
      }

      return null;
    },
  });
  const attachTargetPlot = plots?.find((p) => p.id === attachTargetId) ?? null;
  const unmapped = useMemo(
    () => (plots ?? []).filter((p) => !p.polygon_coordinates || p.polygon_coordinates.length < 3),
    [plots],
  );
  const mapped = useMemo(
    () => (plots ?? []).filter((p) => p.polygon_coordinates && p.polygon_coordinates.length >= 3),
    [plots],
  );

  const [activeTab, setActiveTab] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const filteredPlots = useMemo(() => {
    if (!plots) return [];
    let result = plots;

    if (activeTab === "north") result = result.filter(p => p.facing === "north" || p.facing === "north_east" || p.facing === "north_west");
    else if (activeTab === "east") result = result.filter(p => p.facing === "east" || p.facing === "north_east" || p.facing === "south_east");
    else if (activeTab === "south") result = result.filter(p => p.facing === "south" || p.facing === "south_east" || p.facing === "south_west");
    else if (activeTab === "west") result = result.filter(p => p.facing === "west" || p.facing === "north_west" || p.facing === "south_west");
    else if (activeTab === "corner") result = result.filter(p => p.corner_plot);

    if (statusFilter !== "all") {
      result = result.filter(p => p.status === statusFilter);
    }

    return result;
  }, [plots, activeTab, statusFilter]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["plots", projectId] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  const createPlot = useMutation({
    mutationFn: async (values: PlotFormValues) => {
      const { error } = await supabase.from("plots").insert({
        project_id: projectId,
        plot_number: values.plot_number.trim(),
        status: values.status,
        facing: values.facing,
        area_sqft: values.area_sqft,
        dimensions: values.dimensions || null,
        price: values.price,
        road_width: values.road_width,
        corner_plot: values.corner_plot,
        remarks: values.remarks || null,
        length_ft: values.length_ft,
        width_ft: values.width_ft,
        rate_per_sqft: values.rate_per_sqft,
        incentive_percentage: values.incentive_percentage,
        polygon_coordinates: (pendingPolygon as unknown as never) ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plot created and mapped");
      invalidate();
      closeForm();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create plot"),
  });

  const updatePlotInfo = useMutation({
    mutationFn: async (values: PlotFormValues & { id: string }) => {
      const { error } = await supabase
        .from("plots")
        .update({
          plot_number: values.plot_number.trim(),
          status: values.status,
          facing: values.facing,
          area_sqft: values.area_sqft,
          dimensions: values.dimensions || null,
          price: values.price,
          road_width: values.road_width,
          corner_plot: values.corner_plot,
          remarks: values.remarks || null,
          length_ft: values.length_ft,
          width_ft: values.width_ft,
          rate_per_sqft: values.rate_per_sqft,
          incentive_percentage: values.incentive_percentage,
        } as never)
        .eq("id", values.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plot updated");
      invalidate();
      closeForm();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update plot"),
  });

  const updatePolygon = useMutation({
    mutationFn: async ({ id, points }: { id: string; points: Point[] }) => {
      const { error } = await supabase
        .from("plots")
        .update({ polygon_coordinates: points as unknown as never } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success("Boundary saved");
      invalidate();
      setSelectedId(vars.id);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save boundary"),
  });

  const deletePlot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plot deleted");
      setSelectedId(null);
      invalidate();
    },
    onError: (e: any) => {
      if (e.code === "23503")
        toast.error("Can't delete: this plot has booking history. Cancel its bookings first.");
      else toast.error(e.message ?? "Failed to delete plot");
    },
  });

  const updatePlotStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PlotStatus }) => {
      const updateData: any = { status };
      if (status === "available") {
        updateData.selected_lead_id = null;
      }
      const { error } = await supabase.from("plots").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plot status updated");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update plot status"),
  });

  // ---------------------------------------------------------------------
  // Coordinate conversions — the SVG is rendered at its natural pixel
  // size × scale, laid out normally (no transform, no manual offset), so
  // a click's position relative to the SVG element is all we need.
  // ---------------------------------------------------------------------
  const clientToPx = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = svgRef.current!.getBoundingClientRect();
      return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
    },
    [scale],
  );

  const pxToPercent = useCallback(
    (p: Point): Point => {
      if (!natural) return p;
      return {
        x: Math.round(Math.min(100, Math.max(0, (p.x / natural.width) * 100)) * 100) / 100,
        y: Math.round(Math.min(100, Math.max(0, (p.y / natural.height) * 100)) * 100) / 100,
      };
    },
    [natural],
  );

  const percentToPx = useCallback(
    (p: Point): Point => {
      if (!natural) return p;
      return { x: (p.x / 100) * natural.width, y: (p.y / 100) * natural.height };
    },
    [natural],
  );

  // ---------------------------------------------------------------------
  // Zoom — always anchored to a fixed point (the viewport center for the
  // +/- buttons, the cursor for the scroll wheel), adjusting scroll so
  // the image scales in place instead of jumping around.
  // ---------------------------------------------------------------------
  const zoomAt = useCallback((newScaleRaw: number, viewportX: number, viewportY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScaleRaw));
    const currentScale = scaleRef.current;
    if (newScale === currentScale) return;
    const contentX = el.scrollLeft + viewportX;
    const contentY = el.scrollTop + viewportY;
    const ratio = newScale / currentScale;
    
    scaleRef.current = newScale;
    flushSync(() => {
      setScale(newScale);
    });
    
    // Force browser to recalculate layout so the scroll limits expand BEFORE we set scrollLeft
    void el.scrollWidth;
    
    el.scrollLeft = contentX * ratio - viewportX;
    el.scrollTop = contentY * ratio - viewportY;
  }, []);

  const zoomButton = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    zoomAt(scaleRef.current * factor, rect.width / 2, rect.height / 2);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !natural) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); // Prevents native scrolling
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      const currentScale = scaleRef.current;
      
      const newScaleRaw = currentScale * factor;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScaleRaw));
      if (newScale === currentScale) return;
      const viewportX = e.clientX - rect.left;
      const viewportY = e.clientY - rect.top;
      const contentX = el.scrollLeft + viewportX;
      const contentY = el.scrollTop + viewportY;
      const ratio = newScale / currentScale;
      
      scaleRef.current = newScale;
      flushSync(() => {
        setScale(newScale);
      });
      void el.scrollWidth;
      el.scrollLeft = contentX * ratio - viewportX;
      el.scrollTop = contentY * ratio - viewportY;
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [natural]);

  const [isPanning, setIsPanning] = useState(false);
  const lastPanPoint = useRef<{ x: number; y: number } | null>(null);

  const onMouseMove = (e: React.MouseEvent) => {
    if (drawing) {
      setCursor(clientToPx(e.clientX, e.clientY));
      return;
    }
    
    if (isPanning && lastPanPoint.current && containerRef.current) {
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      containerRef.current.scrollLeft -= dx;
      containerRef.current.scrollTop -= dy;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (drawing) return;
    setIsPanning(true);
    lastPanPoint.current = { x: e.clientX, y: e.clientY };
  };

  const onMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      lastPanPoint.current = null;
    }
  };

  useEffect(() => {
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [isPanning]);

  // ---------------------------------------------------------------------
  // Boundary tracing
  // ---------------------------------------------------------------------
  function startDrawNew() {
    if (!natural) return;
    setSelectedId(null);
    setAttachTargetId(null);
    setDraftPoints([]);
    setDrawing(true);
  }

  function startDrawFor(plotId: string) {
    if (!natural) return;
    setSelectedId(null);
    setAttachTargetId(plotId);
    setDraftPoints([]);
    setDrawing(true);
  }

  function cancelDrawing() {
    setDrawing(false);
    setDraftPoints([]);
    setCursor(null);
    setAttachTargetId(null);
  }

  function onSvgClick(e: React.MouseEvent) {
    if (!drawing) return;
    e.stopPropagation();
    const newPoint = clientToPx(e.clientX, e.clientY);
    const newPoints = [...draftPoints, newPoint];
    
    if (newPoints.length === 4) {
      finishShape(newPoints);
    } else {
      setDraftPoints(newPoints);
    }
  }

  function undoPoint() {
    setDraftPoints((prev) => prev.slice(0, -1));
  }

  function exitFullscreenIfNeeded() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    }
  }

  function finishShape(pts: Point[] = draftPoints) {
    if (pts.length < MIN_POINTS) return;
    const percentPts = pts.map(pxToPercent);
    if (attachTargetId) {
      updatePolygon.mutate({ id: attachTargetId, points: percentPts });
      setDrawing(false);
      setDraftPoints([]);
      setCursor(null);
      setAttachTargetId(null);
    } else {
      exitFullscreenIfNeeded();
      setPendingPolygon(percentPts);
      setEditingPlot(null);
      setFormOpen(true);
      setDrawing(false);
      setDraftPoints([]);
      setCursor(null);
    }
  }

  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelDrawing();
      if (e.key === "Enter" && draftPoints.length >= MIN_POINTS) finishShape();
      if (e.key === "Backspace" || e.key === "z" || e.key === "Z") {
        if (e.metaKey || e.ctrlKey || e.key === "Backspace") undoPoint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing, draftPoints]);

  function openEdit(plot: PlotRow) {
    exitFullscreenIfNeeded();
    setEditingPlot(plot);
    setPendingPolygon(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingPlot(null);
    setPendingPolygon(null);
  }

  function submitForm(values: PlotFormValues) {
    if (editingPlot) updatePlotInfo.mutate({ ...values, id: editingPlot.id });
    else createPlot.mutate(values);
  }

  const stats = useMemo(() => {
    const s = {
      total: plots?.length ?? 0,
      mapped: mapped.length,
      unmapped: unmapped.length,
      counts: {
        available: 0,
        pending: 0,
        booked: 0,
        reserved: 0,
        sold: 0,
        cancelled: 0,
      } as Record<PlotStatus, number>,
    };
    plots?.forEach(p => {
      if (s.counts[p.status] !== undefined) {
        s.counts[p.status]++;
      }
    });
    return s;
  }, [plots, mapped.length, unmapped.length]);

  const draftPreview =
    drawing && draftPoints.length > 0 && cursor ? [...draftPoints, cursor] : draftPoints;

  return (
    <section
      ref={sectionRef}
      className={
        isFullscreen
          ? "bg-background p-4 md:p-6 flex flex-col h-screen w-screen overflow-hidden"
          : "bg-card border rounded-lg p-6 mb-8"
      }
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3 shrink-0">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta shrink-0">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-display text-2xl leading-tight">Site layout · Master plan</h2>
              {!layoutPath && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload the site layout to start tracing plot boundaries
                </p>
              )}
            </div>
          </div>
          
          {layoutPath && stats.total > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium border shadow-sm">
                <span>Total: {stats.total}</span>
              </div>
              <div className="w-px h-4 bg-border mx-1"></div>
              {(Object.keys(STATUS_LABEL) as PlotStatus[]).map(status => {
                const count = stats.counts[status];
                const palette = STATUS_PALETTE[status];
                return (
                  <div key={status} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background border text-xs font-medium shadow-sm transition-opacity ${count === 0 ? 'opacity-50 grayscale' : ''}`}>
                    <span className={`w-2 h-2 rounded-full ${palette.dot}`} />
                    <span>{STATUS_LABEL[status]}</span>
                    <span className="text-muted-foreground font-semibold ml-0.5">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            {layoutPath && !drawing && (
              <Button
                size="sm"
                className="bg-terracotta text-accent-foreground hover:bg-terracotta/90"
                onClick={startDrawNew}
                disabled={!natural}
              >
                <Plus className="h-3 w-3 mr-1" /> Add plot
              </Button>
            )}
            {drawing && (
              <>
                <span className="rounded-md bg-amber-100 dark:bg-amber-950 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                  {attachTargetPlot
                    ? `Tracing boundary for ${attachTargetPlot.plot_number}`
                    : "Tracing new plot"}{" "}
                  · {draftPoints.length} point{draftPoints.length === 1 ? "" : "s"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={undoPoint}
                  disabled={draftPoints.length === 0}
                >
                  <Undo2 className="h-3 w-3 mr-1" /> Undo
                </Button>
                <Button size="sm" variant="outline" onClick={cancelDrawing}>
                  <X className="h-3 w-3 mr-1" /> Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => finishShape()}
                  disabled={draftPoints.length < MIN_POINTS}
                  className="bg-terracotta text-accent-foreground hover:bg-terracotta/90"
                >
                  <Check className="h-3 w-3 mr-1" /> Finish shape
                </Button>
              </>
            )}
            <label className="inline-flex">
              <Button variant="outline" size="sm" asChild>
                <span className="cursor-pointer">
                  <Upload className="h-3 w-3 mr-1" />{" "}
                  {layoutPath ? "Replace layout" : "Upload layout"}
                </span>
              </Button>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadLayout(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        )}

        {layoutPath && (
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit full screen" : "Open full screen to map precisely"}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3 w-3 mr-1" /> Exit full screen
              </>
            ) : (
              <>
                <Maximize2 className="h-3 w-3 mr-1" /> Full screen
              </>
            )}
          </Button>
        )}
      </div>

      {!layoutPath && (
        <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
          <Compass className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            {isAdmin
              ? "Upload the scanned site plan (PDF, PNG or JPG). Once it's up, trace each plot's boundary directly on the drawing."
              : "The site layout has not been uploaded yet."}
          </p>
          {isAdmin && (
            <label>
              <Button
                asChild
                className="bg-terracotta text-accent-foreground hover:bg-terracotta/90"
              >
                <span className="cursor-pointer">
                  <Upload className="h-3 w-3 mr-2" /> Upload layout
                </span>
              </Button>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onUploadLayout(e.target.files[0])}
              />
            </label>
          )}
          {uploading && <p className="text-xs text-amber-600 mt-3">Processing…</p>}
        </div>
      )}

      {layoutPath && layoutUrl && (
        <div
          className={
            isFullscreen
              ? "grid lg:grid-cols-[1fr_300px] gap-4 flex-1 min-h-0"
              : "grid lg:grid-cols-[1fr_300px] gap-4"
          }
        >
          <div className="flex flex-col min-h-0">
            {/* Positioning frame — stays put; only this element's children
                (the scroll container) move when the image is zoomed in. */}
            <div
              className={`relative w-full rounded-md border bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklch,var(--foreground)_14%,transparent)_1px,transparent_0)] [background-size:20px_20px] ${isFullscreen ? "flex-1 min-h-0" : "h-[62vh]"
                }`}
            >
              {(imgLoading || !natural) && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading layout…
                </div>
              )}

              {natural && (
                <div
                  ref={containerRef}
                  onMouseMove={onMouseMove}
                  onMouseDown={onMouseDown}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                  className="absolute inset-0 overflow-auto rounded-md select-none"
                  style={{ cursor: drawing ? "crosshair" : isPanning ? "grabbing" : "grab" }}
                >
                  <svg
                    ref={svgRef}
                    onClick={onSvgClick}
                    width={natural.width * scale}
                    height={natural.height * scale}
                    viewBox={`0 0 ${natural.width} ${natural.height}`}
                    className="block"
                  >
                    <image
                      href={layoutUrl}
                      x={0}
                      y={0}
                      width={natural.width}
                      height={natural.height}
                      style={{ imageRendering: "auto" }}
                    />

                    {mapped.map((plot) => {
                      const pts = (plot.polygon_coordinates as Point[]).map(percentToPx);
                      const palette = STATUS_PALETTE[plot.status];
                      const isSel = selectedId === plot.id;
                      const centroid = polygonCentroid(pts);
                      
                      const xs = pts.map(p => p.x);
                      const ys = pts.map(p => p.y);
                      const plotWidth = Math.max(...xs) - Math.min(...xs);
                      const plotHeight = Math.max(...ys) - Math.min(...ys);
                      const fontSize = Math.max(10, Math.min(plotWidth, plotHeight) * 0.35);

                      return (
                        <g
                          key={plot.id}
                          style={{ cursor: drawing ? "crosshair" : "pointer" }}
                          onClick={(e) => {
                            if (drawing) return;
                            e.stopPropagation();
                            setSelectedId(plot.id);
                          }}
                        >
                          <polygon
                            points={pointsAttr(pts)}
                            style={{ fill: palette.fill, stroke: palette.stroke }}
                            strokeWidth={isSel ? 3 : 1.5}
                            vectorEffect="non-scaling-stroke"
                          >
                            <title>{`Plot ${plot.plot_number} (${STATUS_LABEL[plot.status]})${projectBookings?.[plot.id] ? ` · Sold to ${projectBookings[plot.id].customer_name}` : ""}`}</title>
                          </polygon>

                          <text
                            x={centroid.x}
                            y={centroid.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#1c1917"
                            stroke="white"
                            strokeWidth={fontSize * 0.25}
                            paintOrder="stroke"
                            style={{
                              fontSize: `${fontSize}px`,
                              fontWeight: 800,
                              pointerEvents: "none",
                            }}
                          >
                            {plot.plot_number}
                          </text>
                        </g>
                      );
                    })}

                    {drawing && draftPreview.length > 0 && (
                      <g>
                        {draftPreview.length > 2 ? (
                          <polygon
                            points={pointsAttr(draftPreview)}
                            fill="color-mix(in oklch, var(--terracotta) 12%, transparent)"
                            stroke="var(--terracotta)"
                            strokeDasharray="6 4"
                            strokeWidth={1.5}
                            vectorEffect="non-scaling-stroke"
                          />
                        ) : (
                          <polyline
                            points={pointsAttr(draftPreview)}
                            fill="none"
                            stroke="var(--terracotta)"
                            strokeDasharray="6 4"
                            strokeWidth={1.5}
                            vectorEffect="non-scaling-stroke"
                          />
                        )}
                        {draftPoints.map((p, i) => (
                          <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r={5}
                            fill="white"
                            stroke="var(--terracotta)"
                            strokeWidth={2}
                            vectorEffect="non-scaling-stroke"
                          />
                        ))}
                      </g>
                    )}
                  </svg>
                </div>
              )}

              {natural && (
                <>
                  {/* Compass */}
                  <div className="pointer-events-none absolute right-3 top-3 flex h-16 w-16 items-center justify-center">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card/90 shadow-md backdrop-blur">
                      <span className="absolute top-1.5 text-[9px] font-bold text-terracotta">
                        N
                      </span>
                      <span className="absolute bottom-1.5 text-[9px] font-bold text-muted-foreground">
                        S
                      </span>
                      <span className="absolute left-1.5 text-[9px] font-bold text-muted-foreground">
                        W
                      </span>
                      <span className="absolute right-1.5 text-[9px] font-bold text-muted-foreground">
                        E
                      </span>
                      <svg viewBox="0 0 40 40" className="h-10 w-10">
                        <polygon points="20,4 24,20 20,17 16,20" fill="var(--terracotta)" />
                        <polygon points="20,36 24,20 20,23 16,20" fill="var(--muted-foreground)" />
                        <circle cx="20" cy="20" r="1.5" fill="var(--muted-foreground)" />
                      </svg>
                    </div>
                  </div>

                  {/* Zoom controls */}
                  <div className="absolute bottom-3 right-3 flex flex-col gap-0.5 rounded-md border border-border bg-card/95 p-1 shadow backdrop-blur">
                    <button
                      type="button"
                      onClick={() => zoomButton(1.25)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Zoom in"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                    <div className="px-1 text-center text-[10px] text-muted-foreground tabular-nums">
                      {Math.round(scale * 100)}%
                    </div>
                    <button
                      type="button"
                      onClick={() => zoomButton(0.8)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Zoom out"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </button>
                    <div className="my-0.5 h-px bg-border" />
                    <button
                      type="button"
                      onClick={fitToView}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Fit to view"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Legend */}
                  <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-border bg-card/95 px-3 py-2 text-[11px] shadow backdrop-blur">
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {(Object.keys(STATUS_LABEL) as PlotStatus[])
                        .filter(
                          (s) =>
                            s === "available" ||
                            s === "reserved" ||
                            s === "pending" ||
                            s === "booked",
                        )
                        .map((s) => (
                          <LegendDot key={s} status={s} label={STATUS_LABEL[s]} />
                        ))}
                    </div>
                    {drawing && (
                      <div className="mt-1.5 border-t border-border pt-1.5 text-muted-foreground">
                        Click 4 corners to place plot · Esc to cancel
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {drawing && (
              <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
                <MousePointerClick className="h-3 w-3" /> Click each corner of the plot in order (automatically finishes after 4 points). Use the zoom buttons for precision.
              </p>
            )}
          </div>

          {/* Side panel: selected plot details or plot roster */}
          <div className={`flex flex-col space-y-3 overflow-y-auto min-h-0 pr-1 ${isFullscreen ? "flex-1" : "max-h-[62vh]"}`}>
            {selectedPlot ? (
              <PlotInfoCard
                plot={selectedPlot}
                purchaser={selectedPlotPurchaser ?? null}
                isAdmin={isAdmin}
                userId={userId}
                onRecordSuccess={() => {
                  refetchSelectedPurchaser();
                  refetchProjectBookings();
                }}
                onClose={() => setSelectedId(null)}
                onEdit={() => openEdit(selectedPlot)}
                onRedraw={() => startDrawFor(selectedPlot.id)}
                onDelete={() => {
                  if (confirm(`Delete plot ${selectedPlot.plot_number}? This cannot be undone.`))
                    deletePlot.mutate(selectedPlot.id);
                }}
                onBook={() =>
                  navigate({ to: "/plots/$plotId/book", params: { plotId: selectedPlot.id } })
                }
                onBookForLead={(leadId) =>
                  navigate({
                    to: "/plots/$plotId/book",
                    params: { plotId: selectedPlot.id },
                  })
                }
                onUpdateStatus={(status) =>
                  updatePlotStatus.mutate({ id: selectedPlot.id, status })
                }
              />
            ) : (
              <div className="border rounded-lg bg-background flex flex-col max-h-[65vh]">
                <div className="px-4 py-3 border-b shrink-0 bg-muted/20 flex flex-col gap-3">
                  <div>
                    <p className="text-sm font-semibold">Plot directory</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {unmapped.length > 0
                        ? `${unmapped.length} not mapped yet`
                        : "Every plot is mapped"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={activeTab} onValueChange={setActiveTab}>
                      <SelectTrigger className="w-full h-8 text-xs bg-background">
                        <SelectValue placeholder="Filter facing" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All facing</SelectItem>
                        <SelectItem value="north" className="text-xs">North facing</SelectItem>
                        <SelectItem value="east" className="text-xs">East facing</SelectItem>
                        <SelectItem value="south" className="text-xs">South facing</SelectItem>
                        <SelectItem value="west" className="text-xs">West facing</SelectItem>
                        <SelectItem value="corner" className="text-xs">Corner plots</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full h-8 text-xs bg-background">
                        <SelectValue placeholder="Filter status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All status</SelectItem>
                        <SelectItem value="available" className="text-xs">Available</SelectItem>
                        <SelectItem value="booked" className="text-xs">Booked</SelectItem>
                        <SelectItem value="reserved" className="text-xs">Reserved</SelectItem>
                        <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                        <SelectItem value="sold" className="text-xs">Sold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto min-h-0 pb-2">
                  <ul className="divide-y">
                      {filteredPlots.map((p) => {
                        const isMapped = p.polygon_coordinates && p.polygon_coordinates.length >= 3;
                        return (
                          <li
                            key={p.id}
                            className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-muted/50 group transition-colors"
                          >
                            <button
                              className="flex flex-col gap-1 text-left flex-1 min-w-0"
                              onClick={() => isMapped && setSelectedId(p.id)}
                              disabled={!isMapped}
                            >
                              <div className="flex items-center gap-2 w-full">
                                <span
                                  className={`h-2 w-2 rounded-full shrink-0 ${STATUS_PALETTE[p.status].dot} shadow-sm`}
                                />
                                <span className="text-sm font-medium truncate group-hover:text-terracotta transition-colors">{p.plot_number}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground pl-4 flex-wrap">
                                {(p.status === "sold" || p.status === "booked") && projectBookings?.[p.id]?.customer_name ? (
                                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold truncate">
                                    Sold to: {projectBookings[p.id].customer_name}
                                  </span>
                                ) : (
                                  <span className="capitalize">{p.status}</span>
                                )}
                                {p.facing && (
                                  <>
                                    <span>·</span>
                                    <span>{FACING_LABEL[p.facing] ?? p.facing} facing</span>
                                  </>
                                )}
                                {p.area_sqft && (
                                  <>
                                    <span>·</span>
                                    <span>{p.area_sqft} sqft</span>
                                  </>
                                )}
                              </div>
                            </button>
                            {isAdmin && !isMapped && !drawing && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px] md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                onClick={() => startDrawFor(p.id)}
                              >
                                <Pencil className="h-3 w-3 mr-1" /> Draw
                              </Button>
                            )}
                          </li>
                        );
                      })}
                      {filteredPlots.length === 0 && (
                        <li className="px-4 py-8 text-center text-xs text-muted-foreground">
                          {plots?.length === 0 
                            ? "No plots yet. Click \"Add plot\" to trace the first boundary."
                            : "No plots found in this category."}
                        </li>
                      )}
                    </ul>
                  </div>
              </div>
            )}
          </div>
        </div>
      )}

      <PlotFormDialog
        open={formOpen}
        mode={editingPlot ? "edit" : "create"}
        initial={editingPlot}
        hasPendingPolygon={!!pendingPolygon}
        pending={createPlot.isPending || updatePlotInfo.isPending}
        isAdmin={isAdmin}
        onSubmit={submitForm}
        onOpenChange={(o) => !o && closeForm()}
      />
    </section>
  );
}

function LegendDot({ status, label }: { status: PlotStatus; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-sm border ${STATUS_PALETTE[status].dot}`} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function PlotInfoCard({
  plot,
  purchaser,
  isAdmin,
  userId,
  onRecordSuccess,
  onClose,
  onEdit,
  onRedraw,
  onDelete,
  onBook,
  onBookForLead,
  onUpdateStatus,
}: {
  plot: PlotRow;
  purchaser: PurchaserRecord | null;
  isAdmin: boolean;
  userId: string;
  onRecordSuccess: () => void;
  onClose: () => void;
  onEdit: () => void;
  onRedraw: () => void;
  onDelete: () => void;
  onBook: () => void;
  onBookForLead: (leadId: string) => void;
  onUpdateStatus?: (status: PlotStatus) => void;
}) {
  const isSoldOrBooked = plot.status === "sold" || plot.status === "booked";

  return (
    <div className="border rounded-lg bg-background p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Plot
          </p>
          <h3 className="text-display text-2xl leading-tight">{plot.plot_number}</h3>
        </div>
        <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {isAdmin && (
        <div className="border rounded-md bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-terracotta" /> Admin Status Control
            </span>
            <span className="text-[10px] text-terracotta font-medium">Instant Update</span>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={plot.status}
              onValueChange={(val) => onUpdateStatus?.(val as PlotStatus)}
              disabled={plot.status === "sold"}
            >
              <SelectTrigger className="h-8 text-xs bg-background font-medium capitalize flex-1 disabled:opacity-75">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABEL) as PlotStatus[]).map((s) => {
                  const isSoldOption = s === "sold";
                  const isDisabled = isSoldOption || plot.status === "sold";
                  return (
                    <SelectItem key={s} value={s} disabled={isDisabled} className="text-xs">
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${STATUS_PALETTE[s].dot}`} />
                        {STATUS_LABEL[s]} {isSoldOption ? "(Auto-set on sale)" : ""}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {plot.status === "available" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs whitespace-nowrap border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300"
                onClick={() => onUpdateStatus?.("reserved")}
              >
                <Bookmark className="h-3 w-3 mr-1" /> Reserve
              </Button>
            )}

            {plot.status === "reserved" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs whitespace-nowrap border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                onClick={() => onUpdateStatus?.("available")}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" /> Release
              </Button>
            )}
          </div>
          {plot.status === "sold" && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium pt-1 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 shrink-0" /> Sold site status is permanently locked.
            </p>
          )}
        </div>
      )}

      {/* If Plot is Sold or Booked, show Purchaser Details Card */}
      {isSoldOrBooked && (
        <PurchaserDetailsCard
          plot={plot}
          purchaser={purchaser}
          isAdmin={isAdmin}
          userId={userId}
          onRecordSuccess={onRecordSuccess}
        />
      )}

      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize mb-3">
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_PALETTE[plot.status].dot}`} />
          {STATUS_LABEL[plot.status]}
        </span>

        <dl className="space-y-2 text-xs">
          {plot.facing && (
            <Row
              label="Facing"
              value={
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-terracotta" />
                  {FACING_LABEL[plot.facing]}
                </span>
              }
            />
          )}
          {plot.length_ft && plot.width_ft && (
            <Row
              label="Dimensions"
              value={
                <span className="inline-flex items-center gap-1">
                  <Ruler className="h-3 w-3 text-muted-foreground" />
                  {plot.length_ft} × {plot.width_ft} ft
                </span>
              }
            />
          )}
          {!plot.length_ft && plot.dimensions && <Row label="Dimensions" value={plot.dimensions} />}
          <Row label="Area" value={`${Number(plot.area_sqft).toLocaleString("en-IN")} sq.ft`} />
          <Row
            label="Price"
            value={
              <span className="inline-flex items-center gap-0.5 font-semibold">
                <IndianRupee className="h-3 w-3" />
                {Number(plot.price).toLocaleString("en-IN")}
              </span>
            }
          />
          {plot.road_width != null && <Row label="Road width" value={`${plot.road_width} ft`} />}
          {plot.corner_plot && <Row label="Corner plot" value="Yes" />}
          {plot.remarks && (
            <div className="border-t pt-2">
              <dt className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Remarks
              </dt>
              <dd>{plot.remarks}</dd>
            </div>
          )}
        </dl>
      </div>

      {plot.status === "available" && !isAdmin && (
        <Button
          className="w-full mt-4 bg-terracotta text-accent-foreground hover:bg-terracotta/90"
          onClick={onBook}
        >
          Book this plot
        </Button>
      )}

      {isAdmin && (
        <div className="mt-4 space-y-1.5">
          {plot.status === "available" && (
            <Button
              className="w-full bg-terracotta text-accent-foreground hover:bg-terracotta/90"
              onClick={onBook}
            >
              Book this plot
            </Button>
          )}
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
              <Pencil className="h-3 w-3 mr-1" /> Edit info
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={onRedraw}>
              <MousePointerClick className="h-3 w-3 mr-1" /> Redraw
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-red-600 border-red-200 hover:bg-red-50"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Delete plot
          </Button>
        </div>
      )}

      {!isSoldOrBooked && (
        <div className="mt-4">
          <LeadsPanel
            plot={plot}
            isAdmin={isAdmin}
            userId={userId}
            onBookForLead={onBookForLead}
          />
        </div>
      )}
    </div>
  );
}


function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium capitalize">{value}</dd>
    </div>
  );
}
