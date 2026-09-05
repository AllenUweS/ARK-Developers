import { useState, useEffect } from "react";
import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useRouter,
  useLocation,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  WalletCards,
  LogOut,
  Users,
  Contact2,
  Sparkles,
  MessageSquare,
  MapPinned,
  FolderOpen,
  Landmark,
  BarChart3,
  PieChart,
  FileCheck,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationBell } from "@/components/NotificationBell";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    // If running on the server during SSR, do NOT redirect to /auth because localStorage is client-side only
    if (typeof window === "undefined") {
      return { user: null as any };
    }

    // 1. Check local session from storage (instant on page refresh, prevents logout race)
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      return { user: sessionData.session.user };
    }

    // 2. If not immediately in local cache, verify with getUser()
    try {
      const { data: userData, error } = await supabase.auth.getUser();
      if (!error && userData?.user) {
        return { user: userData.user };
      }
    } catch (e) {
      console.warn("Auth check during beforeLoad:", e);
    }

    throw redirect({ to: "/auth" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const context = Route.useRouteContext();
  const router = useRouter();
  const qc = useQueryClient();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState<any>(context?.user || null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(!context?.user);

  useEffect(() => {
    let isMounted = true;

    async function checkClientAuth() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          if (isMounted) {
            setCurrentUser(sessionData.session.user);
            setIsCheckingAuth(false);
          }
          return;
        }

        const { data: userData, error } = await supabase.auth.getUser();
        if (!error && userData?.user) {
          if (isMounted) {
            setCurrentUser(userData.user);
            setIsCheckingAuth(false);
          }
          return;
        }

        // Only redirect if definitely not authenticated on client
        if (isMounted) {
          router.navigate({ to: "/auth", replace: true });
        }
      } catch (err) {
        console.error("Client auth check error:", err);
        if (isMounted) {
          router.navigate({ to: "/auth", replace: true });
        }
      } finally {
        if (isMounted) setIsCheckingAuth(false);
      }
    }

    if (!currentUser) {
      checkClientAuth();
    } else {
      setIsCheckingAuth(false);
    }

    return () => {
      isMounted = false;
    };
  }, [currentUser, router]);

  const user = currentUser;

  const { data: role } = useQuery({
    queryKey: ["role", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: user.id });
      return (data as string) ?? "employee";
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  if (isCheckingAuth && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-terracotta border-t-transparent shadow-xs" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Restoring Session...
          </p>
        </div>
      </div>
    );
  }

  const { data: pendingApprovalCount = 0 } = useQuery({
    queryKey: ["pending_approval_count", role],
    enabled: !!role,
    queryFn: async () => {
      let q = supabase.from("bookings").select("id", { count: "exact" }).neq("status", "rejected").neq("status", "cancelled");
      if (role === "manager") q = q.eq("approval_stage", "sales_head_approval");
      else if (role === "crm") q = q.eq("approval_stage", "crm_verification");
      else if (role === "accounts") q = q.eq("approval_stage", "accounts_payment");
      else if (role === "admin" || role === "super_admin" || role === "management") q = q.neq("approval_stage", "completed");
      else q = q.eq("approval_stage", "sales_head_approval");

      const { count } = await q;
      return count || 0;
    },
  });

  if (!user) {
    return null;
  }

  const navSections = [
    {
      title: "Overview",
      items: [
        { to: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
        { to: "/approvals" as const, label: "Approvals", icon: FileCheck, badge: pendingApprovalCount },
        { to: "/project-stats" as const, label: "Project Stats", icon: PieChart },
      ],
    },
    {
      title: "Sales & Pipeline",
      items: [
        { to: "/projects" as const, label: "Projects", icon: FolderKanban },
        { to: "/bookings" as const, label: "Bookings", icon: ClipboardList },
        { to: "/installments" as const, label: "Installments", icon: WalletCards },
        { to: "/cancellations" as const, label: "Cancellations", icon: AlertTriangle },
        { to: "/leads" as const, label: "Leads CRM", icon: Contact2 },
      ],
    },
    {
      title: "Finance & Treasury",
      items: [
        ...(role === "admin" || role === "super_admin" || role === "management" || role === "accounts"
          ? [{ to: "/treasury" as const, label: "Treasury Vaults", icon: Landmark }]
          : []),
        ...(role === "admin" || role === "super_admin" || role === "manager" || role === "management" || role === "accounts" || role === "crm"
          ? [{ to: "/incentives" as const, label: "Incentives", icon: Sparkles }]
          : role === "employee"
            ? [{ to: "/my-incentives" as const, label: "My Incentives", icon: Sparkles }]
            : []),
        { to: "/analytics" as const, label: "Financial Analytics", icon: BarChart3 },
      ],
    },
    {
      title: "Operations & Admin",
      items: [
        { to: "/documents" as const, label: "Document Vault", icon: FolderOpen },
        { to: "/team" as const, label: "Team & BDOs", icon: Users },
        ...(role === "admin" || role === "super_admin" || role === "manager" || role === "management" || role === "accounts" || role === "crm"
          ? [{ to: "/messages" as const, label: "Messages", icon: MessageSquare }]
          : []),
        ...(role === "admin" || role === "super_admin" || role === "management" || role === "accounts" || role === "manager" || role === "crm"
          ? [{ to: "/visit-proofs" as const, label: "Site Visit Proofs", icon: MapPinned }]
          : []),
      ],
    },
  ].filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Modern Desktop Sidebar — Fixed, Pinned, Aesthetic */}
      <aside className="hidden md:flex w-68 flex-col border-r border-border/50 bg-card/90 backdrop-blur-2xl h-screen sticky top-0 shrink-0 shadow-sm z-30 select-none">
        {/* Ambient Warm Gradient Accents */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-52 w-52 rounded-full bg-terracotta/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-32 h-44 w-44 rounded-full bg-amber-500/[0.05] blur-3xl" />

        {/* Brand Header */}
        <div className="p-4.5 border-b border-border/40 bg-card/60 flex items-center justify-between shrink-0 relative z-10">
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="size-10 rounded-xl bg-white border border-slate-200/90 p-1 flex items-center justify-center shadow-xs group-hover:scale-105 group-hover:shadow-md transition-all duration-300">
              <img src="/ark-logo.png" alt="Ark Logo" className="h-7 w-auto object-contain" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-serif font-black text-[15px] text-slate-900 dark:text-white leading-none tracking-tight">
                ARK BUILDERS
              </span>
              <span className="text-[8.5px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Financial Platform
              </span>
            </div>
          </Link>
          <NotificationBell userId={user.id} />
        </div>

        {/* Modern Grouped Navigation (Scrollable with clean hidden scrollbar) */}
        <nav className="flex-1 p-3.5 space-y-5 overflow-y-auto min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden relative z-10">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 pb-1 text-[9.5px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground/70">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    location.pathname === item.to ||
                    ((item.to as string) !== "/" && location.pathname.startsWith(item.to));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                        active
                          ? "bg-gradient-to-r from-terracotta/15 via-terracotta/10 to-amber-500/5 text-terracotta font-bold shadow-xs border border-terracotta/25"
                          : "text-foreground/75 hover:bg-muted/70 hover:text-foreground border border-transparent"
                      }`}
                    >
                      {/* Active Indicator Bar */}
                      {active && (
                        <span className="absolute left-1 h-4 w-1 rounded-full bg-terracotta shadow-[0_0_8px_rgba(224,90,56,0.8)]" />
                      )}
                      <div
                        className={`size-7 rounded-lg flex items-center justify-center transition-all ${
                          active
                            ? "bg-terracotta/15 text-terracotta shadow-2xs"
                            : "bg-muted/40 text-muted-foreground group-hover:text-foreground group-hover:bg-muted/80"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="flex-1 truncate">{item.label}</span>
                      {"badge" in item && item.badge && item.badge > 0 ? (
                        <span className="h-4.5 min-w-[18px] px-1.5 rounded-full bg-gradient-to-r from-terracotta to-amber-600 text-white text-[9.5px] font-black flex items-center justify-center shadow-xs">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Pinned Executive Identity Card & Fast Logout */}
        <div className="p-3.5 border-t border-border/40 bg-gradient-to-t from-muted/50 to-muted/20 shrink-0 relative z-10">
          <div className="p-2.5 rounded-2xl bg-card/95 border border-border/70 shadow-xs flex items-center justify-between gap-2.5 backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative">
                <div className="size-8.5 rounded-xl bg-gradient-to-br from-terracotta via-amber-600 to-amber-700 flex items-center justify-center text-white text-xs font-black shadow-xs ring-2 ring-background">
                  {(profile?.full_name ?? user.email ?? "A").slice(0, 1).toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 border-2 border-card shadow-xs" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate text-foreground leading-tight">
                  {profile?.full_name ?? user.email?.split("@")[0]}
                </div>
                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[8.5px] font-extrabold uppercase tracking-wider bg-terracotta/10 text-terracotta border border-terracotta/20">
                  {role?.replace("_", " ")}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer rounded-xl shrink-0 transition-colors"
              onClick={signOut}
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Mobile Header (Only visible on phones/small screens) */}
        <header className="md:hidden border-b border-border/50 bg-card p-4 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <Link to="/dashboard" className="flex items-center gap-2 text-base font-extrabold text-ink dark:text-foreground">
            <img src="/ark-logo.png" alt="Ark Logo" className="h-6 w-auto object-contain" />
            <span>ARK BUILDERS</span>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell userId={user.id} />
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:bg-destructive/10 cursor-pointer rounded-lg"
              onClick={signOut}
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Dynamic Page Outlet */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
