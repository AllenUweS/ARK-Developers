import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PieChart, ArrowUpRight, Sparkles, X, ChevronRight } from "lucide-react";
import { ProjectStatsView } from "./ProjectStatsView";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";

export function ProjectStatsDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating Side Tab Trigger Button on Right Viewport Edge */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 hidden md:block">
        <button
          onClick={() => setOpen(true)}
          className="group flex items-center gap-2 bg-gradient-to-l from-terracotta to-amber-600 hover:from-terracotta/90 hover:to-amber-500 text-white shadow-xl py-3 px-2.5 rounded-l-2xl border-y border-l border-white/20 backdrop-blur-md transition-all duration-300 hover:pl-4 focus:outline-none focus:ring-2 focus:ring-terracotta cursor-pointer"
          title="Open Project Stats & Financial Tally"
        >
          <div className="relative">
            <PieChart className="h-5 w-5 animate-pulse text-amber-200" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>

          <div className="[writing-mode:vertical-lr] rotate-180 text-xs font-bold tracking-wider uppercase flex items-center gap-1.5 py-1">
            <span>Project Stats</span>
          </div>
        </button>
      </div>

      {/* Sheet / Side Drawer Component */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-xl md:max-w-2xl w-full p-0 overflow-y-auto bg-background/95 backdrop-blur-2xl border-l border-border/60">
          <div className="p-6 border-b border-border/50 sticky top-0 bg-card/90 backdrop-blur-xl z-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-terracotta/15 text-terracotta ring-1 ring-terracotta/30">
                <PieChart className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-lg font-bold text-foreground">
                    Project Stats & Income Tally
                  </SheetTitle>
                  <Badge variant="outline" className="text-[10px] border-terracotta/30 text-terracotta bg-terracotta/10">
                    Live Drawer
                  </Badge>
                </div>
                <SheetDescription className="text-xs text-muted-foreground">
                  Quick side matrix for revenue, site sales, pending bookings & plots
                </SheetDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link to="/project-stats" onClick={() => setOpen(false)}>
                <Button size="sm" variant="outline" className="text-xs gap-1 border-terracotta/30 text-terracotta hover:bg-terracotta/10">
                  Full Page View <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Embedded Project Stats View inside side sheet */}
          <div className="p-4 md:p-6">
            <ProjectStatsView embedded={true} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
