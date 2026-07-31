import { Phone, MessageCircle, Flame, Pencil, Trash2, ArrowLeftRight, Map, MapPin, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_ORDER,
  LEAD_STATUS_PALETTE,
  type LeadRow,
  type LeadStatus,
} from "@/components/site-mapper/types";
import { toast } from "sonner";
import { formatShortDate, getTemperature, initials, tintFor, isAllowedStageTransition } from "./leadUtils";

export interface EmployeeOption {
  id: string;
  name: string;
}

function digitsOnly(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

export function LeadCard({
  lead,
  employeeName,
  employeeId,
  plotLabel,
  canManage,
  transferOptions,
  onStatusChange,
  onTransfer,
  onEdit,
  onDelete,
  onOpenDetail,
  onMapToPlot,
}: {
  lead: LeadRow;
  employeeName: string;
  employeeId: string | null;
  plotLabel?: string;
  canManage: boolean;
  transferOptions?: EmployeeOption[];
  onStatusChange: (id: string, status: LeadStatus) => void;
  onTransfer?: (id: string, newEmployeeId: string) => void;
  onEdit?: (lead: LeadRow) => void;
  onDelete?: (id: string) => void;
  onOpenDetail?: (lead: LeadRow) => void;
  onMapToPlot?: (lead: LeadRow) => void;
}) {
  const palette = LEAD_STATUS_PALETTE[lead.status];
  const temp = getTemperature(lead);

  return (
    <div
      className="group rounded-lg border bg-card p-4 shadow-sm hover:shadow-md hover:border-terracotta/50 transition-all cursor-pointer overflow-hidden w-full"
      onClick={() => onOpenDetail?.(lead)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-base truncate group-hover:text-terracotta transition-colors">
              {lead.name}
            </h4>
            {temp === "hot" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-destructive/10 text-destructive shrink-0">
                <Flame className="h-3 w-3" /> Hot
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formatShortDate(lead.created_at)}
          </p>
        </div>

        {canManage && (
          <div
            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {lead.status !== "converted" && lead.status !== "dropped" && onMapToPlot && (
              <button
                className="p-1.5 text-terracotta hover:bg-terracotta/10 rounded relative cursor-pointer"
                title={lead.plot_id ? "Change mapped plot site" : "Map lead to plot site"}
                onClick={(e) => {
                  e.stopPropagation();
                  onMapToPlot(lead);
                }}
              >
                <MapPin className="h-4 w-4" />
                {!lead.plot_id && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-terracotta text-[10px] font-bold flex items-center justify-center text-white">+</span>
                )}
              </button>
            )}
            {onEdit && (
              <button
                className="p-1.5 text-muted-foreground hover:bg-muted rounded"
                title="Edit lead"
                onClick={() => onEdit(lead)}
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                className="p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 rounded"
                title="Delete lead"
                onClick={() => {
                  if (confirm(`Remove lead "${lead.name}"?`)) onDelete(lead.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div
        className="flex items-center gap-3 text-sm text-muted-foreground mt-3 flex-wrap"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={`tel:${lead.phone}`}
          className="flex items-center gap-1.5 hover:text-terracotta truncate"
        >
          <Phone className="h-4 w-4 shrink-0" /> {lead.phone}
        </a>
        <a
          href={`https://wa.me/91${digitsOnly(lead.phone).slice(-10)}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 hover:text-green-600 shrink-0"
          title="Message on WhatsApp"
        >
          <MessageCircle className="h-4 w-4" />
        </a>
      </div>

      {plotLabel && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2 group-hover:text-terracotta transition-colors min-w-0">
          <Map className="h-4 w-4 shrink-0" />
          <span className="truncate">{plotLabel}</span>
        </div>
      )}

      <div className="mt-3 pt-3 border-t space-y-2">
        {/* Top footer row: Employee info & Status badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Avatar className="h-5 w-5 shrink-0">
              <AvatarFallback className={`text-[9px] font-semibold ${tintFor(employeeId)}`}>
                {initials(employeeName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">{employeeName}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {canManage && transferOptions && transferOptions.length > 0 && onTransfer && (
              <Select onValueChange={(v) => onTransfer(lead.id, v)}>
                <SelectTrigger className="h-6 w-6 p-0 justify-center border-none bg-transparent shadow-none [&>svg]:hidden shrink-0">
                  <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground hover:text-terracotta" />
                </SelectTrigger>
                <SelectContent align="end">
                  {transferOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id} className="text-xs">
                      Transfer to {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold capitalize rounded-full border ${palette.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${palette.dot}`} />
              <span>{LEAD_STATUS_LABEL[lead.status]}</span>
            </span>
          </div>
        </div>

        {/* Bottom footer row: Advance Next Step Button */}
        {canManage && lead.status !== "converted" && lead.status !== "dropped" && (() => {
          const currentIdx = LEAD_STATUS_ORDER.indexOf(lead.status);
          const nextStatus = LEAD_STATUS_ORDER[currentIdx + 1];
          if (!nextStatus) return null;
          return (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(lead.id, nextStatus);
              }}
              className="w-full h-7 text-[11px] font-bold bg-terracotta hover:bg-terracotta/90 text-white gap-1.5 cursor-pointer rounded-md shadow-2xs transition-all hover:scale-[1.01]"
            >
              <span>Advance to Step {currentIdx + 2}: {LEAD_STATUS_LABEL[nextStatus]}</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
          );
        })()}
      </div>
    </div>
  );
}
