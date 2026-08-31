import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ShieldCheck, Sparkles, Lock, Mail } from "lucide-react";
import { LiquidEffectAnimation } from "@/components/ui/liquid-effect-animation";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        nav({ to: "/dashboard", replace: true });
      }
    });
  }, [nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.user) {
          toast.success("Account created successfully!");
          nav({ to: "/dashboard" });
        } else {
          toast.info("Check your email for confirmation link.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // If credentials fail, attempt automatic signup for first-time user setup
          if (
            error.message?.toLowerCase().includes("invalid login credentials") ||
            error.message?.toLowerCase().includes("user not found")
          ) {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: { full_name: email.split("@")[0] },
              },
            });
            if (!signUpError && signUpData.user) {
              toast.success("Account created and logged in!");
              nav({ to: "/dashboard" });
              return;
            }
          }
          throw error;
        }
        toast.success("Welcome back to ARK Developers.");
        nav({ to: "/dashboard" });
      }
    } catch (err: any) {
      console.error("Auth submit error:", err);
      const msg =
        err?.message ||
        err?.error_description ||
        (err instanceof Error ? err.toString() : typeof err === "string" ? err : String(err) || "Authentication failed");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-10 overflow-hidden text-stone-900 selection:bg-terracotta selection:text-white">
      {/* 3D Liquid Background Canvas displaying background image */}
      <LiquidEffectAnimation imageSrc="/terra-bg.png" />

      {/* Top Header Navigation */}
      <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-6 sm:px-12 pointer-events-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-3 text-2xl font-bold tracking-tight text-stone-900 hover:text-amber-800 transition-colors group"
        >
          <img
            src="/ark-logo.png"
            alt="ARK Logo"
            className="h-9 w-auto object-contain group-hover:scale-105 transition-transform"
            onError={(e: any) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div className="flex flex-col">
            <span className="font-serif font-black text-lg text-slate-900 leading-tight">ARK DEVELOPERS</span>
            <span className="text-[9px] uppercase font-bold text-amber-800 tracking-wider">Builders & Developers</span>
          </div>
        </Link>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-stone-700 hover:text-stone-900 transition-all rounded-full bg-white/80 backdrop-blur-md border border-white/90 hover:border-terracotta/40 hover:bg-white/95 group shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform text-terracotta" />
          Landing Page
        </Link>
      </header>

      {/* Glassmorphic Login Card */}
      <main className="relative z-20 w-full max-w-md my-auto pt-16 pb-6">
        <div className="relative group">
          {/* Outer Glow Accent */}
          <div className="absolute -inset-1.5 rounded-[2.5rem] bg-gradient-to-r from-terracotta/30 via-amber-400/25 to-terracotta/30 blur-2xl opacity-60 group-hover:opacity-100 transition duration-700" />

          {/* Light Glassmorphic Container */}
          <div className="relative rounded-[2rem] bg-white/70 backdrop-blur-3xl border border-white/90 p-8 sm:p-10 shadow-[0_30px_90px_-20px_rgba(200,90,50,0.2)] text-stone-900">
            
            {/* Header Badge */}
            <div className="flex items-center justify-between mb-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-terracotta/10 border border-terracotta/20 text-[11px] font-bold tracking-widest uppercase text-terracotta shadow-xs">
                <Sparkles className="size-3.5 text-terracotta animate-pulse" />
                <span>TERRA 2.0 PORTAL</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-stone-500 font-mono font-medium">
                <ShieldCheck className="size-4 text-emerald-600" />
                <span>Secure Access</span>
              </div>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-2 mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 font-display">
                {isSignUp ? "Create Account" : "Welcome Back"}
              </h1>
              <p className="text-sm text-stone-600 leading-relaxed font-medium">
                {isSignUp
                  ? "Initialize your ARK Developers session to manage land parcels."
                  : "Sign in to access interactive layout masterplans and leads."}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-xs uppercase tracking-wider text-stone-700 font-bold flex items-center gap-1.5"
                >
                  <Mail className="size-3.5 text-terracotta" />
                  Developer Email
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="developer@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 rounded-xl bg-white/85 border-stone-200/90 px-4 text-sm text-stone-900 placeholder:text-stone-400 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition-all shadow-xs font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-xs uppercase tracking-wider text-stone-700 font-bold flex items-center gap-1.5"
                >
                  <Lock className="size-3.5 text-terracotta" />
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-12 rounded-xl bg-white/85 border-stone-200/90 px-4 text-sm text-stone-900 placeholder:text-stone-400 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition-all shadow-xs font-medium"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="mt-4 h-12 w-full rounded-xl bg-terracotta text-white font-semibold hover:bg-terracotta/90 transition-all duration-300 shadow-md shadow-terracotta/25 group cursor-pointer flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  "Authenticating..."
                ) : isSignUp ? (
                  <>
                    Create Super Admin Account
                    <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                  </>
                ) : (
                  <>
                    Sign In to Dashboard
                    <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              <div className="text-center pt-3 border-t border-stone-200/60 mt-6">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs text-stone-600 hover:text-terracotta transition-colors font-semibold underline cursor-pointer"
                >
                  {isSignUp
                    ? "Already registered? Sign In to Dashboard"
                    : "First time setup? Create New Account / Sign Up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="absolute bottom-4 inset-x-0 z-30 text-center text-xs text-stone-500 font-medium pointer-events-none select-none">
        © ARK Builders & Developers · Powered by HAEGL
      </footer>
    </div>
  );
}
