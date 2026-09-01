import { useEffect, useState } from "react";
import {
  Phone,
  MessageCircle,
  Mail,
  Users,
  MapPin,
  Globe,
  Share2,
  Calendar,
  Sparkles,
  CheckCircle2,
  IndianRupee,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { LeadRow } from "@/components/site-mapper/types";

export const CONTACT_CHANNELS = [
  { id: "Phone Call", label: "Phone Call", icon: Phone },
  { id: "WhatsApp", label: "WhatsApp Message / Call", icon: MessageCircle },
  { id: "Email", label: "Email", icon: Mail },
  { id: "In-Person Meeting", label: "In-Person Meeting", icon: Users },
  { id: "Site Visit", label: "Site Visit", icon: MapPin },
  { id: "Web Inquiry", label: "Web Inquiry", icon: Globe },
  { id: "Referral", label: "Referral", icon: Share2 },
];

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LeadContactedDialog({
  open,
  lead,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  lead: LeadRow | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: {
    channel: string;
    notes: string;
    budget?: number;
    meetingDate?: string;
    meetingLocation?: string;
  }) => Promise<void> | void;
}) {
  const [channel, setChannel] = useState<string>("Phone Call");
  const [notes, setNotes] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [meetingDate, setMeetingDate] = useState<string>("");
  const [meetingLocation, setMeetingLocation] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && lead) {
      setChannel((lead as any).contacted_channel || "Phone Call");
      setNotes((lead as any).contacted_notes || lead.notes || "");
      setBudget(lead.budget ? lead.budget.toString() : "");
      setMeetingDate(lead.meeting_date ? toLocalInput(lead.meeting_date) : "");
      setMeetingLocation(lead.meeting_location || "");
    }
  }, [open, lead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      toast.error("Please enter details on how the lead was contacted.");
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm({
        channel,
        notes: notes.trim(),
        budget: budget ? parseFloat(budget) : undefined,
        meetingDate: meetingDate || undefined,
        meetingLocation: meetingLocation.trim() || undefined,
      });
      setNotes("");
      setBudget("");
      setMeetingDate("");
      setMeetingLocation("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save contact information");
    } finally {
      setSubmitting(false);
    }
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-terracotta mb-1">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Single Lead Conversion Form</span>
          </div>
          <DialogTitle className="text-xl">Contact & Conversion Details</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Record all conversion details for <strong className="text-foreground">{lead.name}</strong> to transition to <strong className="text-terracotta">Contacted</strong> stage.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-3">
          <div className="space-y-1.5">
            <Label htmlFor="channel" className="text-xs font-medium">
              Contact Method / Channel <span className="text-destructive">*</span>
            </Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger id="channel" className="h-9 text-xs">
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
            <Label htmlFor="notes" className="text-xs font-medium">
              How was this lead contacted & converted? <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="notes"
              required
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record conversation outcome, customer interest, plot requirements, or next steps..."
              className="text-xs resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="budget" className="text-xs font-medium flex items-center gap-1">
                <IndianRupee className="h-3 w-3 text-muted-foreground" /> Customer Budget
              </Label>
              <CurrencyInput
                id="budget"
                value={budget}
                onChange={setBudget}
                placeholder="e.g. 50,00,000"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meeting" className="text-xs font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3 text-muted-foreground" /> Follow-up Date
              </Label>
              <Input
                id="meeting"
                type="datetime-local"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location" className="text-xs font-medium flex items-center gap-1">
              <MapPin className="h-3 w-3 text-muted-foreground" /> Meeting / Visit Location
            </Label>
            <Input
              id="location"
              type="text"
              placeholder="e.g. Site Office / Customer Residence"
              value={meetingLocation}
              onChange={(e) => setMeetingLocation(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-terracotta hover:bg-terracotta/90 text-white gap-1.5 font-medium"
            >
              <CheckCircle2 className="h-4 w-4" /> Save & Update Stage
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
