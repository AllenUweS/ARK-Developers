import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound, Eye, EyeOff, Send, Copy, Check, Loader2, ShieldCheck } from "lucide-react";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    full_name?: string | null;
    email?: string | null;
    role?: string;
  } | null;
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  employee,
}: ChangePasswordDialogProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingResetLink, setSendingResetLink] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!employee) return null;

  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$!";
    let pass = "Terra@";
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
    setConfirmPassword(pass);
    toast.info("Generated a secure password. Make sure to copy it before saving!");
  };

  const handleCopyPassword = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    setCopied(true);
    toast.success("Password copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendResetEmail = async () => {
    if (!employee.email) {
      toast.error("Employee does not have a valid email address");
      return;
    }

    try {
      setSendingResetLink(true);
      const { error } = await supabase.auth.resetPasswordForEmail(employee.email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;
      toast.success(`Password reset link sent to ${employee.email}`);
    } catch (err: any) {
      console.error("Error sending reset email:", err);
      toast.error(err.message || "Failed to send password reset email");
    } finally {
      setSendingResetLink(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setLoading(true);

      // Check if logged-in user is editing their own password
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id === employee.id) {
        const { error: ownUpdateError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (!ownUpdateError) {
          toast.success("Your password has been updated successfully!");
          onOpenChange(false);
          resetForm();
          return;
        }
      }

      // Attempt 1: Call admin_update_user_password RPC
      const { data: rpcResult, error: rpcError } = await supabase.rpc("admin_update_user_password" as any, {
        _user_id: employee.id,
        _new_password: newPassword,
      });

      if (!rpcError) {
        toast.success(`Password updated successfully for ${employee.full_name || employee.email || "user"}`);
        onOpenChange(false);
        resetForm();
        return;
      }

      // Attempt 2: Call change_user_password alternate RPC
      const { error: rpcError2 } = await supabase.rpc("change_user_password" as any, {
        target_user_id: employee.id,
        new_password: newPassword,
      });

      if (!rpcError2) {
        toast.success(`Password updated successfully for ${employee.full_name || employee.email || "user"}`);
        onOpenChange(false);
        resetForm();
        return;
      }

      console.warn("RPC function missing in Supabase:", rpcError);

      // Fallback: Dispatch reset email link and inform admin to run migration
      if (employee.email) {
        await supabase.auth.resetPasswordForEmail(employee.email, {
          redirectTo: `${window.location.origin}/auth`,
        });
      }

      toast.info(
        `Password reset email sent to ${employee.email || "employee"}. To enable direct instant password overrides, execute the SQL migration in Supabase SQL Editor.`,
        { duration: 6000 }
      );
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      console.error("Error changing password:", err);
      toast.error(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if (!val) resetForm(); }}>
      <DialogContent className="sm:max-w-[440px] border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-terracotta to-amber-600 text-white flex items-center justify-center shadow-md">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-display">Change Executive Password</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Update login credentials for <span className="font-semibold text-foreground">{employee.full_name || employee.email}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleChangePassword} className="space-y-4 pt-2">
          {/* Quick Actions Bar */}
          <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-terracotta/[0.05] border border-terracotta/20 text-xs">
            <div className="flex items-center gap-1.5 text-terracotta font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Admin Override
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendResetEmail}
              disabled={sendingResetLink}
              className="h-7 text-[11px] border-terracotta/30 text-terracotta hover:bg-terracotta/10 rounded-lg cursor-pointer"
            >
              {sendingResetLink ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Send className="h-3 w-3 mr-1" />
              )}
              Email Reset Link
            </Button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">New Password</Label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[11px] text-terracotta hover:underline font-semibold cursor-pointer"
                >
                  Auto-Generate Password
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 characters)"
                  className="pr-20 text-sm rounded-xl"
                  autoComplete="new-password"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {newPassword && (
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy Password"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Confirm Password</Label>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="text-sm rounded-xl"
                autoComplete="new-password"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-terracotta to-amber-600 hover:from-terracotta/90 hover:to-amber-600/90 text-white rounded-xl text-xs font-semibold shadow-md"
            >
              {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Update Password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
