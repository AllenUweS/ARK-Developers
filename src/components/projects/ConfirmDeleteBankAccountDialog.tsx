import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ConfirmDeleteBankAccountDialogProps {
  account: any | null;
  projectName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ConfirmDeleteBankAccountDialog({
  account,
  projectName,
  open,
  onOpenChange,
  onSuccess,
}: ConfirmDeleteBankAccountDialogProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!account?.id) return;
      const { error } = await (supabase as any)
        .from("project_bank_accounts")
        .delete()
        .eq("id", account.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Bank account (${account?.bank_name}) deleted successfully.`);
      queryClient.invalidateQueries({ queryKey: ["project-bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["all-project-bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["treasury-projects"] });
      queryClient.invalidateQueries({ queryKey: ["treasury-all-bank-accounts"] });
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete bank account");
    },
  });

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Confirm Delete Bank Account
          </DialogTitle>
          <DialogDescription className="text-xs mt-1">
            Are you sure you want to permanently remove this bank account? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2 text-xs my-2">
          {projectName && (
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-wider">
              Project: <strong className="text-foreground">{projectName}</strong>
            </p>
          )}
          <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
            <Building2 className="h-4 w-4 text-terracotta shrink-0" />
            <span>{account.bank_name}</span>
            <span className="text-xs font-normal text-muted-foreground">({account.account_type})</span>
          </div>
          <p className="font-mono text-xs text-foreground">
            A/C Holder: <strong>{account.account_name}</strong>
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            A/C Number: ••••{account.account_number?.slice(-4)} | IFSC: {account.ifsc_code}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            {deleteMutation.isPending ? "Deleting..." : "Yes, Delete Bank Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
