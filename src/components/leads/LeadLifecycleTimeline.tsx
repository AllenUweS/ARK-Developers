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
  Flag,
  Trophy,
  StickyNote,
  IndianRupee,
  ChevronDown,
  ChevronUp,
  Eye,
  Pencil,
  Video,
  Sparkle,
  PartyPopper,
  RotateCcw,
  Handshake,
  ShieldCheck,
  Zap,
  Tag,
  Percent,
  ExternalLink,
  Ban,
  AlertTriangle,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_ORDER,
  type LeadRow,
  type LeadStatus,
} from "@/components/site-mapper/types";
import { initials, tintFor, isAllowedStageTransition } from "./leadUtils";

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

// Meeting type labels and icons for display
const MEETING_TYPES: Record<string, { label: string; icon: any; color: string }> = {
  in_person: { label: "In-Person Meeting", icon: Users, color: "text-blue-600" },
  virtual_call: { label: "Virtual Call", icon: Video, color: "text-purple-600" },
  site_visit: { label: "Site Visit", icon: MapPin, color: "text-emerald-600" },
  phone_call: { label: "Phone Call", icon: Phone, color: "text-amber-600" },
  hybrid: { label: "Hybrid Meeting", icon: Sparkle, color: "text-indigo-600" },
};

export const PAYMENT_PLANS: Record<string, { label: string; description: string }> = {
  bank_loan: { label: "Bank Loan (80%) + Self Advance (20%)", description: "Standard home/plot loan arrangement" },
  full_payment: { label: "100% Full Self-Funded Payment", description: "Direct lump sum payment" },
  installment_plan: { label: "Custom Installment Plan", description: "Milestone-based stage payments" },
  token_advance: { label: "Token Advance Booking", description: "Initial token booking amount" },
};

