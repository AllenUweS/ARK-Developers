import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const ASSET = "https://storage.googleapis.com/webild/default/templates/marbella";

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back to Terra.");
      nav({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-background text-foreground overflow-hidden selection:bg-terracotta selection:text-white">
      {/* LEFT ARCHITECTURAL FILM PANEL */}
      <div className="hidden lg:flex lg:col-span-7 relative overflow-hidden bg-black">
        <img
          src={`${ASSET}/contact/cta-bg.webp`}
          alt="Terra Architectural Estate"
          className="absolute inset-0 w-full h-full object-cover scale-105 filter brightness-90 contrast-105 animate-[pulse_10s_infinite_ease-in-out]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30" />
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />

        {/* Ambient Z-Axis Parallax Watermark */}
        <div className="absolute inset-x-0 bottom-12 flex justify-center pointer-events-none select-none z-0">
          <span className="text-[10vw] font-black text-white/[0.04] uppercase tracking-tighter whitespace-nowrap">
            TERRA ESTATES
          </span>
        </div>

        <div className="relative z-10 flex flex-col justify-between w-full p-12 text-white">
          <div className="flex items-center justify-between">
            <Link to="/" className="inline-flex items-center gap-3 text-2xl font-bold tracking-tight text-white hover:text-terracotta transition-colors group">
              <img src="/logo.png" alt="Terra Logo" className="size-9 rounded-xl object-cover border border-white/20 shadow-lg group-hover:scale-105 transition-transform" />
              <span>Terra</span>
            </Link>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-mono tracking-widest text-white/90">
              <Sparkles className="size-3.5 text-terracotta" />
              PORTAL ACCESS
            </div>
          </div>

          <div className="flex flex-col gap-6 max-w-xl">
            <div className="w-fit px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-terracotta bg-terracotta/10 border border-terracotta/20 rounded-full">
              01 — Estate Management
            </div>
            <h2 className="text-4xl xl:text-5xl font-semibold leading-[1.15] text-balance">
              Manage luxury plotted parcels with seamless precision.
            </h2>
            <p className="text-base text-white/70 leading-relaxed text-balance">
              Welcome to the central developer console for Terra. Access interactive masterplans, client inquiries, layout approvals, and live land reservations.
            </p>

            {/* Quote Pill */}
            <div className="mt-4 flex items-center gap-4 p-4 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/15">
              <div className="flex items-center justify-center size-10 rounded-full bg-terracotta/20 text-terracotta border border-terracotta/30 shrink-0">
                <ShieldCheck className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">End-to-End Land Operations</span>
                <span className="text-xs text-white/60">Encrypted institutional developer session</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-white/50 border-t border-white/10 pt-6">
            <span>© Terra Land Studio</span>
            <span>Powered by HAEGL</span>
          </div>
        </div>
      </div>

      {/* RIGHT AUTH FORM PANEL */}
      <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-12 xl:p-16 relative bg-background">
        <div className="flex items-center justify-between w-full">
          <Link to="/" className="lg:hidden inline-flex items-center gap-2 text-2xl font-semibold text-foreground">
            <img src="/logo.png" alt="Terra Logo" className="size-7 rounded-lg object-cover border border-border/50" />
            <span>Terra</span>
          </Link>
          <Link 
            to="/" 
            className="ml-auto inline-flex items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all rounded-full border border-border/50 hover:border-border hover:bg-accent/50 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            Landing Page
          </Link>
        </div>

        <div className="w-full max-w-md mx-auto my-auto py-12">
          {/* Logo Badge & Header */}
          <div className="flex flex-col gap-4 mb-2">
            <div className="flex items-center gap-3.5">
              <div className="relative group">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-terracotta to-amber-500 blur-md opacity-30 group-hover:opacity-60 transition duration-500" />
                <img
                  src="/logo.png"
                  alt="Terra Logo"
                  className="relative size-14 rounded-2xl object-cover border-2 border-border/80 shadow-md group-hover:scale-105 transition-transform"
                />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-terracotta block">
                  Portal Authentication
                </span>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
                  Welcome Back
                </h1>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Sign in to manage your land developments and client inquiries.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Developer Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl bg-card border-border/80 px-4 text-sm focus:border-terracotta focus:ring-1 focus:ring-terracotta transition-all"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Password
                </Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-12 rounded-xl bg-card border-border/80 px-4 text-sm focus:border-terracotta focus:ring-1 focus:ring-terracotta transition-all"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-12 w-full rounded-xl bg-terracotta text-white font-medium hover:bg-terracotta/90 transition-all duration-300 shadow-md group cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                "Authenticating..."
              ) : (
                <>
                  Sign In to Dashboard
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          Protected by Terra Security. Need access? Contact developer administration.
        </div>
      </div>
    </div>
  );
}
