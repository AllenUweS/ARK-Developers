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

  if (!user) {
    return null;
  }

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/approvals", label: "Approvals", icon: FileCheck },
    { to: "/project-stats", label: "Project Stats", icon: PieChart },
    { to: "/projects", label: "Projects", icon: FolderKanban },
    { to: "/bookings", label: "Bookings", icon: ClipboardList },
    { to: "/installments", label: "Installments", icon: WalletCards },
    { to: "/cancellations", label: "Cancellations", icon: AlertTriangle },
    { to: "/leads", label: "Leads", icon: Contact2 },
    { to: "/documents", label: "Documents", icon: FolderOpen },
    { to: "/team", label: "Team", icon: Users },
    { to: "/analytics", label: "Analytics", icon: BarChart3 },
  ] as const;

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

  const visibleNav = [
    ...nav,
    ...(role === "admin" || role === "super_admin" || role === "management" || role === "accounts"
      ? [{ to: "/treasury" as const, label: "Treasury", icon: Landmark }]
      : []),
    ...(role === "admin" || role === "super_admin" || role === "manager" || role === "management" || role === "accounts" || role === "crm"
      ? [
          { to: "/incentives" as const, label: "Incentives", icon: Sparkles },
          { to: "/messages" as const, label: "Messages", icon: MessageSquare },
        ]
      : role === "employee"
        ? [{ to: "/my-incentives" as const, label: "Incentives", icon: Sparkles }]
        : []),
    ...(role === "admin" || role === "super_admin" || role === "management" || role === "accounts"
      ? [{ to: "/visit-proofs" as const, label: "Visit Proofs", icon: MapPinned }]
      : []),
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border/60 bg-card/85 backdrop-blur-xl relative overflow-hidden shadow-xs">
        {/* Subtle Ambient Glow */}
        <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-terracotta/5 blur-3xl" />

        <div className="p-6 border-b border-border/50 flex items-center justify-between">
          <div>
            <Link to="/dashboard" className="inline-flex items-center gap-2.5 text-display text-2xl font-bold text-ink dark:text-foreground group">
              <img src="/ark-logo.png" alt="Ark Logo" className="h-8 w-auto object-contain shadow-2xs group-hover:scale-105 transition-transform" />
              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-tight leading-none text-foreground">ARK</span>
                <span className="text-[8.5px] text-muted-foreground tracking-wider uppercase font-bold mt-0.5">Builders & Developers</span>
              </div>
            </Link>
            <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-[0.2em] font-semibold text-terracotta">
              Site & Financial Platform
            </p>
          </div>
          <NotificationBell userId={user.id} />
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {visibleNav.map((item) => {
            const active =
              location.pathname === item.to ||
              ((item.to as string) !== "/" && location.pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 py-2.5 rounded-lg text-sm border-l-2 transition-all duration-200 ${
                  active
                    ? "bg-terracotta/[0.08] text-terracotta font-semibold border-terracotta shadow-xs backdrop-blur-xs pl-3.5 pr-3"
                    : "text-foreground/75 hover:bg-muted/70 hover:text-foreground border-transparent pl-4 pr-3"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-terracotta" : "text-muted-foreground"}`} />
                <span className="flex-1 truncate">{item.label}</span>
                {item.to === "/approvals" && pendingApprovalCount > 0 && (
                  <span className="h-5 px-1.5 min-w-[20px] rounded-full bg-terracotta text-white text-[10px] font-bold flex items-center justify-center shadow-xs shrink-0">
                    {pendingApprovalCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border/50 bg-muted/20">
          <div className="px-3 py-2 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-terracotta to-amber-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {(profile?.full_name ?? user.email ?? "T").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold truncate text-foreground">{profile?.full_name ?? user.email}</div>
              <div className="text-[10px] text-muted-foreground capitalize font-medium">
                {role?.replace("_", " ")}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs font-medium cursor-pointer rounded-lg"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Mobile Header */}
        <header className="md:hidden border-b border-border/50 bg-card p-4 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <Link to="/dashboard" className="flex items-center gap-2 text-base font-extrabold text-ink dark:text-foreground">
            <img src="/ark-logo.png" alt="Ark Logo" className="h-6 w-auto object-contain" />
            <span>ARK BUILDERS</span>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell userId={user.id} />
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
