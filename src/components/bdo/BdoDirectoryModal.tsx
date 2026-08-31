import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Building2,
  Search,
  Plus,
  Phone,
  Mail,
  Pencil,
  CheckCircle2,
  Landmark,
  Percent,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddEditBdoDialog } from "./AddEditBdoDialog";

interface BdoDirectoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BdoDirectoryModal({ open, onOpenChange }: BdoDirectoryModalProps) {
  const [search, setSearch] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingBdo, setEditingBdo] = useState<any | null>(null);

  // Fetch all BDO partners
  const { data: bdoPartners = [], isLoading, refetch } = useQuery({
    queryKey: ["all-bdo-partners"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bdo_partners")
        .select("*")
        .order("name", { ascending: true });
      if (error) return [];
      return data ?? [];
    },
  });

  const filtered = bdoPartners.filter((bdo: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (bdo.name || "").toLowerCase().includes(q) ||
      (bdo.phone || "").toLowerCase().includes(q) ||
      (bdo.agency_name || "").toLowerCase().includes(q) ||
      (bdo.bdo_code || "").toLowerCase().includes(q)
    );
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[900px] w-[92vw] h-[85vh] max-h-[850px] flex flex-col p-6 overflow-hidden shadow-2xl border-purple-500/20">
          <DialogHeader className="pb-4 border-b shrink-0">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
                  <Users className="h-7 w-7 text-terracotta" />
                  BDO Outsourced Partners Directory
                </DialogTitle>
                <DialogDescription className="text-sm mt-1">
                  Master list of external Business Development Officers (BDOs) and referral partners who source leads and plot conversions.
                </DialogDescription>
              </div>
              <Button
                onClick={() => {
                  setEditingBdo(null);
                  setAddModalOpen(true);
                }}
                className="bg-terracotta text-white hover:bg-terracotta/90 shadow-sm gap-2 font-semibold px-4 h-10"
              >
                <Plus className="h-4 w-4" /> Register New BDO
              </Button>
            </div>
          </DialogHeader>

          {/* Search Bar */}
          <div className="py-3 shrink-0">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by BDO name, phone, agency, code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 text-xs"
              />
            </div>
          </div>

          {/* Directory Content */}
          <div className="flex-1 overflow-y-auto border rounded-xl bg-card shadow-inner min-h-0">
            {isLoading ? (
              <div className="py-20 text-center text-sm text-muted-foreground">
                Loading BDO partners directory...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center space-y-2 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto opacity-40 text-muted-foreground" />
                <p className="font-semibold text-base">No BDO partners found</p>
                <p className="text-xs text-muted-foreground">
                  Register outsourced partners to attribute leads and plot bookings to them.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/60 border-b sticky top-0 uppercase tracking-wider text-[11px] text-muted-foreground font-bold z-10">
                  <tr>
                    <th className="py-3.5 px-4">BDO Partner</th>
                    <th className="py-3.5 px-4">Agency / Code</th>
                    <th className="py-3.5 px-4">Contact Details</th>
                    <th className="py-3.5 px-4">Commission %</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs">
                  {filtered.map((bdo: any) => (
                    <tr key={bdo.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-4 px-4">
                        <span className="font-bold text-foreground text-sm block">
                          {bdo.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">Outsourced Agent</span>
                      </td>

                      <td className="py-4 px-4">
                        <span className="font-semibold text-foreground block">
                          {bdo.agency_name || "Independent BDO"}
                        </span>
                        {bdo.bdo_code && (
                          <span className="font-mono text-[10px] text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
                            {bdo.bdo_code}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 font-mono">
                        <div className="flex items-center gap-1.5 text-foreground">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{bdo.phone || "—"}</span>
                        </div>
                        {bdo.email && (
                          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mt-0.5">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span>{bdo.email}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 font-mono font-bold text-terracotta text-sm">
                        {bdo.commission_rate ? `${bdo.commission_rate}%` : "Default"}
                      </td>

                      <td className="py-4 px-4">
                        {bdo.is_active ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] px-2 py-0.5 font-semibold">
                            Active BDO
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px] px-2 py-0.5">
                            Inactive
                          </Badge>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs gap-1"
                          onClick={() => {
                            setEditingBdo(bdo);
                            setAddModalOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Dialog */}
      {addModalOpen && (
        <AddEditBdoDialog
          bdo={editingBdo}
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}
