import { useState } from "react";
import {
  BadgeCheck,
  Phone,
  Mail,
  MapPin,
  IndianRupee,
  CalendarDays,
  CreditCard,
  UserCheck,
  Pencil,
  FileCheck2,
  ExternalLink,
  MessageCircle,
  Building2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecordPurchaserDialog } from "./RecordPurchaserDialog";
import type { PlotRow, PurchaserRecord } from "./types";
import { Link } from "@tanstack/react-router";

interface PurchaserDetailsCardProps {
  plot: PlotRow;
  purchaser: PurchaserRecord | null;
  isAdmin: boolean;
  userId: string;
  onRecordSuccess?: () => void;
}

export function PurchaserDetailsCard({
  plot,
  purchaser,
  isAdmin,
  userId,
  onRecordSuccess,
}: PurchaserDetailsCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const getInitials = (name: string) => {
    if (!name) return "P";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const formattedPrice = (amount?: number | null) => {
    if (!amount) return "₹" + Number(plot.price || 0).toLocaleString("en-IN");
    return "₹" + Number(amount).toLocaleString("en-IN");
  };

  const formattedDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const isSold = plot.status === "sold";
  const badgeStyle = isSold
    ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
    : "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300";
  const iconColor = isSold ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400";
  const containerStyle = isSold
    ? "border-red-500/30 from-red-500/[0.06]"
    : "border-orange-500/30 from-orange-500/[0.06]";

  return (
    <div className={`rounded-xl border ${containerStyle} bg-gradient-to-b via-background to-background p-4 shadow-sm relative overflow-hidden`}>
      {/* Decorative background glow */}
      <div className={`pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full ${isSold ? "bg-red-500/10" : "bg-orange-500/10"} blur-2xl`} />

      {/* Header Badge */}
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center gap-1.5 rounded-md border ${badgeStyle} px-2 py-0.5 text-xs font-semibold`}>
          <BadgeCheck className={`h-3.5 w-3.5 ${iconColor}`} />
          {isSold ? "Sold" : "Booked"}
        </span>
        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-amber-500" />
          Plot {plot.plot_number}
        </span>
      </div>

      {purchaser ? (
        <div className="space-y-4">
          {/* Purchaser Profile Card */}
          <div className="flex items-start gap-3 rounded-lg border bg-card/80 p-3 backdrop-blur shadow-xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xs shadow-sm">
              {getInitials(purchaser.customer_name)}
            </div>

            <div className="flex-1 min-w-0">
              <div>
                <h4 className="font-bold text-sm leading-tight text-foreground break-words">
                  {purchaser.customer_name}
                </h4>
              </div>

              <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {purchaser.customer_phone && (
                  <a
                    href={`tel:${purchaser.customer_phone}`}
                    className="inline-flex items-center gap-1 hover:text-emerald-600 transition-colors"
                  >
                    <Phone className="h-3 w-3 text-emerald-600" />
                    <span>{purchaser.customer_phone}</span>
                  </a>
                )}
                {purchaser.customer_email && (
                  <a
                    href={`mailto:${purchaser.customer_email}`}
                    className="inline-flex items-center gap-1 hover:text-emerald-600 transition-colors"
                  >
                    <Mail className="h-3 w-3 text-emerald-600" />
                    <span className="truncate max-w-[140px]">{purchaser.customer_email}</span>
                  </a>
                )}
              </div>

              {purchaser.customer_address && (
                <p className="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                  <span className="line-clamp-1">{purchaser.customer_address}</span>
                </p>
              )}
            </div>
          </div>

          {/* Quick Action Pills for Contact */}
          {purchaser.customer_phone && (
            <div className="flex gap-2">
              <a
                href={`tel:${purchaser.customer_phone}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border bg-background py-1.5 text-xs font-medium hover:bg-emerald-500/10 hover:text-emerald-700 hover:border-emerald-500/30 transition-colors"
              >
                <Phone className="h-3.5 w-3.5 text-emerald-600" /> Call
              </a>
              <a
                href={`https://wa.me/${purchaser.customer_phone.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border bg-background py-1.5 text-xs font-medium hover:bg-emerald-500/10 hover:text-emerald-700 hover:border-emerald-500/30 transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp
              </a>
            </div>
          )}

          {/* Deal & Financial Highlights Grid */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-2.5 text-xs">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <IndianRupee className="h-3 w-3 text-emerald-600" /> Total Price
              </span>
              <p className="font-bold text-sm text-foreground mt-0.5">
                {formattedPrice(purchaser.total_price != null && Number(purchaser.total_price) > 0 ? purchaser.total_price : plot.price)}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3 w-3 text-emerald-600" /> Sale Date
              </span>
              <p className="font-medium text-xs text-foreground mt-0.5">
                {formattedDate(purchaser.booking_date)}
              </p>
            </div>

            {purchaser.payment_method && (
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <CreditCard className="h-3 w-3 text-emerald-600" /> Payment
                </span>
                <p className="font-medium text-xs text-foreground mt-0.5">
                  {purchaser.payment_method}
                </p>
              </div>
            )}

            {purchaser.advance_paid != null && (
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <FileCheck2 className="h-3 w-3 text-emerald-600" /> Paid Amount
                </span>
                <p className="font-medium text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {formattedPrice(purchaser.advance_paid)}
                </p>
              </div>
            )}
          </div>

          {/* Sales Executive Representative */}
          {purchaser.sales_executive?.full_name && (
            <div className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2 text-xs bg-card/50">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-terracotta shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Closed by Representative</p>
                  <p className="font-medium">{purchaser.sales_executive.full_name}</p>
                </div>
              </div>
              {purchaser.sales_executive.phone && (
                <a
                  href={`tel:${purchaser.sales_executive.phone}`}
                  className="text-xs text-emerald-600 font-medium hover:underline"
                >
                  Contact
                </a>
              )}
            </div>
          )}

          {/* Remarks if present */}
          {purchaser.remarks && (
            <div className="rounded-lg border bg-muted/20 p-2.5 text-xs">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">
                Deed & Registration Notes
              </p>
              <p className="text-muted-foreground leading-relaxed italic">
                "{purchaser.remarks}"
              </p>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-col gap-1.5 pt-1">
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                onClick={() => setDialogOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Purchaser Info
              </Button>
            )}

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              <Link to="/bookings">
                View in Bookings Pipeline <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        /* Empty State: Sold plot without pre-recorded purchaser */
        <div className="py-4 text-center space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold">No Owner Record Linked</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              This plot is marked as {plot.status}, but owner contact details have not been registered yet.
            </p>
          </div>

          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs w-full"
            onClick={() => setDialogOpen(true)}
          >
            <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Record Purchaser Details
          </Button>
        </div>
      )}

      {/* Record/Edit Purchaser Dialog */}
      <RecordPurchaserDialog
        open={dialogOpen}
        plot={plot}
        userId={userId}
        existingPurchaser={purchaser}
        onOpenChange={setDialogOpen}
        onSuccess={onRecordSuccess}
      />
    </div>
  );
}
