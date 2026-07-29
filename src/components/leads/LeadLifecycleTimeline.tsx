import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Phone,
  MessageCircle,
  Mail,
  Users,
  MapPin,
  Globe,
  Share2,
  Calendar,
  CheckCircle2,
  Clock,
  Send,
  Flag,
  Trophy,
  FileText,
  StickyNote,
  IndianRupee,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_ORDER,
  type LeadRow,
  type LeadStatus,
} from "@/components/site-mapper/types";
import { initials, tintFor } from "./leadUtils";

export type LeadActivity = {
  id: string;
  lead_id: string;
  activity_type: string;
  from_status?: string | null;
  to_status?: string | null;
  channel?: string | null;
  notes?: string | null;
  performed_by?: string | null;
  created_at: string;
  metadata?: any;
};

export const CONTACT_CHANNELS = [
  { id: "Phone Call", label: "Phone Call", icon: Phone },
  { id: "WhatsApp", label: "WhatsApp Message / Call", icon: MessageCircle },
  { id: "Email", label: "Email", icon: Mail },
  { id: "In-Person Meeting", label: "In-Person Meeting", icon: Users },
  { id: "Site Visit", label: "Site Visit", icon: MapPin },
  { id: "Web Inquiry", label: "Web Inquiry", icon: Globe },
  { id: "Referral", label: "Referral", icon: Share2 },
];

