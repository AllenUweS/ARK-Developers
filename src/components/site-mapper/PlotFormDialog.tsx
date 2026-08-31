import { useEffect, useState } from "react";
import { Save, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { sanitizePositiveNumber, sanitizePercentage, formatIndianCurrency } from "@/lib/formValidation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FACING_LABEL,
  STATUS_LABEL,
  STATUS_PALETTE,
  type PlotFacing,
  type PlotRow,
  type PlotStatus,
} from "./types";

export interface PlotFormValues {
  plot_number: string;
  status: PlotStatus;
  facing: PlotFacing | null;
  area_sqft: number;
  dimensions: string | null;
  price: number;
  road_width: number | null;
  corner_plot: boolean;
  remarks: string | null;
  length_ft: number | null;
  width_ft: number | null;
  rate_per_sqft: number | null;
  incentive_percentage: number | null;
}

const emptyForm = {
  plot_number: "",
  status: "available" as PlotStatus,
  facing: "east" as PlotFacing,
  length_ft: "",
  width_ft: "",
  rate_per_sqft: "",
  area_sqft: "",
  price: "",
  dimensions: "",
  road_width: "",
  corner_plot: false,
  remarks: "",
  incentive_percentage: "",
};

type FormState = typeof emptyForm;

function toFormState(plot: PlotRow | null): FormState {
  if (!plot) return emptyForm;
  return {
    plot_number: plot.plot_number,
    status: plot.status,
    facing: plot.facing ?? "east",
    length_ft: plot.length_ft?.toString() ?? "",
    width_ft: plot.width_ft?.toString() ?? "",
    rate_per_sqft: plot.rate_per_sqft?.toString() ?? "",
    area_sqft: plot.area_sqft?.toString() ?? "",
    price: plot.price?.toString() ?? "",
    dimensions: plot.dimensions ?? "",
    road_width: plot.road_width?.toString() ?? "",
    corner_plot: plot.corner_plot,
    remarks: plot.remarks ?? "",
    incentive_percentage: plot.incentive_percentage?.toString() ?? "",
  };
}

const STATUS_ORDER: PlotStatus[] = [
  "available",
  "reserved",
  "pending",
  "booked",
  "sold",
  "cancelled",
];

