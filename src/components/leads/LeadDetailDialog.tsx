import type { ComponentType } from "react";
import {
  Phone,
  MessageCircle,
  Mail,
  Calendar,
  MapPin,
  MapPinOff,
  IndianRupee,
  Flame,
  Pencil,
  StickyNote,
  History,
  Info,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_ORDER,
  LEAD_STATUS_PALETTE,
  type LeadRow,
  type LeadStatus,
} from "@/components/site-mapper/types";
import { toast } from "sonner";
import { formatShortDate, getTemperature, initials, tintFor, isAllowedStageTransition } from "./leadUtils";
import { MiniSiteMap } from "./MiniSiteMap";
import { SiteVisitProofPanel } from "./SiteVisitProofPanel";
import { LeadLifecycleTimeline } from "./LeadLifecycleTimeline";

function digitsOnly(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

function formatMeeting(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LeadDetailDialog({
  lead,
  employeeName,
  plotNumber,
  projectName,
  canManage,
  userId,
  canCaptureVisit,
  canReviewVisits,
  onOpenChange,
  onStatusChange,
  onEdit,
  onMapPlot,
}: {
  lead: LeadRow | null;
  employeeName: string;
  plotNumber?: string;
  projectName?: string;
  canManage: boolean;
  userId: string;
  canCaptureVisit: boolean;
  canReviewVisits: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: string, status: LeadStatus) => void;
  onEdit?: (lead: LeadRow) => void;
  onMapPlot?: (lead: LeadRow) => void;
}) {
  const open = !!lead;
  const palette = lead ? LEAD_STATUS_PALETTE[lead.status] : null;
  const temp = lead ? getTemperature(lead) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto p-0 gap-0">
        {lead && palette && (
          <>
            {/* ---- Lead details, always up top ---- */}
            <DialogHeader className="px-6 pt-6 pb-4 space-y-4 text-left border-b border-border/40">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-11 w-11 shrink-0 border border-border/60 shadow-sm">
                    <AvatarFallback className={`text-sm font-bold ${tintFor(lead.created_by)}`}>
                      {initials(lead.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <DialogTitle className="flex items-center gap-2 text-xl truncate">
                      {lead.name}
                      {temp === "hot" && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive shrink-0">
                          <Flame className="h-2.5 w-2.5" /> Hot
                        </span>
                      )}
                      {temp === "warm" && (
                        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                          Warm
                        </span>
                      )}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Added {formatShortDate(lead.created_at)} by {employeeName}
                    </p>
                  </div>
                </div>

                {canManage && onEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0"
                    onClick={() => onEdit(lead)}
                  >
                    <Pencil className="h-3 w-3 mr-1.5" /> Edit
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`tel:${lead.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium hover:border-terracotta/40 hover:text-terracotta transition-colors"
                >
                  <Phone className="h-3 w-3" /> {lead.phone}
                </a>
                <a
                  href={`https://wa.me/91${digitsOnly(lead.phone).slice(-10)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium hover:border-plot-available/50 hover:text-plot-available transition-colors"
                >
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </a>
                {lead.email && (
                  <a
                    href={`mailto:${lead.email}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium hover:border-terracotta/40 hover:text-terracotta transition-colors"
                  >
                    <Mail className="h-3 w-3" /> {lead.email}
                  </a>
                )}

                <div className="ml-auto flex items-center gap-2 flex-wrap">
                  {canManage && lead.status !== "converted" && lead.status !== "dropped" && onMapPlot && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onMapPlot(lead)}
                      className="h-7 text-xs font-semibold text-terracotta border-terracotta/40 hover:bg-terracotta/10 gap-1.5 px-3 rounded-full cursor-pointer"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{lead.plot_id ? "Change Plot" : "Map to Plot"}</span>
                    </Button>
                  )}

                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${palette.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${palette.dot}`} />
                    {LEAD_STATUS_LABEL[lead.status]}
                  </span>

                  {canManage && lead.status !== "converted" && lead.status !== "dropped" && (() => {
                    const currentIdx = LEAD_STATUS_ORDER.indexOf(lead.status);
                    const nextStatus = LEAD_STATUS_ORDER[currentIdx + 1];
                    if (!nextStatus) return null;
                    return (
                      <Button
                        size="sm"
                        onClick={() => onStatusChange(lead.id, nextStatus)}
                        className="h-7 text-xs font-bold bg-terracotta hover:bg-terracotta/90 text-white gap-1.5 px-3 shadow-xs cursor-pointer rounded-full"
                      >
                        <span>Advance to {LEAD_STATUS_LABEL[nextStatus]}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    );
                  })()}
                </div>
              </div>
            </DialogHeader>

            <Tabs defaultValue="lifecycle" className="w-full">
              <div className="px-6 pt-3 border-b border-border/40">
                <TabsList className="grid grid-cols-2 h-9 w-full max-w-sm text-xs bg-muted/60 p-1">
                  <TabsTrigger value="lifecycle" className="text-xs gap-1.5">
                    <History className="h-3.5 w-3.5 text-terracotta" /> Complete Lifecycle
                  </TabsTrigger>
                  <TabsTrigger value="overview" className="text-xs gap-1.5">
                    <Info className="h-3.5 w-3.5" /> Overview & Location
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="lifecycle" className="px-6 py-4 m-0 space-y-4">
                <LeadLifecycleTimeline
                  lead={lead}
                  userId={userId}
                  creatorName={employeeName}
                  plotNumber={plotNumber}
                  projectName={projectName}
                  onStatusChange={onStatusChange}
                  onMapPlot={onMapPlot}
                />
              </TabsContent>

              <TabsContent value="overview" className="px-6 py-4 m-0 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat
                    label="Budget"
                    value={lead.budget ? `₹${Number(lead.budget).toLocaleString("en-IN")}` : "—"}
                    icon={IndianRupee}
                  />
                  <Stat label="Source" value={lead.source ?? "—"} />
                  <Stat
                    label="Meeting"
                    value={lead.meeting_date ? formatMeeting(lead.meeting_date) : "—"}
                    icon={Calendar}
                  />
                  <Stat
                    label="Plot"
                    value={plotNumber ? `${plotNumber}` : "Unassigned"}
                    icon={MapPin}
                    action={
                      canManage && onMapPlot ? (
                        <button
                          type="button"
                          onClick={() => onMapPlot(lead)}
                          className="text-[10px] font-semibold text-terracotta hover:underline ml-auto"
                        >
                          {plotNumber ? "Change" : "+ Map"}
                        </button>
                      ) : undefined
                    }
                  />
                </div>

                {lead.notes && (
                  <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                    <StickyNote className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <p className="leading-relaxed">{lead.notes}</p>
                  </div>
                )}

                {/* ---- Site map, mapped to the lead's project & plot ---- */}
                {lead.project_id && lead.plot_id && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" /> Site location
                      </p>
                      {canManage && onMapPlot && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onMapPlot(lead)}
                          className="h-6 text-[11px] text-terracotta hover:text-terracotta hover:bg-terracotta/10 px-2 gap-1 font-medium"
                        >
                          <Pencil className="h-3 w-3" /> Change Mapping
                        </Button>
                      )}
                    </div>
                    <MiniSiteMap
                      projectId={lead.project_id!}
                      plotId={lead.plot_id!}
                      projectName={projectName}
                    />
                  </div>
                )}
                {!lead.project_id && !lead.plot_id && (
                  <div className="pt-2">
                    <div className="rounded-xl border border-dashed border-terracotta/30 bg-terracotta/[0.03] p-5 text-center flex flex-col items-center justify-center">
                      <MapPinOff className="h-6 w-6 text-terracotta/70 mb-2" />
                      <p className="text-xs font-medium text-foreground">This lead is not yet mapped to a specific plot.</p>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                        Map this lead to a layout & plot to enable site mapping, layout tracking, and proof photo evidence.
                      </p>
                      {canManage && onMapPlot && (
                        <Button
                          size="sm"
                          onClick={() => onMapPlot(lead)}
                          className="mt-3 gap-1.5 bg-terracotta hover:bg-terracotta/90 text-white font-medium shadow-sm"
                        >
                          <MapPin className="h-3.5 w-3.5" /> Map to Plot
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                <SiteVisitProofPanel
                  lead={lead}
                  userId={userId}
                  canCapture={canCaptureVisit}
                  canReview={canReviewVisits}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  action,
}: {
  label: string;
  value: string;
  icon?: ComponentType<{ className?: string }>;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card px-3 py-2">
      <div className="flex items-center justify-between gap-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          {Icon && <Icon className="h-2.5 w-2.5" />}
          {label}
        </p>
        {action}
      </div>
      <p className="text-sm font-semibold mt-0.5 truncate">{value}</p>
    </div>
  );
}