const CHANNEL_ICONS: Record<string, any> = {
  "Phone Call": Phone,
  WhatsApp: MessageCircle,
  Email: Mail,
  "In-Person Meeting": Users,
  "Site Visit": MapPin,
  "Web Inquiry": Globe,
  Referral: Share2,
};

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LeadLifecycleTimeline({
  lead,
  userId,
  creatorName,
  plotNumber,
  projectName,
  onStatusChange,
}: {
  lead: LeadRow;
  userId: string;
  creatorName?: string;
  plotNumber?: string;
  projectName?: string;
  onStatusChange?: (id: string, status: LeadStatus) => void;
}) {
  const qc = useQueryClient();

  // Conversion & Meeting Form State
  const [channel, setChannel] = useState<string>("Phone Call");
  const [conversionNotes, setConversionNotes] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [meetingDate, setMeetingDate] = useState<string>("");
  const [meetingLocation, setMeetingLocation] = useState<string>("");
  const [meetingNotes, setMeetingNotes] = useState<string>("");
  const [showConversionForm, setShowConversionForm] = useState<boolean>(
    lead.status === "new" || lead.status === "contacted"
  );
  const [showMeetingForm, setShowMeetingForm] = useState<boolean>(
    lead.status === "meeting_scheduled"
  );

  useEffect(() => {
    if (lead) {
      setChannel((lead as any).contacted_channel || "Phone Call");
      setConversionNotes((lead as any).contacted_notes || lead.notes || "");
      setBudget(lead.budget ? lead.budget.toString() : "");
      setMeetingDate(lead.meeting_date ? toLocalInput(lead.meeting_date) : "");
      setMeetingLocation(lead.meeting_location || "");
      if (lead.status === "new" || lead.status === "contacted") {
        setShowConversionForm(true);
      }
      if (lead.status === "meeting_scheduled") {
        setShowMeetingForm(true);
      }
    }
  }, [lead]);

  // Fetch audit log activities for this lead
  const { data: activities = [] } = useQuery({
    queryKey: ["lead-activities", lead.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lead_activities")
        .select("*, profiles:performed_by(full_name, email)")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as (LeadActivity & { profiles?: { full_name: string | null } })[];
    },
  });

  // Fetch profiles map for fallback performer rendering
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data ?? [];
    },
  });

  const profileMap = new Map(profiles.map((p) => [p.id, p.full_name]));

  // Interactive Stage Change Mutation when clicking pipeline circles
  const changeStageMutation = useMutation({
    mutationFn: async (newStatus: LeadStatus) => {
      const { error } = await (supabase as any)
        .from("plot_leads")
        .update({ status: newStatus })
        .eq("id", lead.id);
      if (error) throw error;

      await (supabase as any).from("lead_activities").insert({
        lead_id: lead.id,
        activity_type: "stage_change",
        from_status: lead.status,
        to_status: newStatus,
        performed_by: userId,
      });
    },
    onSuccess: (_data, newStatus) => {
      toast.success(`Stage updated to ${LEAD_STATUS_LABEL[newStatus]}`);
      if (onStatusChange) {
        onStatusChange(lead.id, newStatus);
      }
      qc.invalidateQueries({ queryKey: ["lead-activities", lead.id] });
      qc.invalidateQueries({ queryKey: ["all_plot_leads"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update stage"),
  });

  // Submit Conversion Details Inline Form
  const submitConversionMutation = useMutation({
    mutationFn: async () => {
      if (!conversionNotes.trim()) {
        throw new Error("Please enter details on how the lead was contacted.");
      }
      const updatePayload: any = {
        status: "contacted",
        contacted_at: new Date().toISOString(),
        contacted_channel: channel,
        contacted_notes: conversionNotes.trim(),
      };
      if (budget) updatePayload.budget = parseFloat(budget);
      if (meetingDate) updatePayload.meeting_date = new Date(meetingDate).toISOString();
      if (meetingLocation) updatePayload.meeting_location = meetingLocation.trim();

      const { error } = await (supabase as any).from("plot_leads").update(updatePayload).eq("id", lead.id);
      if (error) throw error;

      await (supabase as any).from("lead_activities").insert({
        lead_id: lead.id,
        activity_type: "contacted",
        from_status: lead.status,
        to_status: "contacted",
        channel,
        notes: conversionNotes.trim(),
        performed_by: userId,
      });
    },
    onSuccess: () => {
      toast.success("Details saved successfully!");
      qc.invalidateQueries({ queryKey: ["lead-activities", lead.id] });
      qc.invalidateQueries({ queryKey: ["all_plot_leads"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save details"),
  });

  // Submit Meeting Details Inline Form
  const submitMeetingMutation = useMutation({
    mutationFn: async () => {
      if (!meetingDate) {
        throw new Error("Please select a meeting date and time.");
      }
      if (!meetingLocation.trim()) {
        throw new Error("Please enter a meeting place / location.");
      }

      const updatePayload: any = {
        status: "meeting_scheduled",
        meeting_date: new Date(meetingDate).toISOString(),
        meeting_location: meetingLocation.trim(),
      };

      const { error } = await (supabase as any).from("plot_leads").update(updatePayload).eq("id", lead.id);
      if (error) throw error;

      await (supabase as any).from("lead_activities").insert({
        lead_id: lead.id,
        activity_type: "meeting_scheduled",
        from_status: lead.status,
        to_status: "meeting_scheduled",
        notes: `Scheduled Meeting at ${meetingLocation.trim()}${meetingNotes.trim() ? ` — Notes: ${meetingNotes.trim()}` : ""}`,
        performed_by: userId,
      });
    },
    onSuccess: () => {
      toast.success("Meeting details saved & stage updated to Meeting Scheduled!");
      if (onStatusChange) {
        onStatusChange(lead.id, "meeting_scheduled");
      }
      qc.invalidateQueries({ queryKey: ["lead-activities", lead.id] });
      qc.invalidateQueries({ queryKey: ["all_plot_leads"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to schedule meeting"),
  });

  // Determine stage progression index
  const currentStageIndex = LEAD_STATUS_ORDER.indexOf(lead.status as LeadStatus);

  // Combine DB activities with synthetic events if activities is empty
  const timelineEvents: Array<{
    id: string;
    title: string;
    type: string;
    timestamp: string;
    performer?: string;
    channel?: string;
    notes?: string;
    icon: any;
    badgeColor?: string;
  }> = [];

  // 1. Always include Creation / Origin event
  timelineEvents.push({
    id: `origin-${lead.id}`,
    title: "Lead Created in System",
    type: "created",
    timestamp: lead.created_at,
    performer: creatorName ?? (lead.created_by ? profileMap.get(lead.created_by) : null) ?? "Sales Staff",
    notes: `Source: ${lead.source ?? "Direct Inquiry"}${
      lead.budget ? ` · Budget: ₹${Number(lead.budget).toLocaleString("en-IN")}` : ""
    }${projectName ? ` · Project: ${projectName}` : ""}${plotNumber ? ` · Plot: ${plotNumber}` : ""}`,
    icon: Flag,
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  });

  // 2. Include Contacted event if present in lead row or DB activities
  const leadContactedAt = (lead as any).contacted_at;
  const leadContactedChannel = (lead as any).contacted_channel;
  const leadContactedNotes = (lead as any).contacted_notes;

  if (leadContactedNotes || leadContactedChannel) {
    const ChannelIcon = (leadContactedChannel && CHANNEL_ICONS[leadContactedChannel]) || Phone;
    timelineEvents.push({
      id: `contacted-${lead.id}`,
      title: `Contact Established via ${leadContactedChannel ?? "Direct Channel"}`,
      type: "contacted",
      timestamp: leadContactedAt || lead.updated_at,
      channel: leadContactedChannel,
      notes: leadContactedNotes,
      icon: ChannelIcon,
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    });
  }

  // 3. Include scheduled meeting if present
  if (lead.meeting_date) {
    timelineEvents.push({
      id: `meeting-${lead.id}`,
      title: "Site Visit / Meeting Scheduled",
      type: "meeting_scheduled",
      timestamp: lead.meeting_date,
      notes: lead.meeting_location ? `Location: ${lead.meeting_location}` : "Scheduled meeting with customer",
      icon: Calendar,
      badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    });
  }

  // 4. Append DB recorded activities
  activities.forEach((act) => {
    const performer = act.profiles?.full_name ?? profileMap.get(act.performed_by ?? "") ?? "Team Member";
    let icon = MapPin;
    let title = "Touchpoint Note";
    let badgeColor = "bg-muted text-foreground border-border";

    if (act.activity_type === "contacted" || act.to_status === "contacted") {
      icon = Phone;
      title = `Stage Updated to Contacted (${act.channel ?? "Direct"})`;
      badgeColor = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    } else if (act.activity_type === "stage_change") {
      icon = CheckCircle2;
      title = `Stage Changed: ${LEAD_STATUS_LABEL[act.from_status as LeadStatus] ?? act.from_status} → ${
        LEAD_STATUS_LABEL[act.to_status as LeadStatus] ?? act.to_status
      }`;
      badgeColor = "bg-terracotta/10 text-terracotta border-terracotta/20";
    } else if (act.activity_type === "converted" || act.to_status === "converted") {
      icon = Trophy;
      title = "Lead Converted into Booking! 🎉";
      badgeColor = "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    }

    timelineEvents.push({
      id: act.id,
      title,
      type: act.activity_type,
      timestamp: act.created_at,
      performer,
      channel: act.channel ?? undefined,
      notes: act.notes ?? undefined,
      icon,
      badgeColor,
    });
  });

  // Sort events by timestamp
  timelineEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="space-y-6 pt-2">
      {/* ---- Stage Pipeline Funnel Bar ---- */}
      <div className="rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-terracotta" /> Stage Lifecycle Pipeline
          </p>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-terracotta/10 text-terracotta border-terracotta/30 capitalize">
            Current: {LEAD_STATUS_LABEL[lead.status]}
          </span>
        </div>

        {/* Pipeline steps - Clickable circles to update status */}
        <div className="grid grid-cols-5 gap-1 relative">
          {LEAD_STATUS_ORDER.slice(0, 5).map((st, idx) => {
            const isCompleted = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;

            return (
              <div
                key={st}
                onClick={() => {
                  if (st === "contacted") {
                    setShowConversionForm(true);
                    toast.info("Please fill out contact channel & notes below, then click Save to update stage.");
                    return;
                  }
                  if (st === "meeting_scheduled") {
                    setShowMeetingForm(true);
                    toast.info("Please enter meeting date & place below, then click Save to update stage.");
                    return;
                  }
                  if (st !== lead.status) {
                    changeStageMutation.mutate(st);
                  }
                }}
                className="flex flex-col items-center text-center group cursor-pointer"
                title={`Click to set status to ${LEAD_STATUS_LABEL[st]}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border shadow-2xs group-hover:scale-110 active:scale-95 ${
                    isCurrent
                      ? "bg-terracotta text-white border-terracotta ring-4 ring-terracotta/20 scale-105"
                      : isCompleted
                      ? "bg-emerald-500 text-white border-emerald-500 hover:ring-2 hover:ring-emerald-500/30"
                      : "bg-muted text-muted-foreground border-border hover:border-terracotta/60 hover:bg-terracotta/10 hover:text-terracotta"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-4.5 w-4.5" /> : idx + 1}
                </div>
                <span
                  className={`text-[10px] font-medium mt-1.5 capitalize line-clamp-1 group-hover:text-terracotta transition-colors ${
                    isCurrent
                      ? "text-terracotta font-bold"
                      : isCompleted
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  {LEAD_STATUS_LABEL[st]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Single Lead Conversion Details Form ---- */}
      <div className="rounded-xl border border-terracotta/30 bg-terracotta/[0.02] p-4 shadow-2xs space-y-3">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setShowConversionForm(!showConversionForm)}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-terracotta" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Contact & Conversion Details
            </h3>
            {lead.status === "contacted" && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
                Contact Recorded
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground">
            {showConversionForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {showConversionForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitConversionMutation.mutate();
            }}
            className="space-y-3.5 pt-2 border-t border-border/40"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Contact Method / Channel <span className="text-destructive">*</span>
              </Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="h-9 text-xs bg-card">
                  <SelectValue placeholder="Select contact channel" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_CHANNELS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SelectItem key={item.id} value={item.id} className="text-xs">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{item.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                How was this lead contacted & converted? <span className="text-destructive">*</span>
              </Label>
              <Textarea
                rows={3}
                required
                value={conversionNotes}
                onChange={(e) => setConversionNotes(e.target.value)}
                placeholder="Record conversation outcome, customer interest, plot requirements, or next steps..."
                className="text-xs resize-none bg-card"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground flex items-center gap-1">
                  <IndianRupee className="h-3 w-3 text-muted-foreground" /> Customer Budget
                </Label>
                <Input
                  type="number"
                  placeholder="e.g. 2500000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="h-9 text-xs bg-card"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" /> Follow-up Date
                </Label>
                <Input
                  type="datetime-local"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="h-9 text-xs bg-card"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" /> Meeting / Visit Location
              </Label>
              <Input
                type="text"
                placeholder="e.g. Site Office / Customer Residence"
                value={meetingLocation}
                onChange={(e) => setMeetingLocation(e.target.value)}
                className="h-9 text-xs bg-card"
              />
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={submitConversionMutation.isPending}
              className="w-full bg-terracotta hover:bg-terracotta/90 text-white font-medium gap-1.5 h-9 shadow-2xs"
            >
              <CheckCircle2 className="h-4 w-4" /> Save Contact & Conversion Details
            </Button>
          </form>
        )}
      </div>

      {/* ---- Schedule Meeting & Site Visit Details Form ---- */}
      <div className="rounded-xl border border-purple-500/30 bg-purple-500/[0.03] p-4 shadow-2xs space-y-3">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setShowMeetingForm(!showMeetingForm)}
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Schedule Meeting & Site Visit Details
            </h3>
            {lead.meeting_date && (
              <span className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold px-2 py-0.5 rounded-full border border-purple-500/20">
                Meeting Set
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground">
            {showMeetingForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {showMeetingForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitMeetingMutation.mutate();
            }}
            className="space-y-3.5 pt-2 border-t border-border/40"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-purple-600" /> Meeting Date & Time <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="datetime-local"
                  required
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="h-9 text-xs bg-card"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-purple-600" /> Meeting Place / Location <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. Site Office / Customer Home / Plot Site"
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  className="h-9 text-xs bg-card"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Meeting Agenda & Discussion Notes
              </Label>
              <Textarea
                rows={2}
                value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
                placeholder="e.g. Site walkthrough for plot #21 and payment plan discussion with family..."
                className="text-xs resize-none bg-card"
              />
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={submitMeetingMutation.isPending}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium gap-1.5 h-9 shadow-2xs cursor-pointer"
            >
              <Calendar className="h-4 w-4" /> Save Meeting Details & Update Stage to Meeting Scheduled
            </Button>
          </form>
        )}
      </div>

      {/* ---- Chronological Timeline ---- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Full Lifecycle Audit Trail
          </h4>
          <span className="text-[11px] text-muted-foreground">
            {timelineEvents.length} touchpoint{timelineEvents.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
          {timelineEvents.map((evt) => {
            const Icon = evt.icon;
            const formattedTime = new Date(evt.timestamp).toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });

            return (
              <div key={evt.id} className="relative group">
                {/* Connector Dot */}
                <div className="absolute -left-6 top-1 rounded-full p-1 bg-background border border-border group-hover:border-terracotta transition-colors shadow-2xs">
                  <Icon className="h-3 w-3 text-terracotta" />
                </div>

                <div className="rounded-lg border bg-card/60 hover:bg-card p-3 shadow-2xs transition-all space-y-1.5">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{evt.title}</span>
                      {evt.channel && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-muted/60 text-muted-foreground">
                          {evt.channel}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formattedTime}</span>
                  </div>

                  {evt.notes && (
                    <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 p-2 rounded-md border border-border/40 whitespace-pre-wrap">
                      {evt.notes}
                    </p>
                  )}

                  {evt.performer && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-0.5">
                      <Avatar className="h-4 w-4">
                        <AvatarFallback className={`text-[8px] ${tintFor(evt.performer)}`}>
                          {initials(evt.performer)}
                        </AvatarFallback>
                      </Avatar>
                      <span>Action by <strong>{evt.performer}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
