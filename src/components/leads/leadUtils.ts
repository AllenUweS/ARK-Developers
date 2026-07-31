import type { LeadRow, LeadStatus } from "@/components/site-mapper/types";

export function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** A small fixed palette of avatar tints, picked deterministically per id
 *  so the same person always gets the same colour across the app. */
const AVATAR_TINTS = [
  "bg-terracotta/15 text-terracotta",
  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
];

export function tintFor(id?: string | null) {
  if (!id) return AVATAR_TINTS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

/** Lightweight lead-temperature heuristic — the schema doesn't store a
 *  priority flag, so we derive one from how close a lead is to closing
 *  and whether a site visit is imminent. */
export type Temperature = "hot" | "warm" | null;

export function getTemperature(lead: Pick<LeadRow, "status" | "meeting_date">): Temperature {
  if (lead.status === "converted" || lead.status === "dropped") return null;
  if (lead.status === "negotiating") return "hot";
  if (lead.status === "meeting_scheduled") return "warm";
  if (lead.meeting_date) {
    const days = (new Date(lead.meeting_date).getTime() - Date.now()) / 86_400_000;
    if (days >= 0 && days <= 3) return "warm";
  }
  return null;
}

export const CLOSED_STATUSES: LeadStatus[] = ["converted", "dropped"];

export function isOpen(status: LeadStatus) {
  return !CLOSED_STATUSES.includes(status);
}

export function formatShortDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

import { LEAD_STATUS_ORDER } from "@/components/site-mapper/types";

/** Strict step-by-step lifecycle progression rule.
 *  Prevents stage jumping (e.g. going directly from 'new' to 'meeting_scheduled'). */
export function isAllowedStageTransition(currentStatus: LeadStatus, targetStatus: LeadStatus): boolean {
  if (targetStatus === "dropped") return true; // Dropping a lead can happen at any time
  const currentIdx = LEAD_STATUS_ORDER.indexOf(currentStatus);
  const targetIdx = LEAD_STATUS_ORDER.indexOf(targetStatus);
  if (targetIdx < 0 || currentIdx < 0) return true;
  if (targetIdx <= currentIdx) return true; // Reverting to a previous completed stage is allowed
  return targetIdx === currentIdx + 1; // Advancing forward requires step-by-step (+1)
}
