import { supabase } from "@/integrations/supabase/client";

/**
 * Reconciles and synchronizes leads whose bookings or sites were cancelled or rejected.
 * When a booking is marked as 'cancelled' or 'rejected', the associated lead MUST be marked
 * as 'dropped', unlinked from the released plot, and logged with a clear audit trail.
 */
export async function syncCancelledAndRejectedLeads(): Promise<number> {
  try {
    // 1. Fetch all bookings that are cancelled or rejected
    const { data: cancelledBookings, error: bkgErr } = await (supabase as any)
      .from("bookings")
      .select("id, status, customer_name, customer_phone, plot_id, lead_id, updated_at, remarks")
      .in("status", ["cancelled", "rejected"]);

    if (bkgErr || !cancelledBookings || cancelledBookings.length === 0) {
      return 0;
    }

    // 2. Fetch all leads currently in 'converted' status or attached to cancelled plots
    const { data: allLeads, error: leadsErr } = await (supabase as any)
      .from("plot_leads")
      .select("id, name, phone, status, plot_id");

    if (leadsErr || !allLeads || allLeads.length === 0) {
      return 0;
    }

    const leadsMap = new Map<string, any>();
    allLeads.forEach((l: any) => leadsMap.set(l.id, l));

    let healedCount = 0;

    for (const bkg of cancelledBookings) {
      // Find matching lead:
      // Priority 1: Direct lead_id on booking
      let matchedLead = bkg.lead_id ? leadsMap.get(bkg.lead_id) : null;

      // Priority 2: Match by phone or exact name if lead_id was missing
      if (!matchedLead && bkg.customer_phone) {
        matchedLead = allLeads.find(
          (l: any) =>
            l.phone &&
            l.phone.replace(/\D/g, "") === bkg.customer_phone.replace(/\D/g, "") &&
            l.status === "converted"
        );
      }

      if (!matchedLead && bkg.customer_name) {
        matchedLead = allLeads.find(
          (l: any) =>
            l.name?.trim().toLowerCase() === bkg.customer_name.trim().toLowerCase() &&
            l.status === "converted"
        );
      }

      // Priority 3: Match by plot_id if still attached to the cancelled plot
      if (!matchedLead && bkg.plot_id) {
        matchedLead = allLeads.find(
          (l: any) => l.plot_id === bkg.plot_id && l.status === "converted"
        );
      }

      // If the matched lead is still in 'converted' status, heal it to 'dropped'
      if (matchedLead && matchedLead.status === "converted") {
        const leadId = matchedLead.id;

        const { error: updErr } = await (supabase as any)
          .from("plot_leads")
          .update({
            status: "dropped",
            plot_id: null,
          })
          .eq("id", leadId);

        if (!updErr) {
          healedCount++;
          // Update local copy so we don't process again
          matchedLead.status = "dropped";
          matchedLead.plot_id = null;

          // Log audit activity in lead_activities
          try {
            await (supabase as any).from("lead_activities").insert({
              lead_id: leadId,
              activity_type: "lead_dropped",
              from_status: "converted",
              to_status: "dropped",
              notes: `🚫 Lead Dropped — Site booking was ${bkg.status.toUpperCase()} (${bkg.remarks || "Plot released back to inventory"}).`,
              metadata: {
                drop_reason: "booking_cancelled",
                booking_id: bkg.id,
                previous_plot_id: bkg.plot_id,
              },
            });
          } catch (actErr) {
            console.warn("Could not insert lead_activities audit log:", actErr);
          }

          // Record in lead_drop_reasons table
          try {
            await (supabase as any).from("lead_drop_reasons").insert({
              lead_id: leadId,
              dropped_from_stage: "converted",
              reason: "booking_cancelled",
              reason_label: "Booking Cancelled / Site Released",
              notes: `Booking status: ${bkg.status}. Remarks: ${bkg.remarks || "No extra remarks"}`,
            });
          } catch (drpErr) {
            console.warn("Could not insert lead_drop_reasons record:", drpErr);
          }
        }
      }
    }

    return healedCount;
  } catch (err) {
    console.error("Error during syncCancelledAndRejectedLeads:", err);
    return 0;
  }
}