export function PlotFormDialog({
  open,
  mode,
  initial,
  hasPendingPolygon,
  pending,
  isAdmin = false,
  onSubmit,
  onOpenChange,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial: PlotRow | null;
  hasPendingPolygon: boolean;
  pending: boolean;
  isAdmin?: boolean;
  onSubmit: (values: PlotFormValues) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const isSoldPlot = initial?.status === "sold";
  const isStatusLocked = isSoldPlot || (!isAdmin && initial?.status === "booked");


  useEffect(() => {
    if (open) setForm(toFormState(initial));
  }, [open, initial]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Auto-fill area & price whenever length/width/rate change — still editable afterwards.
  useEffect(() => {
    const l = parseFloat(form.length_ft);
    const w = parseFloat(form.width_ft);
    if (!l || !w) return;
    const area = Math.round(l * w * 100) / 100;
    setForm((f) => ({
      ...f,
      area_sqft: area.toString(),
      dimensions: f.dimensions || `${l} x ${w} ft`,
    }));
    const r = parseFloat(form.rate_per_sqft);
    if (r) {
      const price = Math.round(area * r);
      setForm((f) => ({ ...f, price: price.toString() }));
    }
  }, [form.length_ft, form.width_ft, form.rate_per_sqft]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.plot_number.trim()) {
      return toast.error("Plot number is required.");
    }
    const area = sanitizePositiveNumber(form.area_sqft);
    const price = sanitizePositiveNumber(form.price);

    if (area <= 0) {
      return toast.error("Plot area (sq.ft) must be greater than 0.");
    }
    if (price <= 0) {
      return toast.error("Plot price (₹) must be greater than 0.");
    }

    onSubmit({
      plot_number: form.plot_number.trim(),
      status: form.status,
      facing: form.facing,
      area_sqft: area,
      dimensions: form.dimensions.trim() || null,
      price,
      road_width: form.road_width ? sanitizePositiveNumber(form.road_width) : null,
      corner_plot: form.corner_plot,
      remarks: form.remarks.trim() || null,
      length_ft: form.length_ft ? sanitizePositiveNumber(form.length_ft) : null,
      width_ft: form.width_ft ? sanitizePositiveNumber(form.width_ft) : null,
      rate_per_sqft: form.rate_per_sqft ? sanitizePositiveNumber(form.rate_per_sqft) : null,
      incentive_percentage: form.incentive_percentage ? sanitizePercentage(form.incentive_percentage) : null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-display text-2xl">
            {mode === "edit" ? `Edit plot ${initial?.plot_number}` : "New plot"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update the plot details below. Its boundary on the map is unaffected — use \u201cRedraw\u201d for that."
              : hasPendingPolygon
                ? "The boundary has been traced. Fill in the details to save this plot."
                : "Fill in the plot details."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Plot number" required>
              <Input
                autoFocus
                value={form.plot_number}
                onChange={(e) => set("plot_number", e.target.value)}
                placeholder="e.g. A-12"
                required
              />
            </Field>
            <Field label="Facing">
              <Select value={form.facing} onValueChange={(v) => set("facing", v as PlotFacing)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FACING_LABEL) as PlotFacing[]).map((f) => (
                    <SelectItem key={f} value={f}>
                      {FACING_LABEL[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Length (ft)">
              <Input
                type="number"
                inputMode="decimal"
                value={form.length_ft}
                onChange={(e) => set("length_ft", e.target.value)}
                placeholder="30"
              />
            </Field>
            <Field label="Width (ft)">
              <Input
                type="number"
                inputMode="decimal"
                value={form.width_ft}
                onChange={(e) => set("width_ft", e.target.value)}
                placeholder="40"
              />
            </Field>
            <Field label="Rate (₹/sqft)">
              <Input
                type="number"
                inputMode="decimal"
                value={form.rate_per_sqft}
                onChange={(e) => set("rate_per_sqft", e.target.value)}
                placeholder="2500"
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Area (sqft)" required>
              <Input
                type="number"
                inputMode="decimal"
                value={form.area_sqft}
                readOnly
                className="bg-muted cursor-not-allowed"
                required
              />
              {form.area_sqft && (
                <p className="text-[11px] font-semibold text-terracotta mt-1 flex items-center gap-1">
                  📐 Equivalent Area: <strong>{(Number(form.area_sqft) * 0.092903).toFixed(2)} sq.m</strong> (sq.meters)
                </p>
              )}
            </Field>
            <Field label="Price (₹)" required>
              <Input
                type="text"
                value={form.price ? `₹${formatIndianCurrency(form.price)}` : ""}
                readOnly
                className="bg-muted cursor-not-allowed font-mono font-bold"
                required
              />
            </Field>
            <Field label="Dimensions">
              <Input
                value={form.dimensions}
                readOnly
                className="bg-muted cursor-not-allowed"
                placeholder="30 x 40 ft"
              />
            </Field>
            <Field label="Incentive (%)">
              <Input
                type="number"
                inputMode="decimal"
                value={form.incentive_percentage}
                onChange={(e) => set("incentive_percentage", e.target.value)}
                placeholder="e.g. 2"
              />
            </Field>
          </div>

          <Field label="Status">
            <div className="grid grid-cols-3 gap-2">
              {STATUS_ORDER.map((s) => {
                const active = form.status === s;
                const isSoldBtn = s === "sold";
                const isDisabled = isStatusLocked || (isSoldBtn && form.status !== "sold");
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => !isDisabled && set("status", s)}
                    title={isSoldBtn && form.status !== "sold" ? "Sold status is assigned automatically upon completed sale" : undefined}
                    className={`rounded-md border px-3 py-2 text-xs font-medium capitalize transition ${
                      active
                        ? "border-terracotta bg-terracotta/10 text-terracotta"
                        : "border-border text-muted-foreground hover:bg-muted"
                    } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${STATUS_PALETTE[s].dot}`}
                    />
                    {STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
            {isSoldPlot ? (
              <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                <Lock className="h-3 w-3 shrink-0" />
                This plot is sold. Sold plot status cannot be changed.
              </p>
            ) : isStatusLocked ? (
              <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Lock className="h-3 w-3 shrink-0" />
                Status is locked for {initial?.status} plots. To alter status, update the booking pipeline.
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Note: "Sold" status is assigned automatically when a booking/sale is completed.
              </p>
            )}
          </Field>

          <div className="flex items-center gap-2">
            <Checkbox
              id="corner_plot"
              checked={form.corner_plot}
              onCheckedChange={(v) => set("corner_plot", !!v)}
            />
            <Label htmlFor="corner_plot" className="text-sm font-normal cursor-pointer">
              Corner plot
            </Label>
          </div>

          <Field label="Remarks (optional)">
            <Textarea
              rows={2}
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              placeholder="Near park, premium location…"
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="bg-terracotta text-accent-foreground hover:bg-terracotta/90"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />{" "}
              {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create plot"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="text-terracotta"> *</span>}
      </span>
      {children}
    </label>
  );
}
