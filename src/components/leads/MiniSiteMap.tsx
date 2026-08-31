import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers, MapPinOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  STATUS_LABEL,
  STATUS_PALETTE,
  pointsAttr,
  polygonCentroid,
  type PlotRow,
  type PlotStatus,
  type Point,
} from "@/components/site-mapper/types";

/** Loads just the natural aspect ratio of the layout image (cheap — no
 *  pixel-space math needed) so the SVG viewport can be sized to match it
 *  without distorting the image. */
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
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);
  return aspect;
}

/**
 * Read-only, self-contained "where is this plot?" preview. Fetches the
 * project's layout image + full plot roster, then renders the layout with
 * every plot traced but dims everything except the target plot, which gets
 * a glowing, pulsing outline and a status pin — so a lead's location and
 * booking status are legible at a glance without opening the full editor.
 */
export function MiniSiteMap({
  projectId,
  plotId,
  projectName,
}: {
  projectId: string;
  plotId: string | null | undefined;
  projectName?: string;
}) {
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["mini-map-project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, layout_image_url")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string; layout_image_url: string | null } | null;
    },
  });

  const layoutPath = project?.layout_image_url ?? null;

  const { data: layoutUrl } = useQuery({
    queryKey: ["mini-map-layout-url", layoutPath],
    enabled: !!layoutPath,
    queryFn: async () => {
      if (!layoutPath) return null;
      if (layoutPath.startsWith("http://") || layoutPath.startsWith("https://")) {
        return layoutPath;
      }
      const { data } = await supabase.storage
        .from("project-layouts")
        .createSignedUrl(layoutPath!, 3600);
      if (data?.signedUrl) return data.signedUrl;

      // Fallback to old project storage public URL for cloned projects
      return `https://zolbuckwnjsxfgqqkcjj.supabase.co/storage/v1/object/public/project-layouts/${layoutPath}`;
    },
  });

  const { data: plots, isLoading: plotsLoading } = useQuery({
    queryKey: ["mini-map-plots", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase.from("plots").select("*").eq("project_id", projectId);
      if (error) throw error;
      return (data ?? []) as unknown as PlotRow[];
    },
  });

  const aspect = useImageAspect(layoutUrl);
  const isLoading = projectLoading || plotsLoading;
  const target = plots?.find((p) => p.id === plotId) ?? null;
  const mapped = (plots ?? []).filter(
    (p) => p.polygon_coordinates && p.polygon_coordinates.length >= 3,
  );
  const targetHasShape = !!target?.polygon_coordinates && target.polygon_coordinates.length >= 3;
  const centroid = targetHasShape ? polygonCentroid(target!.polygon_coordinates as Point[]) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/30 py-16 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading site map…
      </div>
    );
  }

  if (!layoutPath || !layoutUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/60 bg-muted/20 py-10 text-center">
        <MapPinOff className="h-4 w-4 text-muted-foreground/60" />
        <p className="text-xs text-muted-foreground">
          {projectName ?? "This project"} doesn't have a layout uploaded yet.
        </p>
      </div>
    );
  }

  if (!target || !targetHasShape) {
    return (
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted">
          <img src={layoutUrl} alt={projectName} className="w-full opacity-60 blur-[1px]" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-background/40 text-center backdrop-blur-[1px]">
            <MapPinOff className="h-4 w-4 text-muted-foreground" />
            <p className="px-6 text-xs font-medium text-foreground">
              This plot hasn't been traced on the layout yet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const palette = STATUS_PALETTE[target.status as PlotStatus];
  const statusLabel = STATUS_LABEL[target.status as PlotStatus];

  return (
    <div className="space-y-2.5">
      <div
        className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklch,var(--foreground)_10%,transparent)_1px,transparent_0)] [background-size:16px_16px] shadow-inner"
        style={{ aspectRatio: aspect ?? 16 / 9 }}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <filter id={`glow-${target.id}`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="1.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <image href={layoutUrl} x={0} y={0} width={100} height={100} preserveAspectRatio="none" />

          {/* Every other plot, dimmed for context */}
          {mapped
            .filter((p) => p.id !== target.id)
            .map((p) => {
              const pal = STATUS_PALETTE[p.status as PlotStatus];
              return (
                <polygon
                  key={p.id}
                  points={pointsAttr(p.polygon_coordinates as Point[])}
                  style={{ fill: pal.fill, stroke: pal.stroke }}
                  strokeWidth={0.35}
                  opacity={0.32}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

          {/* Target plot — glowing, animated highlight */}
          <g filter={`url(#glow-${target.id})`}>
            <polygon
              points={pointsAttr(target.polygon_coordinates as Point[])}
              style={{ fill: palette.fill, stroke: palette.stroke }}
              strokeWidth={1.1}
              vectorEffect="non-scaling-stroke"
            />
            <polygon
              points={pointsAttr(target.polygon_coordinates as Point[])}
              fill="none"
              style={{ stroke: palette.stroke }}
              strokeWidth={2.2}
              vectorEffect="non-scaling-stroke"
              className="animate-pulse"
              opacity={0.85}
            />
          </g>
        </svg>

        {/* Pulsing locator pin, positioned via the same percentage grid as the polygon */}
        {centroid && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${centroid.x}%`, top: `${centroid.y}%` }}
          >
            <span
              className="absolute inset-0 -m-2 animate-ping rounded-full opacity-60"
              style={{ backgroundColor: palette.stroke }}
            />
            <span
              className="relative block h-3 w-3 rounded-full border-2 border-background shadow-md"
              style={{ backgroundColor: palette.stroke }}
            />
          </div>
        )}

        {/* Status chip */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-border/70 bg-card/95 px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur">
          <span className={`h-1.5 w-1.5 rounded-full ${palette.dot}`} />
          Plot {target.plot_number} · {statusLabel}
        </div>

        {/* Project chip */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-border/70 bg-card/90 px-2.5 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
          <Layers className="h-2.5 w-2.5" />
          {projectName}
        </div>
      </div>
    </div>
  );
}
