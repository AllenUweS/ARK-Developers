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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationBell } from "@/components/NotificationBell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const qc = useQueryClient();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const { data: role } = useQuery({
    queryKey: ["role", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: user.id });
      return (data as string) ?? "employee";
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
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

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/projects", label: "Projects", icon: FolderKanban },
    { to: "/bookings", label: "Bookings", icon: ClipboardList },
    { to: "/installments", label: "Installments", icon: WalletCards },
    { to: "/leads", label: "Leads", icon: Contact2 },
    { to: "/documents", label: "Documents", icon: FolderOpen },
    { to: "/team", label: "Team", icon: Users },
    { to: "/analytics", label: "Analytics", icon: BarChart3 },
  ] as const;

  const visibleNav = [
    ...nav,
    ...(role === "admin" || role === "super_admin" || role === "management"
      ? [{ to: "/treasury" as const, label: "Treasury", icon: Landmark }]
      : []),
    ...(role === "admin" || role === "super_admin" || role === "manager" || role === "management"
      ? [
          { to: "/incentives" as const, label: "Incentives", icon: Sparkles },
          { to: "/messages" as const, label: "Messages", icon: MessageSquare },
        ]
      : role === "employee"
        ? [{ to: "/my-incentives" as const, label: "Incentives", icon: Sparkles }]
        : []),
    ...(role === "admin" || role === "super_admin" || role === "management"
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
              <img src="/logo.png" alt="Terra Logo" className="h-7 w-7 rounded-lg object-cover shadow-2xs border border-border/60 group-hover:scale-105 transition-transform" />
              Terra
            </Link>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-[0.2em] font-medium">
              Developer Platform
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
                {item.label}
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
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start mt-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10">
            <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile Menu Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300 animate-in fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Menu Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-card border-r shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Close Button matching position of hamburger */}
            <button
              onClick={() => setIsOpen(false)}
              className="flex flex-col justify-center items-center w-9 h-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer relative"
              aria-label="Close Menu"
            >
              <div className="w-4 h-4 flex flex-col justify-between items-center relative">
                <span className="block h-[2px] w-4 bg-foreground rounded transition-all duration-300 ease-out origin-center rotate-45 absolute top-[7px]" />
                <span className="block h-[2px] w-4 bg-foreground rounded transition-all duration-300 ease-out opacity-0" />
                <span className="block h-[2px] w-4 bg-foreground rounded transition-all duration-300 ease-out origin-center -rotate-45 absolute top-[7px]" />
              </div>
            </button>
            <Link to="/dashboard" className="text-display text-xl" onClick={() => setIsOpen(false)}>
              Terra
            </Link>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNav.map((item, index) => {
            const active =
              location.pathname === item.to ||
              ((item.to as string) !== "/" && location.pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 py-2.5 rounded-r-md text-sm border-l-2 transition-all duration-300 transform ${
                  isOpen ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"
                } ${
                  active
                    ? "bg-terracotta/[0.06] text-terracotta font-semibold border-terracotta pl-3.5 pr-3"
                    : "text-foreground/80 hover:bg-muted/60 hover:text-foreground border-transparent pl-4 pr-3"
                }`}
                style={{
                  transitionDelay: isOpen ? `${index * 40}ms` : "0ms",
                }}
                onClick={() => setIsOpen(false)}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t bg-muted/20">
          <div className="px-3 py-2">
            <div className="text-sm font-medium truncate">{profile?.full_name ?? user.email}</div>
            <div className="text-xs text-muted-foreground capitalize">
              {role?.replace("_", " ")}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              signOut();
              setIsOpen(false);
            }}
            className="w-full justify-start mt-1 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 bg-background relative overflow-hidden">
        {/* Ambient Mesh Gradient Backdrops matching landing page */}
        <div className="pointer-events-none fixed top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-terracotta/12 via-amber-500/8 to-transparent blur-[140px] -z-10" />
        <div className="pointer-events-none fixed bottom-0 left-64 w-[600px] h-[600px] bg-gradient-to-tr from-emerald-500/10 via-teal-500/6 to-transparent blur-[140px] -z-10" />
        <div className="pointer-events-none fixed top-1/2 left-1/3 w-[400px] h-[400px] bg-gradient-to-r from-sky-500/5 via-indigo-500/5 to-transparent blur-[120px] -z-10" />

        <header className="md:hidden border-b border-border/60 p-4 flex items-center justify-between bg-card/85 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Hamburger Button */}
            <button
              onClick={() => setIsOpen(true)}
              className="flex flex-col justify-center items-center w-9 h-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground md:hidden transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer relative"
              aria-label="Open Menu"
            >
              <div className="w-4 h-4 flex flex-col justify-between items-center relative">
                <span className="block h-[2px] w-4 bg-foreground rounded transition-all duration-300 ease-out origin-center" />
                <span className="block h-[2px] w-4 bg-foreground rounded transition-all duration-300 ease-out my-[3px]" />
                <span className="block h-[2px] w-4 bg-foreground rounded transition-all duration-300 ease-out origin-center" />
              </div>
            </button>
            <Link to="/dashboard" className="text-display text-xl font-bold">
              Terra
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell userId={user.id} />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <div className="max-w-7xl mx-auto p-6 md:p-10 relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

