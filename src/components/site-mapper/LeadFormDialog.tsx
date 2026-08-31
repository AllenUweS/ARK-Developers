import { useEffect, useState } from "react";
import { UserPlus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  getPhoneValidationError,
  isValid10DigitPhone,
  isValidEmail,
  sanitizePhoneInput,
  sanitizePositiveNumber,
} from "@/lib/formValidation";
import { toast } from "sonner";
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
import { LEAD_SOURCES, type LeadRow } from "./types";

export interface LeadFormValues {
  name: string;
  phone: string;
  email: string | null;
  source: string | null;
  budget: number | null;
  notes: string | null;
  meeting_date: string | null;
  meeting_location: string | null;
}

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  source: "Walk-in",
  budget: "",
  notes: "",
  meeting_date: "",
  meeting_location: "",
};

type FormState = typeof emptyForm;

/** ISO timestamp <-> the local value a `datetime-local` input expects. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toFormState(lead: LeadRow | null): FormState {
  if (!lead) return emptyForm;
  return {
    name: lead.name,
    phone: lead.phone,
    email: lead.email ?? "",
    source: lead.source ?? "Walk-in",
    budget: lead.budget?.toString() ?? "",
    notes: lead.notes ?? "",
    meeting_date: toLocalInput(lead.meeting_date),
    meeting_location: lead.meeting_location ?? "",
  };
}

export function LeadFormDialog({
  open,
  mode,
  initial,
  pending,
  onSubmit,
  onOpenChange,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial: LeadRow | null;
  pending: boolean;
  onSubmit: (values: LeadFormValues) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (open) setForm(toFormState(initial));
  }, [open, initial]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanPhone = sanitizePhoneInput(form.phone);
    const phoneErr = getPhoneValidationError(cleanPhone);
    if (phoneErr) {
      toast.error(phoneErr);
      return;
    }

    if (form.email && form.email.trim() && !isValidEmail(form.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    onSubmit({
      name: form.name.trim(),
      phone: cleanPhone,
      email: form.email.trim() || null,
      source: form.source || null,
      budget: form.budget ? sanitizePositiveNumber(form.budget) : null,
      notes: form.notes.trim() || null,
      meeting_date: form.meeting_date ? new Date(form.meeting_date).toISOString() : null,
      meeting_location: form.meeting_location.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-display text-2xl">
            <UserPlus className="h-5 w-5 text-terracotta" />
            {mode === "create" ? "Add a lead" : "Edit lead"}
          </DialogTitle>
          <DialogDescription>
            Log an interested buyer against this plot. You can arrange a site visit now or come
            back and schedule it later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Full name <span className="text-terracotta">*</span>
              </Label>
              <Input
                className="mt-1.5"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Ramesh Kulkarni"
                required
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Phone <span className="text-terracotta">*</span>
              </Label>
              <div className="mt-1.5">
                <PhoneInput
                  value={form.phone}
                  onChange={(val) => set("phone", val)}
                  placeholder="98765 43210"
                  required
                />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                type="email"
                className="mt-1.5"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="optional"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Budget (₹)
              </Label>
              <div className="mt-1.5">
                <CurrencyInput
                  value={form.budget}
                  onChange={(val) => set("budget", val)}
                  placeholder="e.g. 50,00,000"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                How did they find us?
              </Label>
              <Select value={form.source} onValueChange={(v) => set("source", v)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select source" />
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
          </div>

          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Site visit / meeting
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Date &amp; time
                </Label>
                <Input
                  type="datetime-local"
                  className="mt-1.5"
                  value={form.meeting_date}
                  onChange={(e) => set("meeting_date", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Location
                </Label>
                <Input
                  className="mt-1.5"
                  value={form.meeting_location}
                  onChange={(e) => set("meeting_location", e.target.value)}
                  placeholder="e.g. Site office"
                />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Notes
            </Label>
            <Textarea
              className="mt-1.5"
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Requirements, family details, follow-up points…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || !form.name.trim() || !form.phone.trim()}
              className="bg-terracotta text-accent-foreground hover:bg-terracotta/90"
            >
              <Save className="h-4 w-4 mr-1.5" />
              {pending ? "Saving..." : mode === "create" ? "Add lead" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
