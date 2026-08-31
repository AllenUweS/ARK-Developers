import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Landmark,
  Building2,
  Search,
  Plus,
  Copy,
  Check,
  Star,
  ShieldCheck,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { AddEditBankAccountDialog } from "@/components/projects/AddEditBankAccountDialog";
import { ConfirmDeleteBankAccountDialog } from "@/components/projects/ConfirmDeleteBankAccountDialog";

interface ProjectAccountsRegistryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: any[];
}

export function ProjectAccountsRegistryModal({
  open,
  onOpenChange,
  projects,
}: ProjectAccountsRegistryModalProps) {
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedProjectIdForAdd, setSelectedProjectIdForAdd] = useState<string>("");
  const [editingAccount, setEditingAccount] = useState<any | null>(null);

  const [deletingAccount, setDeletingAccount] = useState<any | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  // Fetch all bank accounts across all projects
  const { data: bankAccounts = [], isLoading, refetch } = useQuery({
    queryKey: ["all-project-bank-accounts"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_bank_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching all bank accounts:", error);
        return [];
      }
      return data ?? [];
    },
  });

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const filteredAccounts = bankAccounts.filter((acc: any) => {
    const proj = projectMap.get(acc.project_id);
    const projName = proj?.name || "";

    if (projectFilter !== "all" && acc.project_id !== projectFilter) return false;
    if (typeFilter !== "all" && acc.account_type !== typeFilter) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      projName.toLowerCase().includes(q) ||
      acc.bank_name.toLowerCase().includes(q) ||
      acc.account_name.toLowerCase().includes(q) ||
      acc.account_number.toLowerCase().includes(q) ||
      acc.ifsc_code.toLowerCase().includes(q)
    );
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Account details copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const maskAccountNo = (accNo: string) => {
    if (!accNo || accNo.length <= 4) return accNo;
    const last4 = accNo.slice(-4);
    const maskedPart = "•".repeat(Math.max(4, accNo.length - 4));
    return `${maskedPart} ${last4}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[1150px] w-[95vw] h-[85vh] max-h-[900px] flex flex-col p-6 overflow-hidden shadow-2xl border-purple-500/20">
          <DialogHeader className="pb-4 border-b shrink-0">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
                  <Landmark className="h-7 w-7 text-terracotta" />
                  Portfolio Bank Accounts Registry
                </DialogTitle>
                <DialogDescription className="text-sm mt-1">
                  Master centralized registry of all registered project bank accounts across your real estate portfolio.
                </DialogDescription>
              </div>
              <Button
                onClick={() => {
                  if (projects.length > 0) {
                    setSelectedProjectIdForAdd(projects[0].id);
                    setEditingAccount(null);
                    setAddModalOpen(true);
                  } else {
                    toast.error("No projects available to add bank account");
                  }
                }}
                className="bg-terracotta text-white hover:bg-terracotta/90 shadow-sm gap-2 font-medium px-4 h-10"
              >
                <Plus className="h-4 w-4" /> Add Project Bank A/C
              </Button>
            </div>
          </DialogHeader>

          {/* Filters Bar */}
          <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bank name, account holder, IFSC..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>

            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="All Account Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Account Types</SelectItem>
                <SelectItem value="Escrow">RERA Escrow Accounts</SelectItem>
                <SelectItem value="Current">Current Accounts</SelectItem>
                <SelectItem value="Collection">Collection Accounts</SelectItem>
                <SelectItem value="Operating">Operating Accounts</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table Content Container */}
          <div className="flex-1 overflow-y-auto border rounded-xl min-h-0 bg-card shadow-inner">
            {isLoading ? (
              <div className="py-20 text-center text-sm text-muted-foreground">
                Loading portfolio bank accounts registry...
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="py-20 text-center space-y-2 text-muted-foreground">
                <Landmark className="h-10 w-10 mx-auto opacity-40 text-muted-foreground" />
                <p className="font-semibold text-base">No bank accounts match your search filters</p>
                <p className="text-xs text-muted-foreground">Try clearing filters or add a new bank account for your project.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/60 border-b sticky top-0 uppercase tracking-wider text-[11px] text-muted-foreground font-bold z-10 backdrop-blur-xs">
                  <tr>
                    <th className="py-3.5 px-4">Project</th>
                    <th className="py-3.5 px-4">Bank Name</th>
                    <th className="py-3.5 px-4">Account Holder & Number</th>
                    <th className="py-3.5 px-4">IFSC Code & Branch</th>
                    <th className="py-3.5 px-4">Classification</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-sm">
                  {filteredAccounts.map((acc: any) => {
                    const proj = projectMap.get(acc.project_id);
                    const isRevealed = revealedIds.has(acc.id);

                    return (
                      <tr key={acc.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-4">
                          <span className="font-bold text-foreground text-base block">
                            {proj?.name || "Unknown Project"}
                          </span>
                          <span className="text-xs text-muted-foreground uppercase font-mono tracking-wider">
                            {proj?.code || ""}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-terracotta/10 text-terracotta shrink-0">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <span className="font-semibold text-foreground text-sm">{acc.bank_name}</span>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <p className="font-semibold text-foreground text-sm">{acc.account_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-xs text-muted-foreground tracking-wider bg-muted/50 px-2 py-0.5 rounded border border-border/60">
                              {isRevealed ? acc.account_number : maskAccountNo(acc.account_number)}
                            </span>
                            <button
                              onClick={() => toggleReveal(acc.id)}
                              className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted"
                              title={isRevealed ? "Hide Account Number" : "Show Account Number"}
                            >
                              {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              onClick={() => handleCopy(acc.account_number, acc.id)}
                              className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted"
                              title="Copy Account Number"
                            >
                              {copiedId === acc.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <span className="font-mono font-bold uppercase tracking-wider text-foreground text-xs block">
                            {acc.ifsc_code}
                          </span>
                          <span className="text-xs text-muted-foreground truncate block max-w-[180px] mt-0.5">
                            {acc.branch_name || "Main Branch"}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-xs px-2.5 py-0.5 font-medium">
                              {acc.account_type}
                            </Badge>
                            {acc.is_primary && (
                              <Badge className="text-[10px] px-2 py-0.5 bg-amber-500 text-white border-0 font-semibold gap-1">
                                <Star className="h-2.5 w-2.5 fill-white" /> Primary
                              </Badge>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-xs gap-1"
                              onClick={() => {
                                setSelectedProjectIdForAdd(acc.project_id);
                                setEditingAccount(acc);
                                setAddModalOpen(true);
                              }}
                            >
                              <Pencil className="h-3 w-3" /> Edit
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/40 gap-1"
                              onClick={() => {
                                setDeletingAccount(acc);
                                setDeleteConfirmOpen(true);
                              }}
                              title="Delete Bank Account"
                            >
                              <Trash2 className="h-3 w-3" /> Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {addModalOpen && (
        <AddEditBankAccountDialog
          projectId={selectedProjectIdForAdd}
          projects={projects}
          account={editingAccount}
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          onSuccess={() => refetch()}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteBankAccountDialog
        account={deletingAccount}
        projectName={deletingAccount ? projectMap.get(deletingAccount.project_id)?.name : undefined}
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onSuccess={() => refetch()}
      />
    </>
  );
}
