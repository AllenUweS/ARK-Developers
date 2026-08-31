import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { User, Users, Edit3, Plus, Building2, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddEditBdoDialog } from "@/components/bdo/AddEditBdoDialog";

export interface AttributionValue {
  attributionType: "internal" | "bdo" | "manual_external";
  internalExecutiveId?: string;
  bdoId?: string;
  externalBdoName?: string;
}

interface AttributionSelectorProps {
  value: AttributionValue;
  onChange: (newValue: AttributionValue) => void;
  label?: string;
  defaultExecutiveId?: string;
}

export function AttributionSelector({
  value,
  onChange,
  label = "Lead / Booking Sourced By (Attribution)",
  defaultExecutiveId,
}: AttributionSelectorProps) {
  const [addBdoOpen, setAddBdoOpen] = useState(false);

  // Fetch Internal Executive Profiles
  const { data: internalExecutives = [] } = useQuery({
    queryKey: ["internal-executives-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, job_title")
        .order("full_name", { ascending: true });
      if (error) return [];
      return data ?? [];
    },
  });

  // Fetch BDO Outsourced Partners
  const { data: bdoPartners = [], refetch: refetchBdos } = useQuery({
    queryKey: ["active-bdo-partners"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bdo_partners")
        .select("id, name, phone, agency_name, bdo_code")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) return [];
      return data ?? [];
    },
  });

  const activeType = value.attributionType || "internal";

  return (
    <div className="space-y-3 p-3.5 rounded-xl bg-muted/30 border border-border/80">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-terracotta" /> {label}
        </Label>
        <span className="text-[10px] text-muted-foreground uppercase font-mono">Select Source Channel</span>
      </div>

      {/* Mode Buttons */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-muted/60 text-xs">
        <button
          type="button"
          onClick={() =>
            onChange({
              attributionType: "internal",
              internalExecutiveId: value.internalExecutiveId || defaultExecutiveId || (internalExecutives[0]?.id ?? ""),
              bdoId: undefined,
              externalBdoName: undefined,
            })
          }
          className={`py-1.5 px-2 rounded-md font-semibold text-[11px] flex items-center justify-center gap-1 transition-all ${
            activeType === "internal"
              ? "bg-card text-foreground shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-3.5 w-3.5 text-terracotta" /> Internal Exec
        </button>

        <button
          type="button"
          onClick={() =>
            onChange({
              attributionType: "bdo",
              internalExecutiveId: undefined,
              bdoId: value.bdoId || (bdoPartners[0]?.id ?? ""),
              externalBdoName: undefined,
            })
          }
          className={`py-1.5 px-2 rounded-md font-semibold text-[11px] flex items-center justify-center gap-1 transition-all ${
            activeType === "bdo"
              ? "bg-card text-foreground shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-3.5 w-3.5 text-emerald-600" /> BDO Partner
        </button>

        <button
          type="button"
          onClick={() =>
            onChange({
              attributionType: "manual_external",
              internalExecutiveId: undefined,
              bdoId: undefined,
              externalBdoName: value.externalBdoName || "",
            })
          }
          className={`py-1.5 px-2 rounded-md font-semibold text-[11px] flex items-center justify-center gap-1 transition-all ${
            activeType === "manual_external"
              ? "bg-card text-foreground shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Edit3 className="h-3.5 w-3.5 text-amber-600" /> Manual Entry
        </button>
      </div>

      {/* Input Selector depending on activeType */}
      {activeType === "internal" && (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Select Internal Sales Executive</Label>
          <Select
            value={value.internalExecutiveId || ""}
            onValueChange={(val) =>
              onChange({
                ...value,
                attributionType: "internal",
                internalExecutiveId: val,
              })
            }
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Choose Internal Executive..." />
            </SelectTrigger>
            <SelectContent>
              {internalExecutives.map((exec) => (
                <SelectItem key={exec.id} value={exec.id} className="text-xs">
                  {exec.full_name || exec.email || "Executive"} {exec.job_title ? `(${exec.job_title})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {activeType === "bdo" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground">Select Outsourced BDO Partner</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] text-terracotta hover:bg-terracotta/10 gap-1"
              onClick={() => setAddBdoOpen(true)}
            >
              <Plus className="h-3 w-3" /> Add New BDO
            </Button>
          </div>

          {bdoPartners.length === 0 ? (
            <div className="p-3 border border-dashed rounded-lg text-center space-y-1">
              <p className="text-xs text-muted-foreground">No BDO Partners registered yet.</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setAddBdoOpen(true)}
              >
                + Register First BDO
              </Button>
            </div>
          ) : (
            <Select
              value={value.bdoId || ""}
              onValueChange={(val) =>
                onChange({
                  ...value,
                  attributionType: "bdo",
                  bdoId: val,
                })
              }
            >
              <SelectTrigger className="h-9 text-xs font-medium">
                <SelectValue placeholder="Select Outsourced BDO Partner..." />
              </SelectTrigger>
              <SelectContent>
                {bdoPartners.map((bdo: any) => (
                  <SelectItem key={bdo.id} value={bdo.id} className="text-xs">
                    {bdo.name} {bdo.agency_name ? `(${bdo.agency_name})` : ""} {bdo.bdo_code ? `[${bdo.bdo_code}]` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {activeType === "manual_external" && (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Manual BDO / External Agent Name</Label>
          <Input
            placeholder="e.g. Suresh (External Referral / Independent Agent)"
            value={value.externalBdoName || ""}
            onChange={(e) =>
              onChange({
                ...value,
                attributionType: "manual_external",
                externalBdoName: e.target.value,
              })
            }
            className="h-9 text-xs"
          />
        </div>
      )}

      {/* Add BDO Modal */}
      {addBdoOpen && (
        <AddEditBdoDialog
          open={addBdoOpen}
          onOpenChange={setAddBdoOpen}
          onSuccess={(newId) => {
            refetchBdos();
            if (newId) {
              onChange({
                attributionType: "bdo",
                bdoId: newId,
              });
            }
          }}
        />
      )}
    </div>
  );
}
