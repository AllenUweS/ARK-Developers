import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowRight, CheckCircle2, Search, UserRound, UserPlus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { LeadRow } from "@/components/site-mapper/types";

export const Route = createFileRoute("/_authenticated/plots/$plotId/book")({
  component: SelectBookingLead,
});

function SelectBookingLead() {
  const { plotId } = Route.useParams();
  const nav = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Quick Create Lead Form State
  const [createOpen, setCreateOpen] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadEmail, setNewLeadEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: plot } = useQuery({
    queryKey: ["plot", plotId],
    queryFn: async () => {
      const { data, error } = await supabase.from("plots").select("*, projects(name, code)").eq("id", plotId).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  // Fetch ONLY active leads mapped to this specific plot
  const { data: rawLeads = [] } = useQuery({
    queryKey: ["booking-leads", plotId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("plot_leads")
        .select("*")
        .eq("plot_id", plotId)
        .not("status", "in", '("converted","dropped")')
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadRow[];
    },
  });

  const leads = useMemo(() => {
    return rawLeads.filter((lead) => {
      const s = (lead.status ?? "").toLowerCase();
      return s !== "converted" && s !== "dropped";
    });
  }, [rawLeads]);

  const ownerIds = [...new Set(leads.flatMap((lead) => [lead.created_by, lead.assigned_to]).filter(Boolean))] as string[];
  const { data: people = [] } = useQuery({
    queryKey: ["booking-lead-owners", ownerIds],
    enabled: ownerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, phone, job_title").in("id", ownerIds);
      return data ?? [];
    },
  });

  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const filtered = leads.filter((lead) => `${lead.name} ${lead.phone} ${lead.email ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const selected = leads.find((lead) => lead.id === selectedId);
  const owner = selected ? peopleById.get(selected.created_by ?? selected.assigned_to ?? "") : undefined;
  const money = (value: number | null | undefined) => `₹${Number(value ?? 0).toLocaleString("en-IN")}`;

  // Quick Create Lead Mutation
  async function handleCreateLead(e: React.FormEvent) {
    e.preventDefault();
    if (!newLeadName.trim() || !newLeadPhone.trim()) {
      return toast.error("Please provide lead name and phone number");
    }

    setIsSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const { data, error } = await (supabase as any)
        .from("plot_leads")
        .insert({
          name: newLeadName.trim(),
          phone: newLeadPhone.trim(),
          email: newLeadEmail.trim() || null,
          plot_id: plotId,
          project_id: plot?.project_id || null,
          status: "in_progress",
          created_by: userId,
          assigned_to: userId,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Lead created and mapped to this plot!");
      qc.invalidateQueries({ queryKey: ["booking-leads", plotId] });
      if (data?.id) setSelectedId(data.id);

      setNewLeadName("");
      setNewLeadPhone("");
      setNewLeadEmail("");
      setCreateOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create lead");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (location.pathname.endsWith("/checkout")) return <Outlet />;

  return (
    <div className="h-[calc(100vh-5rem)] min-h-[620px] flex flex-col overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4 pb-5 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/projects/$id" params={{ id: plot?.project_id ?? "" }} className="rounded-lg border p-2 text-muted-foreground hover:text-foreground hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Booking studio · Step 1 of 2</p>
            <h1 className="text-display text-3xl mt-1 truncate">Choose the buyer</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold">Plot {plot?.plot_number}</p>
            <p className="text-xs text-muted-foreground">{plot?.projects?.name} · {money(plot?.price)}</p>
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-terracotta text-white hover:bg-terracotta/90 gap-1.5 text-xs font-semibold">
                <UserPlus className="h-4 w-4" /> Add Lead to Plot
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="size-5 text-terracotta" /> Add Buyer Lead for Plot {plot?.plot_number}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateLead} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Buyer Name *</label>
                  <Input value={newLeadName} onChange={(e) => setNewLeadName(e.target.value)} placeholder="e.g. Rahul Sharma" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Phone Number *</label>
                  <Input value={newLeadPhone} onChange={(e) => setNewLeadPhone(e.target.value)} placeholder="e.g. +91 9876543210" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Email Address (Optional)</label>
                  <Input value={newLeadEmail} onChange={(e) => setNewLeadEmail(e.target.value)} type="email" placeholder="rahul@example.com" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={isSubmitting} className="bg-terracotta text-white hover:bg-terracotta/90">
                    {isSubmitting ? "Creating..." : "Save & Select Lead"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content Workspace */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-5 flex-1 min-h-0">
        <section className="rounded-2xl border bg-card flex flex-col min-h-0 overflow-hidden">
          <div className="p-5 border-b flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Plot Mapped Active Leads</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Showing active leads mapped specifically to Plot {plot?.plot_number}. Converted & dropped leads are hidden.
              </p>
            </div>
            <span className="text-xs font-semibold rounded-full bg-muted px-2.5 py-1">
              {leads.length} active lead{leads.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by buyer name, phone, or email"
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-y-auto p-3 grid md:grid-cols-2 gap-3 content-start">
            {filtered.map((lead) => {
              const leadOwner = peopleById.get(lead.created_by ?? lead.assigned_to ?? "");
              const active = selectedId === lead.id;
              return (
                <button
                  key={lead.id}
                  onClick={() => setSelectedId(lead.id)}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    active
                      ? "border-terracotta bg-terracotta/[0.06] ring-1 ring-terracotta/30"
                      : "hover:border-terracotta/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{lead.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {lead.phone} {lead.email && `· ${lead.email}`}
                      </p>
                    </div>
                    {active && <CheckCircle2 className="h-5 w-5 text-terracotta shrink-0" />}
                  </div>
                  <div className="mt-4 pt-3 border-t flex justify-between text-xs">
                    <span className="capitalize rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 border border-emerald-500/20">
                      {lead.status.replace("_", " ")}
                    </span>
                    <span className="text-muted-foreground truncate ml-2">
                      Owner: {leadOwner?.full_name ?? "Unassigned"}
                    </span>
                  </div>
                </button>
              );
            })}

            {filtered.length === 0 && (
              <div className="md:col-span-2 text-center text-sm text-muted-foreground py-12 space-y-3">
                <p>No active non-converted leads mapped to Plot {plot?.plot_number}.</p>
                <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-terracotta text-white hover:bg-terracotta/90 gap-1.5 text-xs">
                  <UserPlus className="h-4 w-4" /> Add Lead to Plot {plot?.plot_number}
                </Button>
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-2xl border bg-card p-5 flex flex-col min-h-0">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Booking brief</p>
          <div className="mt-4 rounded-xl bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">Listed price</p>
            <p className="text-2xl text-display mt-1">{money(plot?.price)}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {plot?.area_sqft?.toLocaleString("en-IN")} sq.ft · {plot?.facing ?? "Facing TBD"}
            </p>
          </div>

          {selected ? (
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Selected customer</p>
                <p className="font-semibold mt-1">{selected.name}</p>
                <p className="text-sm text-muted-foreground">{selected.phone}</p>
              </div>
              <div className="rounded-xl border border-dashed p-3">
                <div className="flex gap-2">
                  <UserRound className="h-4 w-4 text-terracotta mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Lead owner · locked</p>
                    <p className="text-sm font-medium mt-0.5">{owner?.full_name ?? "Not recorded"}</p>
                    <p className="text-xs text-muted-foreground">
                      {owner?.job_title ?? "Sales executive"}{owner?.phone && ` · ${owner.phone}`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Choose a lead above or add a new buyer to unlock the booking workspace.
            </div>
          )}

          <Button
            disabled={!selected}
            onClick={() =>
              selected &&
              nav({
                to: "/plots/$plotId/book/checkout",
                params: { plotId },
                search: { leadId: selected.id },
              })
            }
            className="mt-auto w-full bg-terracotta text-accent-foreground hover:bg-terracotta/90"
          >
            Continue to booking <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </aside>
      </div>
    </div>
  );
}
