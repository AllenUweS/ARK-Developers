import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, UserPlus, ShieldCheck, Landmark, Phone, Mail, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PhoneInput } from "@/components/ui/phone-input";
import { AccountNumberInput } from "@/components/ui/account-number-input";
import { IfscInput } from "@/components/ui/ifsc-input";
import {
  getPhoneValidationError,
  getAccountNumberValidationError,
  getIfscValidationError,
  isValidEmail,
  sanitizePhoneInput,
  sanitizeAccountNumber,
  sanitizeIfscCode,
  sanitizePercentage,
} from "@/lib/formValidation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface AddEditBdoDialogProps {
  bdo?: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newBdoId?: string) => void;
}

export function AddEditBdoDialog({
  bdo,
  open,
  onOpenChange,
  onSuccess,
}: AddEditBdoDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!bdo;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [bdoCode, setBdoCode] = useState("");
  const [commissionRate, setCommissionRate] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [upiId, setUpiId] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (bdo) {
      setName(bdo.name || "");
      setPhone(bdo.phone || "");
      setEmail(bdo.email || "");
      setAgencyName(bdo.agency_name || "");
      setBdoCode(bdo.bdo_code || "");
      setCommissionRate(bdo?.commission_rate != null ? String(bdo.commission_rate) : "");
      setBankName(bdo.bank_name || "");
      setAccountNumber(bdo.account_number || "");
      setIfscCode(bdo.ifsc_code || "");
      setUpiId(bdo.upi_id || "");
      setNotes(bdo.notes || "");
      setIsActive(bdo.is_active ?? true);
    } else {
      setName("");
      setPhone("");
      setEmail("");
      setAgencyName("");
      setBdoCode(`BDO-${Math.floor(100 + Math.random() * 900)}`);
      setCommissionRate("");
      setBankName("");
      setAccountNumber("");
      setIfscCode("");
      setUpiId("");
      setNotes("");
      setIsActive(true);
    }
  }, [bdo, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("BDO Partner Name is required");

      const cleanPhone = phone.trim() ? sanitizePhoneInput(phone) : null;
      if (cleanPhone) {
        const phoneErr = getPhoneValidationError(cleanPhone, false);
        if (phoneErr) throw new Error(phoneErr);
      }

      if (email.trim() && !isValidEmail(email)) {
        throw new Error("Please enter a valid email address");
      }

      const cleanAcc = accountNumber.trim() ? sanitizeAccountNumber(accountNumber) : null;
      if (cleanAcc) {
        const accErr = getAccountNumberValidationError(cleanAcc, false);
        if (accErr) throw new Error(accErr);
      }

      const cleanIfsc = ifscCode.trim() ? sanitizeIfscCode(ifscCode) : null;
      if (cleanIfsc) {
        const ifscErr = getIfscValidationError(cleanIfsc, false);
        if (ifscErr) throw new Error(ifscErr);
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const payload = {
        name: name.trim(),
        phone: cleanPhone,
        email: email.trim() || null,
        agency_name: agencyName.trim() || null,
        bdo_code: bdoCode.trim() || null,
        commission_rate: sanitizePercentage(commissionRate),
        bank_name: bankName.trim() || null,
        account_number: cleanAcc,
        ifsc_code: cleanIfsc,
        upi_id: upiId.trim() || null,
        notes: notes.trim() || null,
        is_active: isActive,
        created_by: userId,
        updated_at: new Date().toISOString(),
      };

      if (isEditing) {
        const { error } = await (supabase as any)
          .from("bdo_partners")
          .update(payload)
          .eq("id", bdo.id);
        if (error) throw error;
        return bdo.id;
      } else {
        const { data, error } = await (supabase as any)
          .from("bdo_partners")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        return data?.id;
      }
    },
    onSuccess: (newId) => {
      toast.success(isEditing ? "BDO Partner updated successfully!" : "New BDO Partner added!");
      queryClient.invalidateQueries({ queryKey: ["all-bdo-partners"] });
      queryClient.invalidateQueries({ queryKey: ["active-bdo-partners"] });
      onOpenChange(false);
      if (onSuccess) onSuccess(newId);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save BDO Partner");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Building2 className="h-5 w-5 text-terracotta" />
            {isEditing ? "Edit BDO Partner Profile" : "Register New BDO Outsourced Partner"}
          </DialogTitle>
          <DialogDescription className="text-xs mt-1">
            Outsourced Business Development Officer (BDO) who brings in leads and sales conversions without a login account.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Row 1: Name & Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bdoName" className="text-xs font-semibold text-foreground">
                Partner Full Name *
              </Label>
              <Input
                id="bdoName"
                placeholder="e.g. Rajesh Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 text-xs font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bdoCode" className="text-xs font-semibold text-foreground">
                BDO Partner Code
              </Label>
              <Input
                id="bdoCode"
                placeholder="e.g. BDO-001"
                value={bdoCode}
                onChange={(e) => setBdoCode(e.target.value.toUpperCase())}
                className="h-10 font-mono text-xs uppercase"
              />
            </div>
          </div>

          {/* Row 2: Phone & Agency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bdoPhone" className="text-xs font-semibold text-foreground">
                Phone Number (Optional)
              </Label>
              <PhoneInput
                id="bdoPhone"
                placeholder="98765 43210"
                value={phone}
                onChange={setPhone}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agencyName" className="text-xs font-semibold text-foreground">
                Agency / Organization Name
              </Label>
              <Input
                id="agencyName"
                placeholder="e.g. Apex Realty Consultants"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                className="h-10 text-xs"
              />
            </div>
          </div>

          {/* Row 3: Email & Default Commission % */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bdoEmail" className="text-xs font-semibold text-foreground">
                Email Address (Optional)
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="bdoEmail"
                  type="email"
                  placeholder="rajesh@apexrealty.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 h-10 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="commissionRate" className="text-xs font-semibold text-foreground">
                Default Incentive Commission (%)
              </Label>
              <div className="relative">
                <Percent className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="commissionRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="2.5"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  className="pl-9 h-10 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section: Optional Bank / Payout Details */}
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-3">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Landmark className="h-4 w-4 text-terracotta" /> Bank / UPI Payout Details (Optional)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                placeholder="Bank Name (e.g. HDFC Bank)"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="h-10 text-xs"
              />
              <AccountNumberInput
                placeholder="Account Number"
                value={accountNumber}
                onChange={setAccountNumber}
              />
              <IfscInput
                placeholder="IFSC Code"
                value={ifscCode}
                onChange={setIfscCode}
              />
              <Input
                placeholder="UPI ID (e.g. rajesh@okaxis)"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="h-10 font-mono text-xs"
              />
            </div>
          </div>

          {/* Switch: Active Partner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-foreground">Active Outsourced Partner</div>
              <p className="text-[11px] text-muted-foreground">
                Active BDOs will appear in lead and booking attribution dropdowns.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter className="p-4 px-6 border-t bg-muted/10 shrink-0 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-9 text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !name.trim()}
            className="h-9 bg-terracotta text-white hover:bg-terracotta/90 text-xs font-semibold"
          >
            {saveMutation.isPending ? "Saving..." : isEditing ? "Update BDO Partner" : "Register BDO Partner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