function getMeetingTypeLabel(type: string): string {
  return MEETING_TYPES[type]?.label || "Meeting";
}

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
  onMapPlot,
}: {
  lead: LeadRow;
  userId: string;
  creatorName?: string;
  plotNumber?: string;
  projectName?: string;
  onStatusChange?: (id: string, status: LeadStatus) => void;
  onMapPlot?: (lead: LeadRow) => void;
}) {
  const qc = useQueryClient();

  // Conversion, Meeting & Negotiation Form State
  const [channel, setChannel] = useState<string>("Phone Call");
  const [conversionNotes, setConversionNotes] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [meetingDate, setMeetingDate] = useState<string>("");
  const [meetingLocation, setMeetingLocation] = useState<string>("");
  const [meetingNotes, setMeetingNotes] = useState<string>("");
  const [meetingType, setMeetingType] = useState<string>("in_person");
  const [meetingAttendees, setMeetingAttendees] = useState<string>("");

  const [negotiatedPrice, setNegotiatedPrice] = useState<string>("");
  const [paymentPlan, setPaymentPlan] = useState<string>("bank_loan");
  const [discountOffered, setDiscountOffered] = useState<string>("");
  const [negotiationNotes, setNegotiationNotes] = useState<string>("");
  const [selectedPlotToMap, setSelectedPlotToMap] = useState<string>("");

  // Drop Lead form state
  const [showDropForm, setShowDropForm] = useState<boolean>(false);
  const [dropReason, setDropReason] = useState<string>("");
  const [dropNotes, setDropNotes] = useState<string>("");

  // Fetch mapped plot details if lead.plot_id exists
  const { data: mappedPlot } = useQuery({
    queryKey: ["mapped_plot_details", lead.plot_id],
    enabled: !!lead.plot_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("plots")
        .select("id, plot_number, area_sqft, price, status, project_id, projects(name)")
        .eq("id", lead.plot_id!)
        .maybeSingle();
      return data;
    },
  });

  // Fetch available plots for inline mapping if lead is not mapped
  const { data: availablePlots = [] } = useQuery({
    queryKey: ["available_plots_for_mapping"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plots")
        .select("id, plot_number, area_sqft, price, status, project_id, projects(name)")
        .order("plot_number");
      return data ?? [];
    },
  });

  const mapPlotMutation = useMutation({
    mutationFn: async (selectedPlotId: string) => {
      const targetPlot = availablePlots.find((p) => p.id === selectedPlotId);
      const { error } = await (supabase as any)
        .from("plot_leads")
        .update({ plot_id: selectedPlotId })
        .eq("id", lead.id);
      if (error) throw error;

      await (supabase as any).from("lead_activities").insert({
        lead_id: lead.id,
        activity_type: "plot_mapped",
        notes: `Mapped to Plot #${targetPlot?.plot_number ?? "Selected Plot"}${targetPlot?.projects?.name ? ` in ${targetPlot.projects.name}` : ""}`,
        performed_by: userId,
      });
    },
    onSuccess: () => {
      toast.success("🎯 Lead successfully mapped to site!");
      qc.invalidateQueries({ queryKey: ["all_plot_leads"] });
      qc.invalidateQueries({ queryKey: ["plot-leads"] });
      qc.invalidateQueries({ queryKey: ["mapped_plot_details", lead.plot_id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to map plot"),
  });

  // Fetch drop details if lead is dropped
  const { data: dropRecord } = useQuery({
    queryKey: ["lead_drop_details", lead.id],
    enabled: lead.status === "dropped",
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("lead_drop_reasons")
        .select("*, profiles:dropped_by(full_name)")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const [showConversionForm, setShowConversionForm] = useState<boolean>(lead.status === "new");
  const [showMeetingForm, setShowMeetingForm] = useState<boolean>(lead.status === "contacted");
  const [showNegotiationForm, setShowNegotiationForm] = useState<boolean>(lead.status === "meeting_scheduled");

  const [isPreviewingConversion, setIsPreviewingConversion] = useState<boolean>(false);
  const [isPreviewingMeeting, setIsPreviewingMeeting] = useState<boolean>(false);
  const [isPreviewingNegotiation, setIsPreviewingNegotiation] = useState<boolean>(false);

  const [centerModalData, setCenterModalData] = useState<{
    leadName: string;
    fromStage: string;
    toStage: string;
    notes?: string;
    channel?: string;
    isDrop?: boolean;
  } | null>(null);

  useEffect(() => {
    if (lead) {
      setChannel((lead as any).contacted_channel || "Phone Call");
      setConversionNotes((lead as any).contacted_notes || lead.notes || "");
      setBudget(lead.budget ? lead.budget.toString() : "");
      setMeetingDate(lead.meeting_date ? toLocalInput(lead.meeting_date) : "");
      setMeetingLocation(lead.meeting_location || "");
      setMeetingType((lead as any).meeting_type || "in_person");
      setMeetingNotes((lead as any).meeting_notes || "");
      setMeetingAttendees((lead as any).meeting_attendees || "");
      setNegotiatedPrice((lead as any).negotiated_price ? (lead as any).negotiated_price.toString() : lead.budget ? lead.budget.toString() : "");
      setPaymentPlan((lead as any).payment_plan || "bank_loan");
      setDiscountOffered((lead as any).discount_offered || "");
      setNegotiationNotes((lead as any).negotiation_notes || "");

      setShowConversionForm(lead.status === "new");
      setShowMeetingForm(lead.status === "contacted");
      setShowNegotiationForm(lead.status === "meeting_scheduled");
    }
  }, [lead.id, lead.status]);

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

  // Direct Stage Change Mutation
  const changeStageMutation = useMutation({
    mutationFn: async ({ newStatus }: { newStatus: LeadStatus }) => {
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
    onSuccess: (_data, { newStatus }) => {
      setCenterModalData({
        leadName: lead.name,
        fromStage: LEAD_STATUS_LABEL[lead.status] || lead.status,
        toStage: LEAD_STATUS_LABEL[newStatus] || newStatus,
      });
      if (onStatusChange) {
        onStatusChange(lead.id, newStatus);
      }
      qc.invalidateQueries({ queryKey: ["lead-activities", lead.id] });
      qc.invalidateQueries({ queryKey: ["all_plot_leads"] });
      qc.invalidateQueries({ queryKey: ["plot-leads"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update stage"),
  });

  // Drop Lead Mutation
  const dropLeadMutation = useMutation({
    mutationFn: async () => {
      if (!dropReason) throw new Error("Please select a reason for dropping this lead.");

      const { error } = await (supabase as any)
        .from("plot_leads")
        .update({ status: "dropped" })
        .eq("id", lead.id);
      if (error) throw error;

      // Insert audit activity
      await (supabase as any).from("lead_activities").insert({
        lead_id: lead.id,
        activity_type: "lead_dropped",
        from_status: lead.status,
        to_status: "dropped",
        performed_by: userId,
        notes: `🚫 Lead Dropped — Reason: ${dropReason}${dropNotes ? `\nNotes: ${dropNotes}` : ""}`,
        metadata: { drop_reason: dropReason, drop_notes: dropNotes || null, dropped_from_stage: lead.status },
      });

      // Insert into lead_drop_reasons table
      try {
        await (supabase as any).from("lead_drop_reasons").insert({
          lead_id: lead.id,
          dropped_from_stage: lead.status,
          reason: dropReason,
          reason_label: dropReason,
          notes: dropNotes || null,
          dropped_by: userId,
        });
      } catch (err) {
        console.warn("Could not insert into lead_drop_reasons table:", err);
      }
    },
    onSuccess: () => {
      setCenterModalData({
        leadName: lead.name,
        fromStage: LEAD_STATUS_LABEL[lead.status] || lead.status,
        toStage: "Dropped",
        isDrop: true,
      });
      setShowDropForm(false);
      setDropReason("");
      setDropNotes("");
      if (onStatusChange) {
        onStatusChange(lead.id, "dropped");
      }
      qc.invalidateQueries({ queryKey: ["lead-activities", lead.id] });
      qc.invalidateQueries({ queryKey: ["lead_drop_details", lead.id] });
      qc.invalidateQueries({ queryKey: ["all_plot_leads"] });
      qc.invalidateQueries({ queryKey: ["plot-leads"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to drop lead"),
  });

  // Submit Conversion Details (Step 1 -> Step 2 Contacted)
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
      setShowConversionForm(false);
      setIsPreviewingConversion(false);
      setCenterModalData({
        leadName: lead.name,
        fromStage: LEAD_STATUS_LABEL[lead.status] || lead.status,
        toStage: "Contacted",
        notes: conversionNotes.trim(),
        channel,
      });
      if (onStatusChange) {
        onStatusChange(lead.id, "contacted");
      }
      qc.invalidateQueries({ queryKey: ["lead-activities", lead.id] });
      qc.invalidateQueries({ queryKey: ["all_plot_leads"] });
      qc.invalidateQueries({ queryKey: ["plot-leads"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save details"),
  });

  // Submit Meeting Details (Step 2 -> Step 3 Meeting Scheduled)
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
        meeting_type: meetingType,
        meeting_notes: meetingNotes.trim() || null,
        meeting_attendees: meetingAttendees.trim() || null,
        updated_by: userId,
      };

      const { error } = await (supabase as any).from("plot_leads").update(updatePayload).eq("id", lead.id);
      if (error) throw error;

      await (supabase as any).from("lead_activities").insert({
        lead_id: lead.id,
        activity_type: "meeting_scheduled",
        from_status: lead.status,
        to_status: "meeting_scheduled",
        notes: `📅 Meeting Date & Time: ${new Date(meetingDate).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}\n📍 Meeting Place / Location: ${meetingLocation.trim()}\n🏷️ Type: ${getMeetingTypeLabel(meetingType)}${meetingAttendees.trim() ? `\n👥 Attendees: ${meetingAttendees.trim()}` : ""}${meetingNotes.trim() ? `\n📝 Agenda: "${meetingNotes.trim()}"` : ""}`,
        performed_by: userId,
      });
    },
    onSuccess: () => {
      setShowMeetingForm(false);
      setIsPreviewingMeeting(false);
      setCenterModalData({
        leadName: lead.name,
        fromStage: LEAD_STATUS_LABEL[lead.status] || lead.status,
        toStage: "Meeting Scheduled",
        notes: `📅 Meeting Date & Time: ${meetingDate ? new Date(meetingDate).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "N/A"}\n📍 Location: ${meetingLocation}\n🏷️ Type: ${getMeetingTypeLabel(meetingType)}${meetingNotes.trim() ? `\n📝 Agenda: "${meetingNotes.trim()}"` : ""}`,
      });
      if (onStatusChange) {
        onStatusChange(lead.id, "meeting_scheduled");
      }
      qc.invalidateQueries({ queryKey: ["lead-activities", lead.id] });
      qc.invalidateQueries({ queryKey: ["all_plot_leads"] });
      qc.invalidateQueries({ queryKey: ["plot-leads"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to schedule meeting"),
  });

  // Submit Negotiation Details (Step 3 -> Step 4 Negotiating)
  const submitNegotiationMutation = useMutation({
    mutationFn: async () => {
      if (!negotiatedPrice) {
        throw new Error("Please enter the offered / negotiated price.");
      }

      const priceVal = parseFloat(negotiatedPrice);
      const updatePayload: any = {
        status: "negotiating",
        budget: priceVal,
        negotiated_price: priceVal,
        payment_plan: paymentPlan,
        discount_offered: discountOffered.trim() || null,
        negotiation_notes: negotiationNotes.trim() || null,
        updated_by: userId,
      };

      const { error } = await (supabase as any).from("plot_leads").update(updatePayload).eq("id", lead.id);
      if (error) throw error;

      const planLabel = PAYMENT_PLANS[paymentPlan]?.label || "Standard Terms";
      let summary = `💰 Offered / Negotiated Price: ₹${priceVal.toLocaleString("en-IN")}\n📜 Payment Structure: ${planLabel}`;
      if (discountOffered.trim()) summary += `\n🎁 Discount / Offer: ${discountOffered.trim()}`;
      if (negotiationNotes.trim()) summary += `\n📝 Negotiation Terms: "${negotiationNotes.trim()}"`;

      await (supabase as any).from("lead_activities").insert({
        lead_id: lead.id,
        activity_type: "negotiating",
        from_status: lead.status,
        to_status: "negotiating",
        notes: summary,
        performed_by: userId,
      });
    },
    onSuccess: () => {
      setShowNegotiationForm(false);
      setIsPreviewingNegotiation(false);
      setCenterModalData({
        leadName: lead.name,
        fromStage: LEAD_STATUS_LABEL[lead.status] || lead.status,
        toStage: "Negotiating",
        notes: `💰 Price: ₹${Number(negotiatedPrice).toLocaleString("en-IN")}\n📜 Plan: ${PAYMENT_PLANS[paymentPlan]?.label || paymentPlan}${discountOffered ? `\n🎁 Discount: ${discountOffered}` : ""}`,
      });
      if (onStatusChange) {
        onStatusChange(lead.id, "negotiating");
      }
      qc.invalidateQueries({ queryKey: ["lead-activities", lead.id] });
      qc.invalidateQueries({ queryKey: ["all_plot_leads"] });
      qc.invalidateQueries({ queryKey: ["plot-leads"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save negotiation details"),
  });

  // Find drop activity from audit trail as fallback if dropRecord is loading or unavailable
  const dropActivity = activities.find(
    (a) => a.activity_type === "lead_dropped" || a.to_status === "dropped"
  );

  const effectiveDroppedFromStage: LeadStatus =
    (dropRecord?.dropped_from_stage as LeadStatus) ||
    (dropActivity?.from_status as LeadStatus) ||
    (dropActivity?.metadata?.dropped_from_stage as LeadStatus) ||
    "new";

  const isLeadDropped = lead.status === "dropped";
  const currentStageIndex = isLeadDropped
    ? LEAD_STATUS_ORDER.indexOf(effectiveDroppedFromStage)
    : LEAD_STATUS_ORDER.indexOf(lead.status as LeadStatus);

  const dropReasonText =
    dropRecord?.reason_label ||
    dropRecord?.reason ||
    dropActivity?.metadata?.drop_reason ||
    (dropActivity?.notes ? dropActivity.notes.split("— Reason:")[1]?.split("\n")[0]?.trim() : null) ||
    "Specified by agent during drop";

  const dropNotesText =
    dropRecord?.notes ||
    dropActivity?.metadata?.drop_notes ||
    (dropActivity?.notes && dropActivity.notes.includes("Notes:") ? dropActivity.notes.split("Notes:")[1]?.trim() : null);

  const droppedByName =
    dropRecord?.profiles?.full_name ||
    dropActivity?.profiles?.full_name ||
    profileMap.get(dropActivity?.performed_by ?? "") ||
    null;

  const droppedAtTime = dropRecord?.created_at || dropActivity?.created_at || null;

  // Combine DB activities with synthetic events
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

  timelineEvents.push({
    id: `origin-${lead.id}`,
    title: "Step 1: Lead Created in System",
    type: "created",
    timestamp: lead.created_at,
    performer: creatorName ?? (lead.created_by ? profileMap.get(lead.created_by) : null) ?? "Sales Staff",
    notes: `Source: ${lead.source ?? "Direct Inquiry"}${
      lead.budget ? ` · Budget: ₹${Number(lead.budget).toLocaleString("en-IN")}` : ""
    }${projectName ? ` · Project: ${projectName}` : ""}${plotNumber ? ` · Plot: ${plotNumber}` : ""}`,
    icon: Flag,
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  });

  const leadContactedAt = (lead as any).contacted_at;
  const leadContactedChannel = (lead as any).contacted_channel;
  const leadContactedNotes = (lead as any).contacted_notes;
  const hasDbContacted = activities.some((a) => a.activity_type === "contacted" || a.to_status === "contacted");

  if ((leadContactedNotes || leadContactedChannel || lead.status === "contacted") && !hasDbContacted) {
    const ChannelIcon = (leadContactedChannel && CHANNEL_ICONS[leadContactedChannel]) || Phone;
    let fullNotes = leadContactedNotes || "Contact established with customer.";
    if (lead.meeting_date && lead.status === "contacted") {
      fullNotes += `\n📅 Follow-up Scheduled: ${new Date(lead.meeting_date).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}${lead.meeting_location ? ` at ${lead.meeting_location}` : ""}`;
    }

    timelineEvents.push({
      id: `contacted-${lead.id}`,
      title: `Step 2: Contact Established via ${leadContactedChannel ?? "Direct Channel"}`,
      type: "contacted",
      timestamp: leadContactedAt || lead.updated_at,
      channel: leadContactedChannel,
      notes: fullNotes,
      icon: ChannelIcon,
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    });
  }

  const hasDbMeeting = activities.some((a) => a.activity_type === "meeting_scheduled" || a.to_status === "meeting_scheduled");
  const isAtOrPastMeetingStage = LEAD_STATUS_ORDER.indexOf(lead.status as LeadStatus) >= LEAD_STATUS_ORDER.indexOf("meeting_scheduled");

  if (isAtOrPastMeetingStage && lead.meeting_date && !hasDbMeeting) {
    const meetingDateStr = new Date(lead.meeting_date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const meetingTypeStr = getMeetingTypeLabel((lead as any).meeting_type);
    const notesStr = (lead as any).meeting_notes;
    const attendeesStr = (lead as any).meeting_attendees;

    let meetingSummary = `📅 Meeting Date & Time: ${meetingDateStr}\n📍 Meeting Place / Location: ${lead.meeting_location || "Not specified"}\n🏷️ Type: ${meetingTypeStr}`;
    if (attendeesStr) meetingSummary += `\n👥 Attendees: ${attendeesStr}`;
    if (notesStr) meetingSummary += `\n📝 Agenda: "${notesStr}"`;

    timelineEvents.push({
      id: `meeting-${lead.id}`,
      title: "Step 3: Site Visit / Meeting Scheduled",
      type: "meeting_scheduled",
      timestamp: lead.meeting_date,
      notes: meetingSummary,
      icon: Calendar,
      badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    });
  }

  const hasDbNegotiating = activities.some((a) => a.activity_type === "negotiating" || a.to_status === "negotiating");
  const isAtOrPastNegotiatingStage = LEAD_STATUS_ORDER.indexOf(lead.status as LeadStatus) >= LEAD_STATUS_ORDER.indexOf("negotiating");

  if (isAtOrPastNegotiatingStage && !hasDbNegotiating) {
    const priceVal = (lead as any).negotiated_price || lead.budget;
    const planVal = (lead as any).payment_plan;
    const discountVal = (lead as any).discount_offered;
    const notesVal = (lead as any).negotiation_notes;

    let summary = `💰 Offered Price: ${priceVal ? `₹${Number(priceVal).toLocaleString("en-IN")}` : "Under Negotiation"}`;
    if (planVal) summary += `\n📜 Payment Plan: ${PAYMENT_PLANS[planVal]?.label || planVal}`;
    if (discountVal) summary += `\n🎁 Discount / Offer: ${discountVal}`;
    if (notesVal) summary += `\n📝 Negotiation Terms: "${notesVal}"`;

    timelineEvents.push({
      id: `negotiating-${lead.id}`,
      title: "Step 4: Price & Terms Negotiation Started",
      type: "negotiating",
      timestamp: lead.updated_at ?? lead.created_at,
      notes: summary,
      icon: Handshake,
      badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    });
  }

  activities.forEach((act) => {
    const performer = act.profiles?.full_name ?? profileMap.get(act.performed_by ?? "") ?? "Team Member";
    let icon = MapPin;
    let title = "Touchpoint Note";
    let badgeColor = "bg-muted text-foreground border-border";

    if (act.activity_type === "stage_reverted") {
      icon = RotateCcw;
      title = `↩ Stage Reverted: ${LEAD_STATUS_LABEL[act.from_status as LeadStatus] ?? act.from_status} → ${LEAD_STATUS_LABEL[act.to_status as LeadStatus] ?? act.to_status}`;
      badgeColor = "bg-rose-500/10 text-rose-600 border-rose-500/20";
    } else if (act.activity_type === "contacted" || act.to_status === "contacted") {
      icon = Phone;
      title = `Step 2: Contacted (${act.channel ?? "Direct"})`;
      badgeColor = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    } else if (act.activity_type === "meeting_scheduled" || act.to_status === "meeting_scheduled") {
      icon = Calendar;
      title = "Step 3: Site Visit / Meeting Scheduled";
      badgeColor = "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
    } else if (act.activity_type === "negotiating" || act.to_status === "negotiating") {
      icon = Handshake;
      title = "Step 4: Price & Terms Negotiation Recorded";
      badgeColor = "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
    } else if (act.activity_type === "stage_change") {
      icon = CheckCircle2;
      title = `Stage Changed: ${LEAD_STATUS_LABEL[act.from_status as LeadStatus] ?? act.from_status} → ${
        LEAD_STATUS_LABEL[act.to_status as LeadStatus] ?? act.to_status
      }`;
      badgeColor = "bg-terracotta/10 text-terracotta border-terracotta/20";
    } else if (act.activity_type === "converted" || act.to_status === "converted") {
      icon = Trophy;
      title = "Step 5: Lead Converted into Booking! 🎉";
      badgeColor = "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    } else if (act.activity_type === "lead_dropped" || act.to_status === "dropped") {
      icon = Ban;
      title = `🚫 Lead Dropped from ${LEAD_STATUS_LABEL[act.from_status as LeadStatus] ?? act.from_status}`;
      badgeColor = "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
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

  const getStageRank = (evt: { type: string; title: string }): number => {
    const typeLower = (evt.type || "").toLowerCase();
    const titleLower = (evt.title || "").toLowerCase();
    if (typeLower === "created" || typeLower === "origin" || titleLower.includes("step 1")) return 1;
    if (typeLower === "contacted" || titleLower.includes("step 2")) return 2;
    if (typeLower === "meeting_scheduled" || titleLower.includes("step 3")) return 3;
    if (typeLower === "negotiating" || titleLower.includes("step 4")) return 4;
    if (typeLower === "converted" || titleLower.includes("step 5")) return 5;
    if (typeLower === "lead_dropped" || titleLower.includes("dropped")) return 6;
    if (typeLower === "plot_mapped") return 2.5;
    if (typeLower === "stage_reverted") return 1.5;
    return 3.5;
  };

  timelineEvents.sort((a, b) => {
    const rankA = getStageRank(a);
    const rankB = getStageRank(b);
    if (rankA !== rankB) {
      return rankB - rankA; // Recent / higher steps come first (5, 4, 3, 2, 1)
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(); // Newest timestamp first
  });

  return (
    <div className="space-y-6 pt-2">
      {/* ---- Stage Pipeline Funnel Bar with 1 to 5 Stepper Rules ---- */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-terracotta" /> Lead Cycle Pipeline (Step 1 → Step 5)
          </p>

          <div className="flex items-center gap-2">
            {/* Drop Lead button - available at any stage except converted/dropped */}
            {lead.status !== "converted" && lead.status !== "dropped" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDropForm(!showDropForm)}
                className="h-7 text-[10px] font-bold border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400 gap-1 px-2.5 cursor-pointer"
              >
                <Ban className="h-3 w-3" /> Drop Lead
              </Button>
            )}

            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border capitalize ${lead.status === "dropped" ? "bg-red-500/10 text-red-600 border-red-500/30" : "bg-terracotta/10 text-terracotta border-terracotta/30"}`}>
              {lead.status === "dropped" ? `Dropped at Step ${currentStageIndex + 1}: ${LEAD_STATUS_LABEL[effectiveDroppedFromStage]}` : `Step ${currentStageIndex + 1}: ${LEAD_STATUS_LABEL[lead.status]}`}
            </span>
          </div>
        </div>

        {/* Pipeline steps (1 to 5) - Enforcing step-by-step cycle without skipping */}
        <div className="grid grid-cols-5 gap-1.5 relative pt-1">
          {LEAD_STATUS_ORDER.slice(0, 5).map((st, idx) => {
            const isCompleted = idx < currentStageIndex;
            const isCurrent = !isLeadDropped && idx === currentStageIndex;
            const isDroppedStep = isLeadDropped && idx === currentStageIndex;
            const isNextStage = !isLeadDropped && idx === currentStageIndex + 1;

            return (
              <div
                key={st}
                onClick={() => {
                  if (isLeadDropped) {
                    toast.info(`🚫 This lead was dropped at Step ${currentStageIndex + 1} (${LEAD_STATUS_LABEL[effectiveDroppedFromStage]}).`);
                    return;
                  }

                  // Completed steps are view-only (no reverting)
                  if (idx < currentStageIndex) {
                    toast.info(`✅ Step ${idx + 1} (${LEAD_STATUS_LABEL[st]}) is already completed.`);
                    return;
                  }

                  // Strict Step-by-Step Rule: Skipping is BLOCKED!
                  if (!isAllowedStageTransition(lead.status, st)) {
                    const currentIdx = LEAD_STATUS_ORDER.indexOf(lead.status);
                    const nextRequired = LEAD_STATUS_ORDER[currentIdx + 1];
                    toast.warning(
                      `⚠️ Strict Cycle Rule: You cannot skip directly from ${LEAD_STATUS_LABEL[lead.status]} to ${LEAD_STATUS_LABEL[st]}. Please complete Step ${currentIdx + 2} (${LEAD_STATUS_LABEL[nextRequired]}) first by entering details.`
                    );
                    if (nextRequired === "contacted") {
                      setShowConversionForm(true);
                      setShowMeetingForm(false);
                      setShowNegotiationForm(false);
                    }
                    if (nextRequired === "meeting_scheduled") {
                      setShowMeetingForm(true);
                      setShowConversionForm(false);
                      setShowNegotiationForm(false);
                    }
                    if (nextRequired === "negotiating") {
                      setShowNegotiationForm(true);
                      setShowMeetingForm(false);
                      setShowConversionForm(false);
                    }
                    return;
                  }

                  // Step 2: Contacted Form
                  if (st === "contacted") {
                    setShowConversionForm(true);
                    setShowMeetingForm(false);
                    setShowNegotiationForm(false);
                    toast.info("Please fill out contact channel & notes below, then click Save to update stage.");
                    return;
                  }

                  // Step 3: Meeting Scheduled Form
                  if (st === "meeting_scheduled") {
                    setShowMeetingForm(true);
                    setShowConversionForm(false);
                    setShowNegotiationForm(false);
                    toast.success("🎯 Meeting Scheduler Activated! Enter meeting details below to convert stage.");
                    return;
                  }

                  // Step 4: Negotiation Form
                  if (st === "negotiating") {
                    setShowNegotiationForm(true);
                    setShowMeetingForm(false);
                    setShowConversionForm(false);
                    toast.success("🤝 Price Negotiation Form Activated! Enter negotiation terms below.");
                    return;
                  }

                  // Step 5: Converted
                  if (st !== lead.status) {
                    changeStageMutation.mutate({ newStatus: st });
                  }
                }}
                className="flex flex-col items-center text-center group cursor-pointer select-none"
                title={`Step ${idx + 1}: ${LEAD_STATUS_LABEL[st]}`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all border shadow-md group-hover:scale-110 active:scale-95 relative ${
                    isDroppedStep
                      ? "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/60 ring-4 ring-red-500/20 scale-105 font-extrabold"
                      : isCurrent
                      ? "bg-terracotta text-white border-terracotta ring-4 ring-terracotta/20 scale-105 font-extrabold"
                      : isCompleted
                      ? "bg-emerald-500 text-white border-emerald-500 hover:ring-2 hover:ring-emerald-500/30"
                      : isNextStage
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40 ring-2 ring-amber-500/20"
                      : "bg-muted text-muted-foreground border-border hover:border-foreground/40 opacity-50"
                  }`}
                >
                  {isDroppedStep ? (
                    <Ban className="h-5 w-5 text-red-600 dark:text-red-400" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-bold mt-1.5 capitalize line-clamp-1 group-hover:text-terracotta transition-colors ${
                    isDroppedStep
                      ? "text-red-600 dark:text-red-400 font-extrabold"
                      : isCurrent
                      ? "text-terracotta font-bold"
                      : isCompleted
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground opacity-60"
                  }`}
                >
                  {idx + 1}. {LEAD_STATUS_LABEL[st]}{isDroppedStep ? " (Dropped)" : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Drop Lead Form ---- */}
      {showDropForm && lead.status !== "converted" && lead.status !== "dropped" && (
        <div className="rounded-xl border-2 border-red-500/50 bg-gradient-to-br from-red-500/10 via-red-500/[0.03] to-card p-5 shadow-lg space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(239,68,68,0.08)_0%,_transparent_60%)] pointer-events-none" />

          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-700 text-white shadow-lg">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  Drop Lead — <span className="text-red-600 dark:text-red-400">{lead.name}</span>
                </h3>
                <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-0.5">
                  ⚠️ This will mark the lead as dropped from <strong>{LEAD_STATUS_LABEL[lead.status]}</strong> stage
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowDropForm(false); setDropReason(""); setDropNotes(""); }}
              className="h-7 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              ✕ Cancel
            </Button>
          </div>

          <div className="space-y-3 relative z-10">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Flag className="h-4 w-4 text-red-500" />
                Reason for Dropping <span className="text-red-500">*</span>
              </Label>
              <Select value={dropReason} onValueChange={setDropReason}>
                <SelectTrigger className="bg-card border-red-500/30 focus:border-red-500 text-xs h-9">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lost_interest">😔 Lost Interest — Lead no longer interested</SelectItem>
                  <SelectItem value="budget_issues">💰 Budget Issues — Cannot afford / financial constraints</SelectItem>
                  <SelectItem value="competitor_won">🏢 Competitor Won — Chose a competitor project</SelectItem>
                  <SelectItem value="unresponsive">📵 Unresponsive — No reply after multiple follow-ups</SelectItem>
                  <SelectItem value="bad_fit">❌ Bad Fit — Requirements don't match our offerings</SelectItem>
                  <SelectItem value="relocated">🚚 Relocated — Moved to different city/region</SelectItem>
                  <SelectItem value="timing">⏳ Timing — Not ready to purchase now</SelectItem>
                  <SelectItem value="other">📝 Other — Custom reason (specify in notes)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <StickyNote className="h-4 w-4 text-red-500" />
                Additional Notes (optional)
              </Label>
              <Textarea
                rows={3}
                value={dropNotes}
                onChange={(e) => setDropNotes(e.target.value)}
                placeholder="e.g. Lead mentioned they found a cheaper alternative in Sector 5, tried calling 3x..."
                className="text-xs resize-none bg-card border-red-500/30 focus:border-red-500"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowDropForm(false); setDropReason(""); setDropNotes(""); }}
                className="flex-1 h-10 text-xs font-bold border-border cursor-pointer rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => dropLeadMutation.mutate()}
                disabled={!dropReason || dropLeadMutation.isPending}
                className="flex-1 h-10 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-extrabold gap-2 shadow-lg cursor-pointer rounded-xl text-xs disabled:opacity-50"
              >
                <Ban className="h-4 w-4" />
                {dropLeadMutation.isPending ? "Dropping..." : "Confirm Drop Lead"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Dropped Lead Overview Card ---- */}
      {lead.status === "dropped" && (
        <div className="rounded-xl border-2 border-red-500/40 bg-gradient-to-br from-red-500/10 via-card to-red-500/[0.02] p-5 shadow-md space-y-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-red-500/20 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                <Ban className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wide text-red-600 dark:text-red-400 flex items-center gap-2">
                  🚫 Lead Status: Dropped
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  This lead was marked as dropped and moved out of the active sales funnel.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full border bg-red-500/15 text-red-600 border-red-500/30">
              Dropped
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border bg-muted/40 space-y-1">
              <span className="text-muted-foreground font-semibold block text-[11px]">Point / Stage Dropped From:</span>
              <span className="font-extrabold text-foreground capitalize flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5 text-red-500" />
                Step {LEAD_STATUS_ORDER.indexOf(effectiveDroppedFromStage) + 1}: {LEAD_STATUS_LABEL[effectiveDroppedFromStage] ?? effectiveDroppedFromStage}
              </span>
            </div>

            <div className="p-3 rounded-lg border bg-muted/40 space-y-1">
              <span className="text-muted-foreground font-semibold block text-[11px]">Primary Drop Reason:</span>
              <span className="font-extrabold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                {dropReasonText}
              </span>
            </div>
          </div>

          {dropNotesText && (
            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5 text-red-500" /> User / Agent Notes:
              </span>
              <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/[0.04] text-xs text-foreground italic whitespace-pre-wrap leading-relaxed">
                "{dropNotesText}"
              </div>
            </div>
          )}

          {droppedAtTime && (
            <p className="text-[10px] text-muted-foreground italic text-right pt-1">
              Dropped on {new Date(droppedAtTime).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              {droppedByName ? ` by ${droppedByName}` : ""}
            </p>
          )}

          <div className="pt-2 flex justify-end border-t border-red-500/20">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await (supabase as any)
                    .from("plot_leads")
                    .update({ status: "negotiating", plot_id: null })
                    .eq("id", lead.id);

                  await (supabase as any).from("lead_activities").insert({
                    lead_id: lead.id,
                    activity_type: "reopened",
                    from_status: "dropped",
                    to_status: "negotiating",
                    performed_by: userId,
                    notes: "🔄 Lead Re-opened from Dropped — Moved back to active Negotiating pipeline for alternative plots",
                  });

                  toast.success("🎉 Lead re-opened and restored to Negotiating stage!");
                  if (onStatusChange) onStatusChange(lead.id, "negotiating");
                  qc.invalidateQueries({ queryKey: ["lead-activities", lead.id] });
                  qc.invalidateQueries({ queryKey: ["all_plot_leads"] });
                  qc.invalidateQueries({ queryKey: ["plot-leads"] });
                  qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
                } catch (err: any) {
                  toast.error(err.message || "Failed to re-open lead");
                }
              }}
              className="text-xs h-8 border-terracotta/40 text-terracotta hover:bg-terracotta/10 cursor-pointer gap-1.5 font-bold"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Re-open / Revive Lead to Pipeline
            </Button>
          </div>
        </div>
      )}

      {/* ---- Single Lead Conversion Details Form (Step 2 Contacted) ---- */}
      {lead.status === "new" && (
        <div className="rounded-xl border border-terracotta/30 bg-terracotta/[0.02] p-4 shadow-2xs space-y-3">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowConversionForm(!showConversionForm)}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-terracotta" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Step 2: Contact & Conversion Details
              </h3>
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground">
              {showConversionForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {showConversionForm && (
            isPreviewingConversion ? (
              <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-card to-card p-4 shadow-md space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Preview Conversion Details for {lead.name}
                  </h4>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                    New → Contacted
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs rounded-lg border bg-muted/30 p-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Lead Name</span>
                    <p className="font-bold text-foreground mt-0.5">{lead.name}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Contact Method</span>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5">{channel}</p>
                  </div>
                  {budget && (
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Customer Budget</span>
                      <p className="font-semibold text-foreground mt-0.5">₹{Number(budget).toLocaleString("en-IN")}</p>
                    </div>
                  )}
                  {meetingDate && (
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Follow-up Schedule</span>
                      <p className="font-semibold text-purple-700 dark:text-purple-300 mt-0.5">
                        {new Date(meetingDate).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                  )}
                  <div className="col-span-2 pt-1 border-t border-border/40">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Conversation Summary Notes</span>
                    <p className="text-muted-foreground italic mt-0.5 leading-relaxed bg-card p-2 rounded border border-border/50">
                      "{conversionNotes}"
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPreviewingConversion(false)}
                    className="h-9 text-xs font-medium gap-1.5 cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit Details
                  </Button>
                  <Button
                    type="button"
                    disabled={submitConversionMutation.isPending}
                    onClick={() => submitConversionMutation.mutate()}
                    className="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer shadow-md"
                  >
                    <CheckCircle2 className="h-4 w-4" /> {submitConversionMutation.isPending ? "Converting..." : "Confirm & Submit Conversion"}
                  </Button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!conversionNotes.trim()) {
                    toast.warning("Please enter conversation details before previewing.");
                    return;
                  }
                  setIsPreviewingConversion(true);
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
                    <CurrencyInput
                      value={budget}
                      onChange={setBudget}
                      placeholder="e.g. 25,00,000"
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
                  className="w-full bg-terracotta hover:bg-terracotta/90 text-white font-semibold gap-1.5 h-9 shadow-2xs cursor-pointer"
                >
                  <Eye className="h-4 w-4" /> Preview & Review Conversion Details
                </Button>
              </form>
            )
          )}
        </div>
      )}

      {/* ---- Schedule Meeting & Site Visit Details Form (Step 3) ---- */}
      {showMeetingForm && (
        <div className="rounded-xl border-2 border-purple-500/40 bg-gradient-to-br from-purple-500/15 via-purple-500/[0.08] to-indigo-500/5 p-5 shadow-lg space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  Step 3: Schedule Meeting & Site Visit
                  <Sparkle className="h-4 w-4 text-purple-500" />
                </h3>
                <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5">
                  🎯 Transition <strong>{lead.name}</strong> to Meeting Scheduled stage
                </p>
              </div>
            </div>
          </div>

          {isPreviewingMeeting ? (
            <div className="rounded-xl border-2 border-purple-500/50 bg-gradient-to-br from-purple-500/15 via-indigo-500/10 to-card p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <h4 className="font-bold text-sm uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Eye className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Preview Meeting Schedule
                </h4>
                <span className="text-[11px] font-extrabold uppercase px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white border border-purple-500/50 shadow-md">
                  Contacted → Meeting Scheduled
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg bg-gradient-to-br from-card to-muted/30 border border-purple-500/20 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Lead Name</span>
                  </div>
                  <p className="font-bold text-lg text-foreground">{lead.name}</p>
                </div>

                <div className="rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/10 border-2 border-purple-500/30 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-purple-600" />
                    <span className="text-[10px] uppercase tracking-wider text-purple-700 dark:text-purple-400 font-semibold">Meeting Schedule</span>
                  </div>
                  <p className="font-bold text-lg text-purple-700 dark:text-purple-300">
                    {meetingDate ? new Date(meetingDate).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "N/A"}
                  </p>
                </div>

                <div className="col-span-1 sm:col-span-2 rounded-lg bg-gradient-to-br from-card to-muted/30 border border-purple-500/20 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-purple-600" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Meeting Place / Location</span>
                  </div>
                  <p className="font-semibold text-foreground text-base">{meetingLocation || "N/A"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPreviewingMeeting(false)}
                  className="h-10 text-xs font-medium gap-2 cursor-pointer border-purple-500/30 hover:bg-purple-500/10"
                >
                  <Pencil className="h-4 w-4" /> Edit Schedule
                </Button>
                <Button
                  type="button"
                  disabled={submitMeetingMutation.isPending}
                  onClick={() => submitMeetingMutation.mutate()}
                  className="h-10 text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white gap-2 cursor-pointer shadow-lg animate-pulse hover:animate-none"
                >
                  <PartyPopper className="h-4 w-4" /> {submitMeetingMutation.isPending ? "Scheduling..." : "🎉 Confirm & Schedule Meeting"}
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!meetingDate || !meetingLocation.trim()) {
                  toast.warning("Please fill meeting date and place before previewing.");
                  return;
                }
                setIsPreviewingMeeting(true);
              }}
              className="space-y-4 pt-3 border-t-2 border-purple-500/20 relative z-10"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-purple-600" /> Meeting Date & Time <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="datetime-local"
                    required
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="h-10 text-xs bg-card border-purple-500/30 focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-purple-600" /> Meeting Place / Location <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. Site Office, Customer Home, Plot Site, Google Meet"
                    value={meetingLocation}
                    onChange={(e) => setMeetingLocation(e.target.value)}
                    className="h-10 text-xs bg-card border-purple-500/30 focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <StickyNote className="h-4 w-4 text-purple-600" />
                  Meeting Agenda & Discussion Notes
                </Label>
                <Textarea
                  rows={3}
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  placeholder="e.g. Site walkthrough for plot #21, payment plan discussion..."
                  className="text-xs resize-none bg-card border-purple-500/30 focus:border-purple-500"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold gap-2 h-11 shadow-lg cursor-pointer rounded-xl text-sm"
              >
                <Eye className="h-5 w-5" /> Preview & Schedule Step 3 Meeting
              </Button>
            </form>
          )}
        </div>
      )}

      {/* ---- Price & Term Negotiation Details Form (Step 4) ---- */}
      {showNegotiationForm && (
        <div className="rounded-xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-amber-500/[0.08] to-terracotta/5 p-5 shadow-lg space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-terracotta text-white shadow-lg">
                <Handshake className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  Step 4: Price & Terms Negotiation
                  <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </h3>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                  🤝 Transition <strong>{lead.name}</strong> to Negotiating stage
                </p>
              </div>
            </div>
          </div>

          {/* Mapped Site Details Header or Plot Selection Warning */}
          {lead.plot_id ? (
            <div className="rounded-xl border border-terracotta/30 bg-gradient-to-r from-terracotta/10 via-card to-card p-3.5 shadow-2xs flex items-center justify-between gap-3 flex-wrap relative z-10">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-terracotta text-white shadow-2xs shrink-0">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold text-foreground uppercase tracking-wider">
                      {mappedPlot?.projects?.name || projectName || "Mapped Site"}
                    </span>
                    <span className="text-xs font-bold text-terracotta bg-terracotta/10 px-2 py-0.5 rounded-md border border-terracotta/20">
                      Plot #{mappedPlot?.plot_number || plotNumber || "Mapped"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                    {mappedPlot?.area_sqft && <span>📐 Area: {mappedPlot.area_sqft} sq.ft</span>}
                    {mappedPlot?.price && <span>💵 Base Price: <strong className="text-foreground font-semibold">₹{Number(mappedPlot.price).toLocaleString("en-IN")}</strong></span>}
                    {mappedPlot?.status && <span className="capitalize font-medium text-emerald-600">● {mappedPlot.status}</span>}
                  </div>
                </div>
              </div>

              <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                ✓ Site Mapped
              </span>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-card to-card p-6 shadow-xl space-y-4 text-center relative z-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 border border-amber-500/30 shadow-sm">
                <MapPin className="h-7 w-7 text-amber-600 animate-bounce" />
              </div>

              <div className="space-y-1.5 max-w-md mx-auto">
                <h4 className="text-base font-extrabold text-foreground tracking-tight flex items-center justify-center gap-2">
                  🔒 Site Mapping Required for Negotiation
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  To unlock price and payment term negotiations for <strong className="text-foreground">{lead.name}</strong>, this lead must first be mapped to a specific plot site.
                </p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4 space-y-3 max-w-md mx-auto text-left">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" /> Option 1: Quick Select & Map Plot Site:
                </Label>
                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                  <Select value={selectedPlotToMap} onValueChange={setSelectedPlotToMap}>
                    <SelectTrigger className="h-10 text-xs bg-card flex-1 min-w-[200px] border-amber-500/30">
                      <SelectValue placeholder="Choose plot site..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePlots.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          <div className="flex items-center justify-between w-full gap-2">
                            <span className="font-bold text-foreground">Plot #{p.plot_number}</span>
                            <span className="text-muted-foreground">({p.projects?.name ?? "Project"})</span>
                            {p.price && <span className="font-semibold text-emerald-600 dark:text-emerald-400">₹{Number(p.price).toLocaleString("en-IN")}</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    disabled={!selectedPlotToMap || mapPlotMutation.isPending}
                    onClick={() => selectedPlotToMap && mapPlotMutation.mutate(selectedPlotToMap)}
                    className="h-10 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5 px-4 shadow-md shrink-0 cursor-pointer"
                  >
                    <MapPin className="h-4 w-4" /> {mapPlotMutation.isPending ? "Mapping..." : "Map Site Now"}
                  </Button>
                </div>
              </div>

              {/* Redirect & Interactive Mapper Options */}
              <div className="pt-2 border-t border-border/40 flex items-center justify-center gap-3 flex-wrap">
                {onMapPlot && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onMapPlot(lead)}
                    className="h-9 text-xs font-bold border-terracotta/40 text-terracotta hover:bg-terracotta/10 gap-2 px-4 rounded-xl cursor-pointer shadow-xs"
                  >
                    <MapPin className="h-4 w-4" /> Option 2: Open Plot Mapper Modal
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => window.open("/projects", "_blank")}
                  className="h-9 text-xs font-medium text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer"
                >
                  <span>Option 3: Go to Projects & Site Map Page</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Render Negotiation Price & Terms Form ONLY when lead.plot_id is present */}
          {lead.plot_id && (
            <>

          {isPreviewingNegotiation ? (
            <div className="rounded-xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/15 via-terracotta/10 to-card p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <h4 className="font-bold text-sm uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Eye className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  Preview Negotiation Terms
                </h4>
                <span className="text-[11px] font-extrabold uppercase px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-terracotta text-white border border-amber-500/50 shadow-md">
                  Meeting Scheduled → Negotiating
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg bg-gradient-to-br from-amber-500/20 to-terracotta/10 border-2 border-amber-500/30 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <IndianRupee className="h-4 w-4 text-amber-600" />
                    <span className="text-[10px] uppercase tracking-wider text-amber-800 dark:text-amber-300 font-semibold">Offered / Negotiated Price</span>
                  </div>
                  <p className="font-bold text-xl text-amber-700 dark:text-amber-300">
                    ₹{Number(negotiatedPrice).toLocaleString("en-IN")}
                  </p>
                </div>

                <div className="rounded-lg bg-gradient-to-br from-card to-muted/30 border border-amber-500/20 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-4 w-4 text-amber-600" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Payment Structure</span>
                  </div>
                  <p className="font-semibold text-foreground text-sm">
                    {PAYMENT_PLANS[paymentPlan]?.label || paymentPlan}
                  </p>
                </div>

                {discountOffered && (
                  <div className="col-span-1 sm:col-span-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Percent className="h-4 w-4 text-emerald-600" />
                      <span className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300 font-semibold">Special Discount / Waiver</span>
                    </div>
                    <p className="font-semibold text-emerald-800 dark:text-emerald-300 text-xs">{discountOffered}</p>
                  </div>
                )}

                {negotiationNotes && (
                  <div className="col-span-1 sm:col-span-2 rounded-lg bg-card border border-amber-500/20 p-3 shadow-sm">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">Terms & Counter-Offer Notes</span>
                    <p className="text-xs text-muted-foreground italic leading-relaxed">{negotiationNotes}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPreviewingNegotiation(false)}
                  className="h-10 text-xs font-medium gap-2 cursor-pointer border-amber-500/30 hover:bg-amber-500/10"
                >
                  <Pencil className="h-4 w-4" /> Edit Terms
                </Button>
                <Button
                  type="button"
                  disabled={submitNegotiationMutation.isPending}
                  onClick={() => submitNegotiationMutation.mutate()}
                  className="h-10 text-xs font-bold bg-gradient-to-r from-amber-500 to-terracotta hover:from-amber-600 hover:to-terracotta text-white gap-2 cursor-pointer shadow-lg"
                >
                  <Handshake className="h-4 w-4" /> {submitNegotiationMutation.isPending ? "Saving..." : "🤝 Confirm & Start Negotiation Stage"}
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!negotiatedPrice) {
                  toast.warning("Please enter offered price before previewing.");
                  return;
                }
                setIsPreviewingNegotiation(true);
              }}
              className="space-y-4 pt-3 border-t-2 border-amber-500/20 relative z-10"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <IndianRupee className="h-4 w-4 text-amber-600" /> Offered / Negotiated Price (₹) <span className="text-destructive">*</span>
                  </Label>
                  <CurrencyInput
                    value={negotiatedPrice}
                    onChange={setNegotiatedPrice}
                    placeholder="e.g. 24,50,000"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Tag className="h-4 w-4 text-amber-600" /> Payment Structure / Plan
                  </Label>
                  <Select value={paymentPlan} onValueChange={setPaymentPlan}>
                    <SelectTrigger className="h-10 text-xs bg-card border-amber-500/30">
                      <SelectValue placeholder="Select payment plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_PLANS).map(([key, val]) => (
                        <SelectItem key={key} value={key} className="text-xs">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{val.label}</span>
                            <span className="text-[10px] text-muted-foreground">{val.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Percent className="h-4 w-4 text-amber-600" /> Special Discount / Waiver Offered
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. ₹50,000 Special Waiver / Registration Fee Included"
                  value={discountOffered}
                  onChange={(e) => setDiscountOffered(e.target.value)}
                  className="h-10 text-xs bg-card border-amber-500/30 focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <StickyNote className="h-4 w-4 text-amber-600" />
                  Negotiation Terms & Counter-Offer Notes
                </Label>
                <Textarea
                  rows={3}
                  value={negotiationNotes}
                  onChange={(e) => setNegotiationNotes(e.target.value)}
                  placeholder="e.g. Buyer requested 15 days to arrange token advance, agreed to registration terms..."
                  className="text-xs resize-none bg-card border-amber-500/30 focus:border-amber-500"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full bg-gradient-to-r from-amber-500 to-terracotta hover:from-amber-600 hover:to-terracotta text-white font-bold gap-2 h-11 shadow-lg cursor-pointer rounded-xl text-sm"
              >
                <Eye className="h-5 w-5" /> Preview & Review Step 4 Negotiation Terms
              </Button>
            </form>
          )}
          </>
          )}
        </div>
      )}

      {/* ---- Step 5: Convert Lead to Booking (For Negotiating Leads) ---- */}
      {lead.status === "negotiating" && (
        <div className="rounded-xl border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-500/15 via-emerald-500/[0.05] to-card p-5 shadow-lg space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                <Trophy className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  Step 5: Convert Lead & Book Plot Site
                  <PartyPopper className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </h3>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                  🎉 Final Step: Book plot site for <strong>{lead.name}</strong> to convert lead
                </p>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              Negotiating → Converted
            </span>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-card p-4 space-y-2 relative z-10">
            <div className="flex items-center gap-2 text-xs text-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                Clicking <strong>"Convert & Book Plot Site"</strong> will redirect you to the official Plot Booking Studio with <strong>{lead.name}</strong>'s details pre-filled.
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40">
              • <strong>Mapped Plot:</strong> Plot #{plotNumber || "Selected Plot"}{projectName ? ` in ${projectName}` : ""}
              <br />
              • <strong>Agreed Price:</strong> ₹{Number((lead as any).negotiated_price || lead.budget || 0).toLocaleString("en-IN")}
              <br />
              • <strong>Automatic Conversion:</strong> Submitting the booking form will automatically convert this lead to <strong>Converted</strong> stage.
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            onClick={() => {
              if (!lead.plot_id) {
                toast.warning("⚠️ Please map a plot site first before booking & converting this lead.");
                return;
              }
              window.location.href = `/plots/${lead.plot_id}/book/checkout?leadId=${lead.id}`;
            }}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold gap-2 h-11 shadow-xl cursor-pointer rounded-xl text-sm"
          >
            <Trophy className="h-5 w-5" /> Proceed to Booking Studio & Convert Lead →
          </Button>
        </div>
      )}

      {/* ---- Reverse-Chronological Audit Trail (Recent / Latest First: 5 → 4 → 3 → 2 → 1) ---- */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-terracotta" /> Full Lifecycle Audit Trail
            </h4>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-terracotta/10 text-terracotta border border-terracotta/20">
              ↓ Most Recent First (Step 5 → 1)
            </span>
          </div>

          <span className="text-[11px] text-muted-foreground font-medium">
            {timelineEvents.length} touchpoint{timelineEvents.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-terracotta via-amber-500/40 to-border/30">
          {timelineEvents.map((evt, idx) => {
            const Icon = evt.icon;
            const isLatest = idx === 0;
            const stageRank = getStageRank(evt);
            const formattedTime = new Date(evt.timestamp).toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });

            // Step color accents
            let stepBadgeStyle = "bg-terracotta/10 text-terracotta border-terracotta/20";
            if (stageRank === 5) stepBadgeStyle = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold";
            else if (stageRank === 4) stepBadgeStyle = "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 font-bold";
            else if (stageRank === 3) stepBadgeStyle = "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 font-bold";
            else if (stageRank === 2) stepBadgeStyle = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 font-bold";
            else if (stageRank === 1) stepBadgeStyle = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 font-bold";

            const stepLabel = Number.isInteger(stageRank) ? `Step ${stageRank}` : "Touchpoint";

            return (
              <div key={evt.id} className="relative group">
                {/* Node icon pin on vertical timeline line */}
                <div className={`absolute -left-6 top-1.5 rounded-full p-1 transition-all shadow-sm ${
                  isLatest
                    ? "bg-terracotta text-white border-2 border-background ring-4 ring-terracotta/20 animate-pulse"
                    : "bg-background border border-border group-hover:border-terracotta text-terracotta"
                }`}>
                  <Icon className={`h-3 w-3 ${isLatest ? "text-white" : "text-terracotta"}`} />
                </div>

                {/* Audit Card */}
                <div
                  className={`rounded-xl border p-4 transition-all space-y-2.5 ${
                    isLatest
                      ? "bg-gradient-to-r from-terracotta/10 via-amber-500/[0.04] to-card border-terracotta/40 shadow-md ring-1 ring-terracotta/20"
                      : "bg-card/70 hover:bg-card border-border/80 shadow-2xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${stepBadgeStyle}`}>
                          {stepLabel}
                        </span>
                        {evt.title}
                      </span>

                      {isLatest && (
                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-terracotta text-white shadow-2xs animate-pulse">
                          🔥 Latest Activity
                        </span>
                      )}

                      {evt.channel && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-muted/60 text-muted-foreground">
                          {evt.channel}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground font-medium shrink-0">{formattedTime}</span>
                  </div>

                  {evt.notes && (
                    <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border/40 whitespace-pre-wrap italic">
                      "{evt.notes}"
                    </p>
                  )}

                  {evt.performer && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                      <Avatar className="h-4 w-4">
                        <AvatarFallback className={`text-[8px] ${tintFor(evt.performer)}`}>
                          {initials(evt.performer)}
                        </AvatarFallback>
                      </Avatar>
                      <span>Action recorded on <strong>{formattedTime}</strong> by <strong>{evt.performer}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Center-Screen Success Confirmation Dialog ---- */}
      {centerModalData && (
        <Dialog open={!!centerModalData} onOpenChange={() => setCenterModalData(null)}>
          <DialogContent className={`sm:max-w-md bg-card/95 backdrop-blur-2xl border ${centerModalData.isDrop ? "border-red-500/40" : "border-emerald-500/40"} shadow-2xl p-6 rounded-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200 z-[100]`}>
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full border ring-8 ${centerModalData.isDrop ? "bg-red-500/15 text-red-600 border-red-500/30 ring-red-500/10" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 ring-emerald-500/10"}`}>
              {centerModalData.isDrop ? (
                <Ban className="h-7 w-7 text-red-600" />
              ) : (
                <Trophy className="h-7 w-7 text-emerald-600 dark:text-emerald-400 animate-bounce" />
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-extrabold text-foreground tracking-tight">
                {centerModalData.isDrop ? "🚫 Lead Dropped" : "🎉 Lead Stage Advanced!"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Lead <strong className="text-foreground">{centerModalData.leadName}</strong>{" "}
                {centerModalData.isDrop ? "has been dropped from" : "moved from"}{" "}
                <span className="font-semibold text-terracotta capitalize">{centerModalData.fromStage}</span>{" "}
                {centerModalData.isDrop ? "" : <>to{" "}<span className="font-semibold text-emerald-600 dark:text-emerald-400 capitalize">{centerModalData.toStage}</span>!</>}
              </p>
            </div>

            <div className="rounded-xl border bg-muted/30 p-3.5 text-xs text-left space-y-2">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground font-medium">Lead Name:</span>
                <span className="font-bold text-foreground">{centerModalData.leadName}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground font-medium">{centerModalData.isDrop ? "Dropped From:" : "Lifecycle Transition:"}</span>
                <span className="font-semibold text-foreground">
                  {centerModalData.isDrop
                    ? <strong className="text-red-600">{centerModalData.fromStage} → Dropped</strong>
                    : <>{centerModalData.fromStage} → <strong className="text-emerald-600 dark:text-emerald-400">{centerModalData.toStage}</strong></>}
                </span>
              </div>
              {centerModalData.channel && (
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground font-medium">Contact Method:</span>
                  <span className="font-semibold text-foreground">{centerModalData.channel}</span>
                </div>
              )}
              {centerModalData.notes && (
                <div>
                  <span className="text-muted-foreground font-medium block mb-1">Touchpoint Details:</span>
                  <p className="text-muted-foreground italic bg-card p-2.5 rounded border border-border/50 whitespace-pre-wrap">
                    "{centerModalData.notes}"
                  </p>
                </div>
              )}
            </div>

            <Button
              onClick={() => setCenterModalData(null)}
              className={`w-full ${centerModalData.isDrop ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"} text-white font-bold h-10 shadow-md cursor-pointer rounded-xl text-xs uppercase tracking-wider`}
            >
              {centerModalData.isDrop ? "Understood" : "Awesome, Got It!"}
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
