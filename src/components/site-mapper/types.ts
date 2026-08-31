export type PlotStatus = "available" | "pending" | "booked" | "reserved" | "sold" | "cancelled";
export type PlotFacing =
  "north" | "south" | "east" | "west" | "north_east" | "north_west" | "south_east" | "south_west";

/** A boundary point stored as a percentage (0-100) of the layout image's
 *  width/height, so the shape stays correct at any render size or zoom. */
export interface Point {
  x: number;
  y: number;
}

export interface PlotRow {
  id: string;
  project_id: string;
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
  polygon_coordinates: Point[] | null;
  layout_x: number | null;
  layout_y: number | null;
  selected_lead_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export const STATUS_LABEL: Record<PlotStatus, string> = {
  available: "Available",
  pending: "Pending",
  booked: "Booked",
  reserved: "Reserved",
  sold: "Sold",
  cancelled: "Cancelled",
};

/** CSS-variable-driven palette so the map matches the app's existing
 *  design tokens (--plot-available, --plot-pending, etc.) instead of
 *  hard-coded hex values. */
export const STATUS_PALETTE: Record<PlotStatus | "has_leads", { fill: string; stroke: string; dot: string }> = {
  available: {
    fill: "color-mix(in oklch, var(--plot-available) 35%, transparent)",
    stroke: "var(--plot-available)",
    dot: "bg-emerald-500",
  },
  has_leads: {
    fill: "color-mix(in oklch, var(--plot-has-leads) 55%, transparent)",
    stroke: "var(--plot-has-leads)",
    dot: "bg-yellow-300 border border-yellow-400",
  },
  pending: {
    fill: "color-mix(in oklch, var(--plot-pending) 40%, transparent)",
    stroke: "var(--plot-pending)",
    dot: "bg-amber-500",
  },
  reserved: {
    fill: "color-mix(in oklch, var(--plot-reserved) 35%, transparent)",
    stroke: "var(--plot-reserved)",
    dot: "bg-blue-500",
  },
  booked: {
    fill: "color-mix(in oklch, var(--plot-booked) 35%, transparent)",
    stroke: "var(--plot-booked)",
    dot: "bg-orange-500",
  },
  sold: {
    fill: "color-mix(in oklch, var(--plot-sold) 40%, transparent)",
    stroke: "var(--plot-sold)",
    dot: "bg-red-600",
  },
  cancelled: {
    fill: "color-mix(in oklch, var(--muted-foreground) 25%, transparent)",
    stroke: "var(--muted-foreground)",
    dot: "bg-muted-foreground",
  },
};

export const FACING_LABEL: Record<PlotFacing, string> = {
  north: "North",
  south: "South",
  east: "East",
  west: "West",
  north_east: "North-East",
  north_west: "North-West",
  south_east: "South-East",
  south_west: "South-West",
};

// ---------------------------------------------------------------------
// Leads
//
// A single plot can have many prospective buyers logged against it
// before one of them is chosen. This tracks each enquiry through a
// simple pipeline from first contact to a scheduled site visit to
// either a converted booking or a dropped enquiry.
// ---------------------------------------------------------------------
export type LeadStatus =
  | "new"
  | "contacted"
  | "meeting_scheduled"
  | "negotiating"
  | "converted"
  | "dropped";

export interface LeadRow {
  id: string;
  plot_id: string | null;
  project_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  source: string | null;
  budget: number | null;
  notes: string | null;
  meeting_date: string | null;
  meeting_location: string | null;
  status: LeadStatus;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at?: string;
}

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  meeting_scheduled: "Meeting scheduled",
  negotiating: "Negotiating",
  converted: "Converted",
  dropped: "Dropped",
};

/** Ordered so a status <Select> reads like a natural pipeline. */
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "new",
  "contacted",
  "meeting_scheduled",
  "negotiating",
  "converted",
  "dropped",
];

export const LEAD_STATUS_PALETTE: Record<LeadStatus, { badge: string; dot: string }> = {
  new: {
    badge: "bg-sky-500/10 text-sky-600 border-sky-500/30 dark:text-sky-400",
    dot: "bg-sky-500",
  },
  contacted: {
    badge:
      "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  meeting_scheduled: {
    badge:
      "bg-violet-500/10 text-violet-600 border-violet-500/30 dark:text-violet-400",
    dot: "bg-violet-500",
  },
  negotiating: {
    badge:
      "bg-plot-reserved/10 text-plot-reserved border-plot-reserved/30",
    dot: "bg-plot-reserved",
  },
  converted: {
    badge:
      "bg-plot-available/10 text-plot-available border-plot-available/30",
    dot: "bg-plot-available",
  },
  dropped: {
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
};

export const LEAD_SOURCES = [
  "Walk-in",
  "Referral",
  "Online enquiry",
  "Social media",
  "Cold call",
  "Site visit",
  "Other",
] as const;

export function polygonCentroid(pts: Point[]): Point {
  const n = pts.length || 1;
  const sum = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / n, y: sum.y / n };
}

export function pointsAttr(pts: Point[]) {
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export interface PurchaserRecord {
  id?: string;
  plot_id?: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  customer_address?: string | null;
  total_price?: number | null;
  booking_amount?: number | null;
  advance_paid?: number | null;
  booking_date?: string | null;
  payment_method?: string | null;
  status?: string | null;
  remarks?: string | null;
  sales_executive?: {
    full_name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  lead?: {
    source?: string | null;
    notes?: string | null;
  } | null;
}

