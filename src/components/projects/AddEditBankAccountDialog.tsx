import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ShieldCheck, Folder } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AccountNumberInput } from "@/components/ui/account-number-input";
import { IfscInput } from "@/components/ui/ifsc-input";
import {
  getAccountNumberValidationError,
  getIfscValidationError,
  sanitizeAccountNumber,
  sanitizeIfscCode,
} from "@/lib/formValidation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface AddEditBankAccountDialogProps {
  projectId?: string;
  projects?: any[];
  account?: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const COMMON_BANKS = [
  "HDFC Bank",
  "ICICI Bank",
  "State Bank of India (SBI)",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "IndusInd Bank",
  "Federal Bank",
  "Canara Bank",
  "Bank of Baroda",
  "Yes Bank",
  "Other Bank",
];

const ACCOUNT_TYPES = [
  { value: "Escrow", label: "RERA Escrow Account" },
  { value: "Current", label: "Current Operating Account" },
  { value: "Collection", label: "Collection / Advance Account" },
  { value: "Operating", label: "Operating & Expenses Account" },
];

export function AddEditBankAccountDialog({
  projectId,
  projects: initialProjects,
  account,
  open,
  onOpenChange,
  onSuccess,
}: AddEditBankAccountDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!account;

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [bankName, setBankName] = useState("HDFC Bank");
  const [customBankName, setCustomBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [accountType, setAccountType] = useState("Escrow");
  const [isPrimary, setIsPrimary] = useState(false);

  // Fetch all projects if projects list is not provided as prop
  const { data: fetchedProjects = [] } = useQuery({
    queryKey: ["dialog-all-projects"],
    enabled: open && !initialProjects?.length,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, code")
        .order("name", { ascending: true });
      if (error) return [];
      return data ?? [];
    },
  });

  const availableProjects = initialProjects?.length ? initialProjects : fetchedProjects;

  useEffect(() => {
    if (account) {
      setSelectedProjectId(account.project_id || projectId || "");
      const isKnown = COMMON_BANKS.includes(account.bank_name);
      setBankName(isKnown ? account.bank_name : "Other Bank");
      setCustomBankName(isKnown ? "" : account.bank_name || "");
      setAccountName(account.account_name || "");
      setAccountNumber(account.account_number || "");
      setIfscCode(account.ifsc_code || "");
      setBranchName(account.branch_name || "");
      setAccountType(account.account_type || "Escrow");
      setIsPrimary(!!account.is_primary);
    } else {
      const defaultProj = projectId || (availableProjects.length > 0 ? availableProjects[0].id : "");
      setSelectedProjectId(defaultProj);
      setBankName("HDFC Bank");
      setCustomBankName("");
      setAccountName("");
      setAccountNumber("");
      setIfscCode("");
      setBranchName("");
      setAccountType("Escrow");
      setIsPrimary(false);
    }
  }, [account, projectId, open, availableProjects]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjectId) throw new Error("Please select a target project for this bank account");

      const finalBank = bankName === "Other Bank" ? customBankName.trim() : bankName;
      if (!finalBank) throw new Error("Please specify the bank name");
      if (!accountName.trim()) throw new Error("Account holder / title is required");

      const accErr = getAccountNumberValidationError(accountNumber);
      if (accErr) throw new Error(accErr);

      const ifscErr = getIfscValidationError(ifscCode);
      if (ifscErr) throw new Error(ifscErr);

      const cleanAcc = sanitizeAccountNumber(accountNumber);
      const cleanIfsc = sanitizeIfscCode(ifscCode);

      // If set as primary, unmark existing primary account for this project first
      if (isPrimary) {
        await (supabase as any)
          .from("project_bank_accounts")
          .update({ is_primary: false })
          .eq("project_id", selectedProjectId);
      }

      const payload = {
        project_id: selectedProjectId,
        bank_name: finalBank,
        account_name: accountName.trim(),
        account_number: cleanAcc,
        ifsc_code: cleanIfsc,
        branch_name: branchName.trim() || null,
        account_type: accountType,
        is_primary: isPrimary,
        updated_at: new Date().toISOString(),
      };

      if (isEditing) {
        const { error } = await (supabase as any)
          .from("project_bank_accounts")
          .update(payload)
          .eq("id", account.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("project_bank_accounts")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        isEditing
          ? "Bank account details updated successfully!"
          : "New project bank account added successfully!"
      );
      queryClient.invalidateQueries({ queryKey: ["project-bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["all-project-bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["treasury-projects"] });
      queryClient.invalidateQueries({ queryKey: ["treasury-all-bank-accounts"] });
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save bank account");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Building2 className="h-5 w-5 text-terracotta" />
            {isEditing ? "Edit Project Bank Account" : "Add Project Bank Account"}
          </DialogTitle>
          <DialogDescription className="text-xs mt-1">
            Configure official banking details linked to a specific real estate project.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Row 0: Target Project Selector */}
          <div className="grid gap-1.5">
            <Label htmlFor="projectSelect" className="text-xs font-semibold text-terracotta flex items-center gap-1.5">
              <Folder className="h-3.5 w-3.5" /> Select Target Project *
            </Label>
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
              disabled={isEditing}
            >
              <SelectTrigger id="projectSelect" className="h-10 text-xs font-medium bg-terracotta/5 border-terracotta/30">
                <SelectValue placeholder="Choose project to link bank account..." />
              </SelectTrigger>
              <SelectContent>
                {availableProjects.map((p: any) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs font-medium">
                    {p.name} {p.code ? `(${p.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 1: Bank Name & Classification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="bankSelect" className="text-xs font-semibold text-muted-foreground">
                Bank Name *
              </Label>
              <Select value={bankName} onValueChange={setBankName}>
                <SelectTrigger id="bankSelect" className="h-10 text-xs">
                  <SelectValue placeholder="Select Bank" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_BANKS.map((b) => (
                    <SelectItem key={b} value={b} className="text-xs">
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bankName === "Other Bank" && (
                <Input
                  placeholder="Type Bank Name..."
                  value={customBankName}
                  onChange={(e) => setCustomBankName(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="accountType" className="text-xs font-semibold text-muted-foreground">
                Account Classification *
              </Label>
              <Select value={accountType} onValueChange={setAccountType}>
                <SelectTrigger id="accountType" className="h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Account Title / Name */}
          <div className="grid gap-1.5">
            <Label htmlFor="accountName" className="text-xs font-semibold text-muted-foreground">
              Account Holder / Title *
            </Label>
            <Input
              id="accountName"
              placeholder="e.g. ARK Royal Villas Escrow Account"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="h-10 text-xs"
            />
          </div>

          {/* Row 3: Account Number & IFSC */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="accountNumber" className="text-xs font-semibold text-muted-foreground">
                Account Number *
              </Label>
              <AccountNumberInput
                id="accountNumber"
                placeholder="e.g. 11001234567890"
                value={accountNumber}
                onChange={setAccountNumber}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="ifscCode" className="text-xs font-semibold text-muted-foreground">
                IFSC Code *
              </Label>
              <IfscInput
                id="ifscCode"
                placeholder="e.g. HDFC0001234"
                value={ifscCode}
                onChange={setIfscCode}
                required
              />
            </div>
          </div>

          {/* Row 4: Branch Name */}
          <div className="grid gap-1.5">
            <Label htmlFor="branchName" className="text-xs font-semibold text-muted-foreground">
              Branch Name (Optional)
            </Label>
            <Input
              id="branchName"
              placeholder="e.g. Indiranagar Branch, Bengaluru"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              className="h-10 text-xs"
            />
          </div>

          {/* Row 5: Primary Account Switch Box */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border">
            <div className="space-y-0.5 pr-2">
              <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" /> Set as Primary Bank Account
              </div>
              <p className="text-[11px] text-muted-foreground">
                Primary account will be auto-selected during inter-project treasury transfers.
              </p>
            </div>
            <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
          </div>
        </div>

        <DialogFooter className="p-4 px-6 border-t bg-muted/10 shrink-0 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-9 px-4 text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !selectedProjectId}
            className="h-9 px-5 bg-terracotta text-white hover:bg-terracotta/90 text-xs font-medium"
          >
            {saveMutation.isPending ? "Saving..." : isEditing ? "Update Account" : "Add Bank Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
